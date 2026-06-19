// src/lib/history/protocol.ts
//
// L.1 Historian Interviews (capture-only first wave) — protocol constants.
//
// Spec: engine OBSERVATIONS_2026_06_19_PHASE_11_L1_SPECIFICATION (c9d32d5)
//   section 5.1 (reuse the founding intent classes + turn-engine shape)
//   section 5.6 (member-memory topic pool; NO hard required-coverage gate)
//
// Pure data + types. The intent vocabulary is REUSED verbatim from the founding
// session (composition, not a fork) — the same six classes apply to a member
// recounting league memory. What diverges is the TOPIC pool (member memory, not
// league founding) and the PERSISTENCE (per-turn append, handled by the route).

// ── Intent classes — reused from the founding protocol (spec 5.1) ───────
export { INTENT_CLASSES, type IntentClass } from '@/lib/founding/protocol';
import type { TopicTier } from '@/lib/founding/protocol';
export type { TopicTier } from '@/lib/founding/protocol';

// ── Provenance stamp (S1) ──────────────────────────────────────────────
// The non-strippable discriminator written on every exchange row, marking it as
// belonging to the oral-history TESTIMONY layer — structurally distinct from an
// event fact (spec 5.4). Mirrors the DB column default + CHECK in migration 020.
export const TESTIMONY_PROVENANCE = 'MEMBER_TESTIMONY' as const;

// ── Member-memory topic pool (spec 5.6) ────────────────────────────────
// Re-authored for member memory from the DoR seeds (how-they-joined, a
// championship, the 0-14 season, the trade everyone argues about). EVERY topic is
// RECOMMENDED or OPPORTUNISTIC — there is NO REQUIRED tier and NO hard
// required-coverage gate (member autonomy + BOUNDARY + silence-over-speculation).
// Coverage is descriptive bookkeeping (topic_covered on the exchange), never a
// progression gate. FOUNDER-RATIFICATION of the exact pool content is pending
// (spec 7 / 12.3); because nothing gates on it, the seeds stand until ratified.
export const HISTORY_TOPICS = [
  { id: 'HOW_THEY_JOINED', tier: 'RECOMMENDED' },
  { id: 'A_CHAMPIONSHIP', tier: 'RECOMMENDED' },
  { id: 'THE_WORST_SEASON', tier: 'RECOMMENDED' }, // the 0-14 season
  { id: 'THE_DISPUTED_TRADE', tier: 'RECOMMENDED' }, // the trade everyone argues about
  { id: 'A_RIVALRY', tier: 'RECOMMENDED' },
  { id: 'A_DRAFT_MEMORY', tier: 'OPPORTUNISTIC' },
  { id: 'A_LEAGUE_TRADITION', tier: 'OPPORTUNISTIC' },
  { id: 'A_MEMBER_WHO_LEFT', tier: 'OPPORTUNISTIC' },
] as const satisfies ReadonlyArray<{ id: string; tier: TopicTier }>;

export type HistoryTopicId = (typeof HISTORY_TOPICS)[number]['id'];
