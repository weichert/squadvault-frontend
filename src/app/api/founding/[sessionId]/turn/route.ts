// src/app/api/founding/[sessionId]/turn/route.ts
//
// Commissioner Founding Session (State 3) — conversation turn loop.
//
// Load the session (SSR client -> RLS scopes to the commissioner), call the
// Anthropic API with the session-driver system prompt, parse the agent's
// FoundingAgentTurn envelope (D7), and persist the two new exchanges + topic
// coverage. The session write stays on the SSR/RLS client (D9). State
// transitions (consent / outputs) are F-2/F-3; this loop keeps state as-is.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import {
  buildFoundingSystemPrompt,
  type FoundingAgentTurn,
} from '@/lib/founding/session-prompt';
import {
  INTENT_CLASSES,
  TOPICS,
  type IntentClass,
  type TopicId,
} from '@/lib/founding/protocol';
import { appendExchange, markTopicCovered } from '@/lib/founding/session-state';
import { FOUNDING_MODEL, MAX_EXCHANGES } from '@/lib/founding/config';
import type { Database, FoundingSession } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FoundingSessionUpdate =
  Database['public']['Tables']['founding_sessions']['Update'];

const VALID_TOPIC_IDS = new Set<string>(TOPICS.map((t) => t.id));
const VALID_INTENTS = new Set<string>(INTENT_CLASSES);

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

function parseAgentTurn(text: string): FoundingAgentTurn | null {
  let raw = text.trim();
  const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) raw = fence[1].trim();
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;
  if (typeof o.reply !== 'string' || o.reply.length === 0) return null;
  if (typeof o.intent !== 'string' || !VALID_INTENTS.has(o.intent)) return null;
  const topics_covered = Array.isArray(o.topics_covered)
    ? o.topics_covered.filter(
        (t): t is TopicId => typeof t === 'string' && VALID_TOPIC_IDS.has(t),
      )
    : [];
  return { reply: o.reply, intent: o.intent as IntentClass, topics_covered };
}

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

  // RLS scopes this to the commissioner's own sessions.
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

  // Map agent->assistant, commissioner->user, append the new commissioner turn,
  // and drop any leading assistant turn (the seeded opening) so the array
  // starts with a user message per the Anthropic API.
  const history: Anthropic.MessageParam[] = session.exchanges.map((ex) => ({
    role: ex.role === 'agent' ? 'assistant' : 'user',
    content: ex.content,
  }));
  history.push({ role: 'user', content: message });
  while (history.length > 0 && history[0].role === 'assistant') history.shift();

  const anthropic = new Anthropic({ apiKey });
  const systemPrompt = buildFoundingSystemPrompt({ leagueName });

  const callModel = (extra?: Anthropic.MessageParam) =>
    anthropic.messages.create({
      model: FOUNDING_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: extra ? [...history, extra] : history,
    });

  let totalTokens = 0;
  let parsed: FoundingAgentTurn | null = null;
  try {
    const resp = await callModel();
    totalTokens +=
      (resp.usage?.input_tokens ?? 0) + (resp.usage?.output_tokens ?? 0);
    parsed = parseAgentTurn(extractText(resp.content));
    if (!parsed) {
      // D8: one repair retry.
      const repair = await callModel({
        role: 'user',
        content:
          'Your previous reply was not valid JSON. Respond again with ONLY the JSON object {"reply":...,"intent":...,"topics_covered":[...]} and nothing else.',
      });
      totalTokens +=
        (repair.usage?.input_tokens ?? 0) + (repair.usage?.output_tokens ?? 0);
      parsed = parseAgentTurn(extractText(repair.content));
    }
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }

  // D8: safe fallback — never crash, never fabricate a classification.
  const commissionerIntent = parsed ? parsed.intent : null;
  const agentReply = parsed
    ? parsed.reply
    : 'Sorry — I lost the thread for a moment. Could you say that again?';
  const coveredNow = parsed ? parsed.topics_covered : [];

  let next: FoundingSession = appendExchange(session, {
    role: 'commissioner',
    content: message,
    intent_classified: commissionerIntent,
    created_at: new Date().toISOString(),
  });
  next = appendExchange(next, {
    role: 'agent',
    content: agentReply,
    intent_classified: null,
    created_at: new Date().toISOString(),
  });
  for (const t of coveredNow) next = markTopicCovered(next, t);

  const update: FoundingSessionUpdate = {
    exchanges: next.exchanges,
    covered_topics: next.covered_topics,
    pending_required_topics: next.pending_required_topics,
    total_tokens_used: session.total_tokens_used + totalTokens,
  };
  // Same contained cast as the insert path: the repo's Database type lacks the
  // keys supabase-js needs for write inference. RLS still enforces via the SSR
  // client; `update` is checked against the real Update type above.
  const { error: updErr } = await supabase
    .from('founding_sessions')
    .update(update as never)
    .eq('id', sessionId);
  if (updErr) {
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 });
  }

  return NextResponse.json({
    reply: agentReply,
    state: next.state,
    covered_topics: next.covered_topics,
    fallback: parsed === null,
  });
}
