// src/app/api/founding/[sessionId]/turn/route.ts
//
// Commissioner Founding Session (State 3) — conversation turn loop.
//
// Auth + load (SSR client -> RLS), guards, and persist live here; the model
// call + parse + compose are delegated to runAgentTurn (shared with the voice
// route). The session write stays on the SSR/RLS client (D9).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { runAgentTurn } from '@/lib/founding/turn-engine';
import { MAX_EXCHANGES } from '@/lib/founding/config';
import type { Database, FoundingSession } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FoundingSessionUpdate =
  Database['public']['Tables']['founding_sessions']['Update'];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  let body: { message?: unknown };
  try {
    body = (await req.json()) as { message?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  }

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

  // League name for the prompt. Ownership is already proven (RLS returned the
  // session), so this ancillary read uses the admin client like getLeague does.
  const admin = createAdminClient();
  const { data: leagueRow } = (await admin
    .from('leagues')
    .select('name')
    .eq('id', session.league_id)
    .maybeSingle()) as { data: { name: string } | null };
  const leagueName = leagueRow?.name ?? null;

  let result;
  try {
    result = await runAgentTurn({ session, leagueName, apiKey, message });
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }

  const update: FoundingSessionUpdate = {
    exchanges: result.next.exchanges,
    covered_topics: result.next.covered_topics,
    pending_required_topics: result.next.pending_required_topics,
    state: result.next.state,
    total_tokens_used: session.total_tokens_used + result.tokens,
  };
  // Contained cast: the repo's Database type lacks the keys supabase-js needs
  // for write inference. RLS still enforces via the SSR client.
  const { error: updErr } = await supabase
    .from('founding_sessions')
    .update(update as never)
    .eq('id', sessionId);
  if (updErr) {
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 });
  }

  return NextResponse.json({
    reply: result.reply,
    state: result.next.state,
    covered_topics: result.next.covered_topics,
    fallback: result.fallback,
  });
}
