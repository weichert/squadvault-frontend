// src/lib/founding/turn-engine.ts
//
// Shared agent-turn engine for the Founding Session. Extracted from the turn
// route so the voice-selection route can reuse the exact same loop (D-cal(a)).
//
// Pure of HTTP/auth/persistence: callers handle auth, session load, guards,
// league-name fetch, and the DB write. This function does the model call
// (with one repair-retry, D8), parses the FoundingAgentTurn envelope, and
// composes the next session immutably. It THROWS on an upstream API error
// (callers map that to 502) and returns a safe fallback turn on parse failure.

import Anthropic from '@anthropic-ai/sdk';
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
import {
  advanceFoundingState,
  appendExchange,
  markTopicCovered,
} from '@/lib/founding/session-state';
import { FOUNDING_MODEL } from '@/lib/founding/config';
import type { FoundingSession } from '@/lib/supabase/types';

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

export interface TurnResult {
  next: FoundingSession;
  reply: string;
  tokens: number;
  fallback: boolean;
}

export async function runAgentTurn(args: {
  session: FoundingSession;
  leagueName: string | null;
  apiKey: string;
  message: string;
}): Promise<TurnResult> {
  const { session, leagueName, apiKey, message } = args;

  // Map agent->assistant, commissioner->user, append the new message, and drop
  // any leading assistant turn (the seeded opening) so the array starts with a
  // user message per the Anthropic API.
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

  let tokens = 0;
  const resp = await callModel();
  tokens += (resp.usage?.input_tokens ?? 0) + (resp.usage?.output_tokens ?? 0);
  let parsed = parseAgentTurn(extractText(resp.content));
  if (!parsed) {
    // D8: one repair retry.
    const repair = await callModel({
      role: 'user',
      content:
        'Your previous reply was not valid JSON. Respond again with ONLY the JSON object {"reply":...,"intent":...,"topics_covered":[...]} and nothing else.',
    });
    tokens +=
      (repair.usage?.input_tokens ?? 0) + (repair.usage?.output_tokens ?? 0);
    parsed = parseAgentTurn(extractText(repair.content));
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

  // F3-2-B: advance to consent collection once required coverage is complete.
  next = advanceFoundingState(next);

  return { next, reply: agentReply, tokens, fallback: parsed === null };
}
