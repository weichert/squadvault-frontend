// src/lib/founding/generators.ts
//
// The three founding-session output generators (State 3 spec section 7).
// Decision F3-D1: these are frontend-owned generation prompts, run server-side
// against the Anthropic API on the same path as the turn engine. All three
// outputs derive from session/Supabase data (transcript, voice selection,
// league fields) -- not from engine facts. The engine only *consumes* the
// Voice Profile later; it has no role producing any of these.
//
// This module is pure prompt construction. The API call, parse, and persistence
// live in the output-generation phase (F3-3). Each builder returns a system +
// user pair. The two prose outputs (Founding Artifact, Voice Profile) are
// emitted as prose directly; the Office Brief is emitted as a single JSON
// object matching OfficeBrief.

import type {
  ConsentRecord,
  OfficeBrief,
  SessionExchange,
  VoiceProfileKey,
} from '@/lib/supabase/types';
import { VOICE_CARDS, type VoiceCard } from '@/lib/founding/voice-cards';

export interface GeneratorPrompt {
  system: string;
  user: string;
}

export interface FoundingOutputContext {
  leagueName: string;
  foundingYear: number;
  commissionerName?: string | null;
  charterMemberCount?: number | null;
  voiceKey: VoiceProfileKey;
  consent: ConsentRecord;
  exchanges: SessionExchange[];
}

function voiceCard(key: VoiceProfileKey): VoiceCard {
  const found = VOICE_CARDS.find((c) => c.key === key);
  if (found) return found;
  const mixed = VOICE_CARDS.find((c) => c.key === 'MIXED');
  // VOICE_CARDS always contains MIXED; the fallthrow keeps the type honest.
  if (!mixed) throw new Error('VOICE_CARDS missing MIXED default');
  return mixed;
}

// Render the session transcript into a readable two-speaker block. Empty turns
// (e.g. the seeded opening before any reply) are dropped.
export function renderTranscript(exchanges: SessionExchange[]): string {
  return exchanges
    .filter((e) => e.content.trim().length > 0)
    .map((e) => `${e.role === 'agent' ? 'AGENT' : 'COMMISSIONER'}: ${e.content.trim()}`)
    .join('\n\n');
}

// The constitutional clause shared by every generator. Founding outputs are
// derived from what was said -- they never create facts, never predict, never
// fill silence with invention.
const DERIVATION_RULE = [
  'Use ONLY what the commissioner stated in this session, provided below.',
  'Do not invent names, dates, events, places, counts, or details. If something',
  'was not said, leave it out -- silence is always preferred over invention.',
  'Make no predictions or projections about how the league will turn out, and do',
  'not attribute any aspiration to SquadVault or "the Vault." You may reference a',
  'vision the commissioner expressed, clearly attributed to them, but never',
  'endorse it or imply it will come true.',
].join(' ');

function namingRule(consent: ConsentRecord): string {
  if (consent.text_likeness === 'OPT_OUT') {
    return [
      'Text-likeness consent is OFF for this league: do NOT use any member names.',
      'Refer to people by role or relationship (the founder, the commissioner, a',
      'longtime member) instead. The league name and founding year are fine.',
    ].join(' ');
  }
  return [
    'You may use member names the commissioner volunteered in the session.',
    'Use only names actually spoken; do not infer or embellish them.',
  ].join(' ');
}

// ── Output 1: League Founding Artifact (spec 7.1) ────────────────────────
// 2-3 paragraphs, third person, museum-label quality, inaugural register.
// Prose out (Markdown), no preamble, no title.
export function buildFoundingArtifactPrompt(ctx: FoundingOutputContext): GeneratorPrompt {
  const card = voiceCard(ctx.voiceKey);
  const system = [
    `You are writing the League Founding Artifact for ${ctx.leagueName} -- the first`,
    'entry in this league\'s permanent record. It will be reviewed by the commissioner',
    'and, once approved, published to the league\'s community page.',
    '',
    'FORMAT: 2 to 3 short paragraphs of third-person prose, museum-label quality.',
    'Speak ABOUT the league, never AT the commissioner (no "you"). Output ONLY the',
    'artifact prose as Markdown -- no title, no heading, no preamble, no sign-off.',
    '',
    'TONE: Inaugural. The measured weight of a first entry in an official record.',
    'Not breathless, not promotional, not a pitch. It records one true thing: that',
    'this league has been founded. It does not promise what is to come.',
    '',
    `REGISTER (${card.label}): ${card.blurb}`,
    '',
    `DERIVATION: ${DERIVATION_RULE}`,
    '',
    `NAMES: ${namingRule(ctx.consent)}`,
    '',
    'The artifact may close on the note that the record opens now and is, as yet,',
    'empty -- but do not copy any example wording; write fresh from this session.',
  ].join('\n');

  const facts: string[] = [
    `League name: ${ctx.leagueName}`,
    `Founding year: ${ctx.foundingYear}`,
    `Selected register: ${card.label}`,
  ];
  if (ctx.commissionerName) facts.push(`Commissioner: ${ctx.commissionerName}`);

  const user = [
    facts.join('\n'),
    '',
    'Founding session transcript:',
    '---',
    renderTranscript(ctx.exchanges),
    '---',
    '',
    'Write the League Founding Artifact now, drawing only on what was learned above.',
  ].join('\n');

  return { system, user };
}

