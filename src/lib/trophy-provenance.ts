// src/lib/trophy-provenance.ts
// W.5 Trophy Room - the shared provenance label/style module (spec section 6; flagged for
// extraction in the Trophy Room tighten memo). Both the shipped championship list and the
// Championship Package band consume ONE source so a trust label means the same thing everywhere.
// The display-provenance axis is distinct from the custody axis (spec D1): COMMISSIONER_ATTESTED =
// a manually-ratified fact (the Belt's custody events); CANONICAL = derived from engine-certified
// facts (the Ring + League Trophy, derived off the championship record); DEMO = staging demo data.
import type { TrophyProvenance } from '@/lib/supabase/types';

export const PROVENANCE_LABEL: Record<TrophyProvenance, string> = {
  CANONICAL:             'ENTERED INTO THE RECORD',
  COMMISSIONER_ATTESTED: 'COMMISSIONER ATTESTED',
  DEMO:                  'DEMO',
};

export const PROVENANCE_STYLE: Record<
  TrophyProvenance,
  { color: string; borderColor: string }
> = {
  CANONICAL:             { color: '#8B7035', borderColor: 'rgba(139, 112, 53, 0.5)' },
  COMMISSIONER_ATTESTED: { color: '#3B7A7A', borderColor: 'rgba(59, 122, 122, 0.5)' },
  DEMO:                  { color: '#8B6E2A', borderColor: 'rgba(139, 110, 42, 0.5)' },
};
