// src/app/api/history/[sessionId]/turn/route.ts
//
// L.1 Historian Interviews — the interview turn loop (spec engine c9d32d5, sections 5.2 + 5.7
// + 6.4). Auth + load + the GRANT guard + persistence live here; the model call + parse are
// delegated to runHistorianTurn. Each turn appends TWO rows (the member's answer, then the
// historian's reply) to member_history_exchanges — diverge on persistence (per-turn INSERT),
// not logic. The session write stays on the SSR/RLS client (member-only authorship).
//
// GRANT PRECEDES CAPTURE (invariant 6.4), re-asserted here as defense-in-depth: no exchange is
// stored unless a current oral_history_testimony GRANT exists for this member. NO output
// generation, NO COMPLETE-with-outputs state (spec 5.7) — the exchanges ARE the record.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { runHistorianTurn, type HistoryTranscriptTurn } from '@/lib/history/turn-engine';
import type { Database, MemberHistorySession } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ExchangeInsert = Database['public']['Tables']['member_history_exchanges']['Insert'];

// Safety valve against a runaway / cost loop (mirrors the founding MAX_EXCHANGES discipline).
// NOT a pacing mechanism — a normal interview is well under this. Counts both speakers' rows.
const MAX_EXCHANGES = 160;

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
  if (!message) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Load the interview (RLS: author-only SELECT). A non-author / commissioner gets nothing.
  const { data: sessionRow } = (await supabase
    .from('member_history_sessions')
    .select('id, league_id, member_user_id, franchise_id, state')
    .eq('id', sessionId)
    .maybeSingle()) as { data: MemberHistorySession | null };
  if (!sessionRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (sessionRow.state !== 'IN_PROGRESS') {
    return NextResponse.json({ error: 'Interview ended' }, { status: 409 });
  }

  // GRANT-precedes-capture guard (invariant 6.4): no exchange without a current grant.
  const { data: cur } = (await supabase
    .from('member_consent_current')
    .select('current_state')
    .eq('member_user_id', user.id)
    .eq('category', 'oral_history_testimony')
    .maybeSingle()) as { data: { current_state: string } | null };
  if (cur?.current_state !== 'GRANT') {
    return NextResponse.json(
      { error: 'No active oral_history_testimony grant; the interview cannot continue.' },
      { status: 403 },
    );
  }

  // Build the transcript (RLS author-only) for the model call.
  const { data: rows } = (await supabase
    .from('member_history_exchanges')
    .select('turn, speaker, content')
    .eq('session_id', sessionId)
    .order('turn', { ascending: true })) as {
    data: { turn: number; speaker: 'HISTORIAN' | 'MEMBER'; content: string }[] | null;
  };
  const transcript: HistoryTranscriptTurn[] = (rows ?? []).map((r) => ({
    speaker: r.speaker,
    content: r.content,
  }));
  const lastTurn = (rows ?? []).reduce((m, r) => Math.max(m, r.turn), 0);
  if (lastTurn >= MAX_EXCHANGES) {
    return NextResponse.json({ error: 'Interview too long' }, { status: 409 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  // Names for the prompt (ownership already proven by the RLS load above; admin read like the
  // founding turn route's league-name fetch).
  const admin = createAdminClient();
  const { data: frRow } = (await admin
    .from('franchises')
    .select('owner_display_name')
    .eq('id', sessionRow.franchise_id)
    .maybeSingle()) as { data: { owner_display_name: string } | null };
  const { data: lgRow } = (await admin
    .from('leagues')
    .select('name')
    .eq('id', sessionRow.league_id)
    .maybeSingle()) as { data: { name: string } | null };

  let result;
  try {
    result = await runHistorianTurn({
      transcript,
      memberName: frRow?.owner_display_name ?? null,
      leagueName: lgRow?.name ?? null,
      apiKey,
      message,
    });
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }

  // Append the member's answer (turn N), then the historian's reply (turn N+1). Each is an
  // INSERTed, provenance-stamped row (provenance defaults to MEMBER_TESTIMONY at the DB layer).
  // The member's own SSR client authors both (RLS owns-session check); no commissioner proxy.
  const memberRow: ExchangeInsert = {
    session_id: sessionId,
    turn: lastTurn + 1,
    speaker: 'MEMBER',
    content: message,
    intent_classified: result.memberIntent,
    topic_covered: null,
  };
  const historianRow: ExchangeInsert = {
    session_id: sessionId,
    turn: lastTurn + 2,
    speaker: 'HISTORIAN',
    content: result.reply,
    intent_classified: null,
    // Descriptive bookkeeping only (no required-coverage gate): record the first topic the
    // member's turn organically covered, if any.
    topic_covered: result.topicsCovered[0] ?? null,
  };
  const { error: insErr } = await supabase
    .from('member_history_exchanges')
    .insert([memberRow, historianRow] as never);
  if (insErr) {
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 });
  }

  return NextResponse.json({
    reply: result.reply,
    fallback: result.fallback,
    topics_covered: result.topicsCovered,
  });
}
