// src/app/api/founding/[sessionId]/voice/route.ts
//
// Commissioner Founding Session (State 3) — voice calibration selection.
//
// A card tap posts { key }. We record the selection deterministically
// (voice_profile_selection + VOICE_CALIBRATION covered), then run the agent
// loop on a synthetic "let's go with X" turn so the agent acknowledges and
// continues (D-cal(a)). Same SSR/RLS write path as the turn route.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { runAgentTurn } from '@/lib/founding/turn-engine';
import {
  advanceFoundingState,
  markTopicCovered,
} from '@/lib/founding/session-state';
import { VOICE_CARDS } from '@/lib/founding/voice-cards';
import { MAX_EXCHANGES } from '@/lib/founding/config';
import type {
  Database,
  FoundingSession,
  VoiceProfileKey,
} from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FoundingSessionUpdate =
  Database['public']['Tables']['founding_sessions']['Update'];

const LABEL_BY_KEY = new Map<string, string>(
  VOICE_CARDS.map((c) => [c.key, c.label]),
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  let body: { key?: unknown };
  try {
    body = (await req.json()) as { key?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const key = typeof body.key === 'string' ? body.key : '';
  if (!LABEL_BY_KEY.has(key)) {
    return NextResponse.json({ error: 'Invalid voice key' }, { status: 400 });
  }
  const label = LABEL_BY_KEY.get(key) as string;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: sessionRow } = await supabase
    .from('founding_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  const session = (sessionRow as FoundingSession | null) ?? null;
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.state === 'COMPLETE') {
    return NextResponse.json({ error: 'Session complete' }, { status: 409 });
  }
  if (session.exchanges.length >= MAX_EXCHANGES) {
    return NextResponse.json({ error: 'Session too long' }, { status: 409 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data: leagueRow } = (await admin
    .from('leagues')
    .select('name')
    .eq('id', session.league_id)
    .maybeSingle()) as { data: { name: string } | null };
  const leagueName = leagueRow?.name ?? null;

  const selectionMessage = `Let's go with the ${label} voice.`;
  let result;
  try {
    result = await runAgentTurn({
      session,
      leagueName,
      apiKey,
      message: selectionMessage,
    });
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }

  // Record the selection + calibration coverage deterministically — not
  // dependent on the model having returned them.
  let next = markTopicCovered(result.next, 'VOICE_CALIBRATION');
  next = { ...next, voice_profile_selection: key as VoiceProfileKey };
  next = advanceFoundingState(next);

  const update: FoundingSessionUpdate = {
    exchanges: next.exchanges,
    covered_topics: next.covered_topics,
    pending_required_topics: next.pending_required_topics,
    voice_profile_selection: next.voice_profile_selection,
    state: next.state,
    total_tokens_used: session.total_tokens_used + result.tokens,
  };
  const { error: updErr } = await supabase
    .from('founding_sessions')
    .update(update as never)
    .eq('id', sessionId);
  if (updErr) {
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 });
  }

  return NextResponse.json({
    selection_message: selectionMessage,
    reply: result.reply,
    state: next.state,
    covered_topics: next.covered_topics,
    voice_profile_selection: next.voice_profile_selection,
    fallback: result.fallback,
  });
}
