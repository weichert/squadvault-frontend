-- supabase/migrations/028_season_award_winners.sql
-- W.5 Increment 3 Wave B1 - per-season award winners for the Trophy Room weekly-score-derived awards
-- (the first tenant of this table - spec engine OBSERVATIONS_2026_06_23_W5_INC3_SPECIFICATION section 4.1).
-- The engine computes the per-season winner of each award off the completed-matchup stream and syncs
-- one compact row per (award, season) - or N on a tie (co-holders, C6). Engine-derived, immutable,
-- append-only - corrections happen by recompute-and-reseed, never by mutating a fact in place.
--
-- franchise_id is the engine CANONICAL code (0001..0010) as text, resolved at read time by
-- (league canonical_id, canonical_franchise_id) - no hardcoded UUID FK (the resolution the inc-2
-- pipeline adopted). value is the winning metric (a score, a margin) - null only for future
-- boolean-membership awards. detail carries optional week/opponent/runner_up for the drill-in.
--
-- Read server-side via the admin client (the trophy surface's RLS-bypass posture - no policy,
-- mirroring franchise_season_records 008). Paste-safe: no semicolons inside comments (the 025 lesson).
CREATE TABLE season_award_winners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     uuid NOT NULL REFERENCES leagues(id),
  award_id      text NOT NULL,
  season        integer NOT NULL,
  franchise_id  text NOT NULL,
  value         numeric NULL,
  detail        jsonb NULL,
  provenance    text NOT NULL DEFAULT 'engine:matchup-derived',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_saw_league_award_season_franchise UNIQUE (league_id, award_id, season, franchise_id)
);

CREATE INDEX ix_saw_league_award ON season_award_winners (league_id, award_id);
