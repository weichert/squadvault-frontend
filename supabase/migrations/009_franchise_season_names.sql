-- supabase/migrations/009_franchise_season_names.sql
-- Season-scoped franchise team names (era-correct attribution).
--
-- A faithful frontend projection of the engine derivation
-- build_season_scoped_name_map(league_id): one row per
-- (franchise slot, season) carrying the team name AS IT EXISTED that
-- season. Consumed by the Member Office record board and by both trophy
-- surfaces (per-franchise trophy wall + the league Trophy Room) so that a
-- slot whose ownership turned over renders each season under its true
-- name rather than the current name.
--
-- This stores the TEAM NAME only. Owner identity is NOT a stored fact
-- (MFL auth gap left owner_name empty for all franchises); the surfaces
-- stay silent on owners per silence-over-speculation.
--
-- Settled history: append-only, idempotent via the unique key. No DELETE
-- policy, matching every sibling table (DB-layer append-only guarantee).

CREATE TABLE IF NOT EXISTS franchise_season_names (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id               uuid REFERENCES leagues(id) NOT NULL,
  canonical_franchise_id  text NOT NULL,
  season                  integer NOT NULL,
  team_name               text NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, canonical_franchise_id, season)
);

ALTER TABLE franchise_season_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "franchise_season_names_select" ON franchise_season_names
  FOR SELECT USING (
    league_id = get_user_league_id()
    OR is_commissioner(league_id)
    OR is_admin()
  );

CREATE POLICY "franchise_season_names_insert" ON franchise_season_names
  FOR INSERT WITH CHECK (is_commissioner(league_id) OR is_admin());

CREATE POLICY "franchise_season_names_update" ON franchise_season_names
  FOR UPDATE USING (is_commissioner(league_id) OR is_admin());

-- No DELETE policy: append-only guarantee at the DB layer.
