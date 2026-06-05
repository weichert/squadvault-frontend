// src/lib/founding/resume-orientation.ts
// Deterministic resume orientation (spec section 9.4). On resuming an
// interrupted founding session into the conversational phase, orient the
// commissioner from session state alone -- no model call, no consumed
// exchange, not written to the transcript. Count looking back (compact,
// avoids overclaiming depth on any one topic), named looking forward (the
// single high-value cue: the next required topic). Required topics are the
// stable spec enumeration from protocol.ts; the labels below are the one
// authoritative UI mapping for them.
import { REQUIRED_TOPICS, type TopicId } from '@/lib/founding/protocol';

const REQUIRED_TOPIC_LABELS: Partial<Record<TopicId, string>> = {
  LEAGUE_NAME: "the league's name",
  FOUNDING_GROUP: "who's in it",
  WHY_NOW: 'why now',
  COMMISSIONER_ROLE: 'your role as commissioner',
  COMPETITION_REGISTER: "the league's competitive tone",
  VOICE_CALIBRATION: "the league's voice",
};

export function foundingResumeOrientation(
  coveredTopics: readonly string[],
): string {
  const covered = new Set(coveredTopics);
  const total = REQUIRED_TOPICS.length;
  const coveredCount = REQUIRED_TOPICS.filter((t) => covered.has(t)).length;
  const next = REQUIRED_TOPICS.find((t) => !covered.has(t));
  if (!next) {
    return `Picking up where you left off. All ${total} essentials covered.`;
  }
  const label = REQUIRED_TOPIC_LABELS[next] ?? 'the next topic';
  return `Picking up where you left off. ${coveredCount} of ${total} essentials covered — next: ${label}.`;
}
