// src/lib/founding/voice-cards.ts
//
// Voice calibration cards — State 3 spec section 4.5. Five registers presented
// to the commissioner after COMPETITION_REGISTER is covered; the chosen card's
// key is stored as the league's voice_profile_selection.
//
// D-voice (resolved): the DB profile_key values are canonical. Cards display a
// friendly label but store the existing key — no migration. The spec section
// 4.5 register name is kept as `specName` for traceability, since three of the
// five labels diverge from the DB key string.
//
// Example outputs are deliberately generic — no franchise names, no league
// lore — because these cards are shown to a brand-new league with no record
// yet. They demonstrate the register's voice, nothing more.

import type { VoiceProfileKey } from '@/lib/supabase/types';

export interface VoiceCard {
  key: VoiceProfileKey; // stored value — the canonical DB profile_key
  specName: string; // spec section 4.5 register name (traceability)
  label: string; // friendly display label
  blurb: string; // one-line description of the register
  example: string; // short example output written in this register
}

export const VOICE_CARDS: VoiceCard[] = [
  {
    key: 'COMPETITIVE_SERIOUS',
    specName: 'SERIOUS_COMPETITOR',
    label: 'The Competitor',
    blurb:
      'Authoritative and precise. The league is treated as a real competition — praise is specific, criticism is honest, irony only when the data earns it.',
    example:
      '"The top seed was clinched with a 134-point statement win — the kind of result that ends the argument about who the team to beat is."',
  },
  {
    key: 'BALL_BUSTING_FRIENDS',
    specName: 'BALL_BUSTING_FRIENDS',
    label: 'Ball-Busting Friends',
    blurb:
      'Irreverent and sharp — affectionate brutality. Loss is comedy, the roast matters as much as the result, and the voice always punches up, never down.',
    example:
      '"Someone started a player on a bye week. Again. At this point it is less a mistake and more a personal tradition."',
  },
  {
    key: 'NOSTALGIC_HISTORIANS',
    specName: 'STORYTELLERS',
    label: 'The Storytellers',
    blurb:
      'Narrative-forward and character-driven. Each franchise has an arc, the season reads like a story, and statistics are supporting evidence rather than the point.',
    example:
      '"Three seasons after the trade everyone swore would define the decade, the two teams met again — and the story wrote itself differently this time."',
  },
  {
    key: 'CASUAL_SOCIAL',
    specName: 'FAMILY_LEAGUE',
    label: 'The Family League',
    blurb:
      'Warm, inclusive, celebratory. Written for everyone in the group, not just the diehards — accessible humor, no inside baseball, no jargon required.',
    example:
      '"It came down to the Sunday night game, and the whole group chat was watching. A great week to be part of this league."',
  },
  {
    key: 'MIXED',
    specName: 'MIXED',
    label: 'A Bit of Everything',
    blurb:
      'Context-sensitive — measured and warm by default, sharper when the moment earns it. The most flexible register, and the right call when the voice has not settled yet.',
    example:
      '"A quiet week at the top, chaos at the bottom — the standings held while three teams quietly came apart. Plenty of season left."',
  },
];

// MIXED is the recommended default for a first-year league (spec 4.5 note / 9.5):
// no season has happened yet to fix a register, and it can be revised later.
export const DEFAULT_VOICE_KEY: VoiceProfileKey = 'MIXED';
