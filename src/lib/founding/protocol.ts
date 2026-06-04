// src/lib/founding/protocol.ts
//
// Commissioner Founding Session (State 3) — protocol constants.
//
// Spec: Clubhouse_Commissioner_Founding_Session_State3_Spec_v1_0
//   §3 Intent Classification Schema
//   §4 Topic Pool (Required / Recommended / Opportunistic tiers)
//
// Pure data + types. No DB access, no Anthropic call, no policy. The agent
// loop and the conversation route import these as the canonical vocabulary
// for the session. WHEN to act on a topic or intent is the loop's concern;
// this module only fixes the spec's enumerations in one authoritative place.

// ── §3 Intent classes ──────────────────────────────────────────────────
// Identical set to State 1. `FoundingSession.exchanges[].intent_classified`
// is typed `string | null` in the DB types; these are the strings it holds.
export const INTENT_CLASSES = [
  'ANSWER', // §3.1 react specifically; in State 3 the answer becomes the record
  'QUESTION', // §3.2 answer completely and directly first
  'CHALLENGE', // §3.3 engage the specific challenge; do not defend the question
  'BOUNDARY', // §3.4 honor immediately; never return to the topic this session
  'TANGENT', // §3.5 follow it; mark any topics it organically covers
  'CONFUSED', // §3.6 stop and clarify fully before continuing
] as const;
export type IntentClass = (typeof INTENT_CLASSES)[number];

// ── §4 Topic pool ──────────────────────────────────────────────────────
export type TopicTier = 'REQUIRED' | 'RECOMMENDED' | 'OPPORTUNISTIC';

export const TOPICS = [
  // Required (§4.2) — must all be covered before outputs are generated.
  { id: 'LEAGUE_NAME', tier: 'REQUIRED' },
  { id: 'FOUNDING_GROUP', tier: 'REQUIRED' },
  { id: 'WHY_NOW', tier: 'REQUIRED' },
  { id: 'COMMISSIONER_ROLE', tier: 'REQUIRED' },
  { id: 'COMPETITION_REGISTER', tier: 'REQUIRED' },
  { id: 'VOICE_CALIBRATION', tier: 'REQUIRED' }, // direct selection — UI cards land at F-2
  // Recommended (§4.3) — pursue unless a BOUNDARY is flagged.
  { id: 'DRAFT_TRADITION', tier: 'RECOMMENDED' },
  { id: 'PHYSICAL_ARTIFACTS', tier: 'RECOMMENDED' },
  { id: 'LEAGUE_ORIGIN_STORY', tier: 'RECOMMENDED' },
  { id: 'COMMISSIONER_SELF_DESCRIPTION', tier: 'RECOMMENDED' },
  { id: 'LEAGUE_PERSONALITY', tier: 'RECOMMENDED' },
  { id: 'PRE_DIGITAL_HISTORY', tier: 'RECOMMENDED' }, // §9.3 may set the State 2 flag
  // Opportunistic (§4.4) — follow only if the commissioner opens the door.
  { id: 'RIVAL_PAIRS', tier: 'OPPORTUNISTIC' },
  { id: 'COMMISSIONER_VISION', tier: 'OPPORTUNISTIC' },
  { id: 'MEMORABLE_PAST_MOMENTS', tier: 'OPPORTUNISTIC' },
] as const satisfies ReadonlyArray<{ id: string; tier: TopicTier }>;

export type TopicId = (typeof TOPICS)[number]['id'];

export const REQUIRED_TOPICS: readonly TopicId[] = TOPICS.filter(
  (t) => t.tier === 'REQUIRED',
).map((t) => t.id);

const TIER_BY_ID: ReadonlyMap<TopicId, TopicTier> = new Map(
  TOPICS.map((t) => [t.id, t.tier]),
);

export function topicTier(id: TopicId): TopicTier {
  // Total over TopicId: every TopicId is a key by construction.
  return TIER_BY_ID.get(id) as TopicTier;
}
