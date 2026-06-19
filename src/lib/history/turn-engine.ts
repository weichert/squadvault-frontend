// src/lib/history/turn-engine.ts
//
// L.1 Historian Interviews — the model-turn engine. Reuses the founding turn
// engine's SHAPE (one model call, one repair-retry, strict JSON-envelope parse,
// safe fallback) but is PURE of persistence: the caller maps HISTORIAN/MEMBER
// speakers to assistant/user, owns auth + the grant guard, and writes each turn
// as an INSERTed row (spec 5.2 — diverge on persistence, not logic).
//
// THROWS on an upstream API error (caller maps to 502); returns a safe fallback
// turn on parse failure (never crashes, never fabricates a classification).

import Anthropic from '@anthropic-ai/sdk';
import {
  INTENT_CLASSES,
  HISTORY_TOPICS,
  type IntentClass,
} from '@/lib/history/protocol';
import type { HistoryTopicId } from '@/lib/history/protocol';
import {
  buildHistorianSystemPrompt,
  type HistoryAgentTurn,
} from '@/lib/history/session-prompt';
import { FOUNDING_MODEL } from '@/lib/founding/config';

const VALID_TOPIC_IDS = new Set<string>(HISTORY_TOPICS.map((t) => t.id));
const VALID_INTENTS = new Set<string>(INTENT_CLASSES);

export interface HistoryTranscriptTurn {
  speaker: 'HISTORIAN' | 'MEMBER';
  content: string;
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

function parseAgentTurn(text: string): HistoryAgentTurn | null {
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
        (t): t is HistoryTopicId => typeof t === 'string' && VALID_TOPIC_IDS.has(t),
      )
    : [];
  return { reply: o.reply, intent: o.intent as IntentClass, topics_covered };
}

export interface HistoryTurnResult {
  memberIntent: IntentClass | null;
  reply: string;
  topicsCovered: HistoryTopicId[];
  tokens: number;
  fallback: boolean;
}

export async function runHistorianTurn(args: {
  transcript: HistoryTranscriptTurn[];
  memberName: string | null;
  leagueName: string | null;
  apiKey: string;
  message: string;
}): Promise<HistoryTurnResult> {
  const { transcript, memberName, leagueName, apiKey, message } = args;

  // HISTORIAN -> assistant, MEMBER -> user, then append the new member message and
  // drop any leading assistant turn (the seeded opening) so the array starts with a
  // user message per the Anthropic API.
  const history: Anthropic.MessageParam[] = transcript.map((ex) => ({
    role: ex.speaker === 'HISTORIAN' ? 'assistant' : 'user',
    content: ex.content,
  }));
  history.push({ role: 'user', content: message });
  while (history.length > 0 && history[0].role === 'assistant') history.shift();

  const anthropic = new Anthropic({ apiKey });
  const systemPrompt = buildHistorianSystemPrompt({ memberName, leagueName });
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
    // One repair retry (mirrors the founding D8 discipline).
    const repair = await callModel({
      role: 'user',
      content:
        'Your previous reply was not valid JSON. Respond again with ONLY the JSON object {"reply":...,"intent":...,"topics_covered":[...]} and nothing else.',
    });
    tokens += (repair.usage?.input_tokens ?? 0) + (repair.usage?.output_tokens ?? 0);
    parsed = parseAgentTurn(extractText(repair.content));
  }

  // Safe fallback — never crash, never fabricate a classification.
  return {
    memberIntent: parsed ? parsed.intent : null,
    reply: parsed
      ? parsed.reply
      : 'Sorry — I lost the thread for a moment. Could you say that again?',
    topicsCovered: parsed ? parsed.topics_covered : [],
    tokens,
    fallback: parsed === null,
  };
}
