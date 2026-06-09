-- supabase/migrations/008_franchise_season_records.sql
-- Per-franchise, per-season record board facts for the Member Office (Design Brief 7.5).
-- Engine-derived, immutable: W-L-T and points-for per (franchise, season), plus the
-- exactly-provable playoff result tier (CHAMPION / RUNNER_UP). No final rank or granular
-- playoff finish: never ingested, not exactly derivable, omitted per silence-over-speculation.

CREATE TABLE franchise_season_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     uuid NOT NULL REFERENCES leagues(id),
  franchise_id  uuid NOT NULL REFERENCES franchises(id),
  season        integer NOT NULL,
  wins          integer NOT NULL,
  losses        integer NOT NULL,
  ties          integer NOT NULL DEFAULT 0,
  points_for    numeric(8,2) NOT NULL,
  result        text NOT NULL DEFAULT '' CHECK (result IN ('', 'CHAMPION', 'RUNNER_UP')),
  provenance    text NOT NULL DEFAULT 'engine:matchup-derived',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_fsr_league_franchise_season UNIQUE (league_id, franchise_id, season)
);

CREATE INDEX ix_fsr_league_franchise ON franchise_season_records (league_id, franchise_id);
