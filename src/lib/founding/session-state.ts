// src/lib/founding/session-state.ts
//
// Commissioner Founding Session (State 3) — pure session-state helpers.
//
// Spec: Clubhouse_Commissioner_Founding_Session_State3_Spec_v1_0
//   §2.1 Core Loop (covered-topics bookkeeping; required-coverage gate)
//   §2.2 Session State Schema
//   §9.4 Session Interruption (resumption reads covered vs. remaining)
//
// DB-free and policy-free: mechanical, deterministic transforms over a
// FoundingSession row. The route/agent loop decides WHEN to apply them and
// owns persistence; this module owns HOW, correctly and immutably. Every
// mutating helper returns a new object (the session row is treated as an
// append-only record, in keeping with the constitution).

import type {
  FoundingSession,
  FoundingSessionState,
  SessionExchange,
} from '@/lib/supabase/types';
import { REQUIRED_TOPICS, type TopicId } from '@/lib/founding/protocol';

// ── State machine ──────────────────────────────────────────────────────
// State 3 is a linear progression through the four progress-dot phases
// (spec §2.2). The founding_sessions CHECK constrains the value set only,
// not the edges (unlike the approval-state trigger), so the edge invariant
// is asserted here in code rather than at the DB layer.
export const FOUNDING_STATE_TRANSITIONS: Readonly<
  Record<FoundingSessionState, readonly FoundingSessionState[]>
> = {
  IN_PROGRESS: ['CONSENT_COLLECTION'],
  CONSENT_COLLECTION: ['OUTPUT_GENERATION'],
  OUTPUT_GENERATION: ['COMPLETE'],
  COMPLETE: [],
};

export function isLegalFoundingTransition(
  from: FoundingSessionState,
  to: FoundingSessionState,
): boolean {
  return FOUNDING_STATE_TRANSITIONS[from].includes(to);
}

// ── Required-topic coverage (§2.1 step 5; §4.2) ────────────────────────
// Derived from the canonical REQUIRED_TOPICS set against covered_topics, so
// it is robust to any drift in the pending_required_topics bookkeeping list.
export function requiredTopicsRemaining(session: FoundingSession): TopicId[] {
  const covered = new Set(session.covered_topics);
  return REQUIRED_TOPICS.filter((t) => !covered.has(t));
}

export function isRequiredCoverageComplete(session: FoundingSession): boolean {
  return requiredTopicsRemaining(session).length === 0;
}

// ── Immutable mutators ─────────────────────────────────────────────────
export function markTopicCovered(
  session: FoundingSession,
  topic: TopicId,
): FoundingSession {
  const covered_topics = session.covered_topics.includes(topic)
    ? session.covered_topics
    : [...session.covered_topics, topic];
  return {
    ...session,
    covered_topics,
    pending_required_topics: session.pending_required_topics.filter(
      (t) => t !== topic,
    ),
  };
}

export function appendExchange(
  session: FoundingSession,
  exchange: Omit<SessionExchange, 'turn'>,
): FoundingSession {
  const turn = session.exchanges.length + 1;
  return {
    ...session,
    exchanges: [...session.exchanges, { ...exchange, turn }],
  };
}