// ── Output 3: League Voice Profile (spec 7.3) ────────────────────────────
// 3-4 sentences of instruction-grade prose. Commissioner-visible, never
// published. Consumed directly by the artifact-generation layer as the
// governing register. Prose out, no preamble.
export function buildVoiceProfilePrompt(ctx: FoundingOutputContext): GeneratorPrompt {
  const card = voiceCard(ctx.voiceKey);
  const isMixed = ctx.voiceKey === 'MIXED';
  const system = [
    'You are writing the League Voice Profile -- the governing register description',
    'fed directly into the artifact-generation layer for every future artifact in',
    'this league. Write it as instruction-grade prose for the future writer, not as',
    'marketing copy and not as a label.',
    '',
    'LENGTH: 3 to 4 sentences. Output ONLY the profile prose -- no preamble, no',
    'heading, no quotation marks around the whole thing.',
    '',
    'STRUCTURE (follow in order):',
    '1. Name the selected register and its primary quality.',
    '2. Describe the tone\'s relationship to competition in THIS league.',
    '3. Describe what to avoid -- the register this league is NOT.',
    '4. (Optional) One sentence flagging anything specific from the session that',
    '   should shape future artifacts (for example, a physical trophy that exists).',
    '',
    `SELECTED REGISTER (${card.specName} / ${card.label}): ${card.blurb}`,
    isMixed
      ? '\nThis is a first-year league with no established register yet. Frame the default as measured warmth that modulates sharper or more respectful as the facts earn it, and note the profile should be reviewed after Season 1.'
      : '',
    '',
    `DERIVATION: ${DERIVATION_RULE}`,
  ].join('\n');

  const user = [
    `League name: ${ctx.leagueName}`,
    `Selected register: ${card.specName} (${card.label})`,
    '',
    'Founding session transcript (for the optional session-specific sentence only):',
    '---',
    renderTranscript(ctx.exchanges),
    '---',
    '',
    'Write the League Voice Profile now.',
  ].join('\n');

  return { system, user };
}

// ── Output 2: League Office Brief (spec 7.2) ─────────────────────────────
// Structured JSON matching OfficeBrief. Applied automatically at setup;
// commissioner can request edits. JSON out, no fences, no preamble.
export const OFFICE_BRIEF_JSON_SHAPE = `{
  "theme": string,                 // short phrase, derived from competition register + session character
  "voice_calibration": string,     // MUST echo the provided voice key exactly
  "physical_artifact": string|null,// one-line Trophy Room note if a physical trophy/belt/object was described, else null
  "founding_plaque": string,       // "League established <year> by <commissioner>; <N> charter members" using only known facts
  "notes": string[]                // 1-3 short founding empty-state bullets (e.g. trophy wall labeled "Season 1 Pending", charter member seal)
}`;

export function buildOfficeBriefPrompt(ctx: FoundingOutputContext): GeneratorPrompt {
  const card = voiceCard(ctx.voiceKey);
  const system = [
    `You are producing the League Office Brief for ${ctx.leagueName} -- the visual and`,
    'tonal configuration applied to the league\'s offices at founding.',
    '',
    'Output ONLY a single JSON object, no Markdown fences and no preamble, matching',
    'this shape exactly:',
    OFFICE_BRIEF_JSON_SHAPE,
    '',
    `The voice_calibration field MUST equal "${ctx.voiceKey}" exactly.`,
    `The selected register is ${card.label}: ${card.blurb}`,
    '',
    'notes describe the founding empty-state (no seasons played yet), not future',
    'seasons. If the charter member count is unknown, omit it from the plaque rather',
    'than guessing.',
    '',
    `DERIVATION: ${DERIVATION_RULE}`,
  ].join('\n');

  const facts: string[] = [
    `League name: ${ctx.leagueName}`,
    `Founding year: ${ctx.foundingYear}`,
    `Voice key: ${ctx.voiceKey}`,
  ];
  if (ctx.commissionerName) facts.push(`Commissioner: ${ctx.commissionerName}`);
  if (ctx.charterMemberCount != null) facts.push(`Charter members: ${ctx.charterMemberCount}`);

  const user = [
    facts.join('\n'),
    '',
    'Founding session transcript:',
    '---',
    renderTranscript(ctx.exchanges),
    '---',
    '',
    'Produce the League Office Brief JSON now.',
  ].join('\n');

  return { system, user };
}

// Parse target for F3-3: the Office Brief envelope is exactly OfficeBrief.
export type OfficeBriefEnvelope = OfficeBrief;
