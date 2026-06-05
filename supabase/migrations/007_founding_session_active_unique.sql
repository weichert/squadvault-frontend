-- 007_founding_session_active_unique.sql
-- F4-B2. At most one in-flight founding session per league. COMPLETE sessions
-- are excluded so the append-only history of past founding sessions can
-- accumulate (re-running founding preserves prior sessions). Hardens the
-- former application-only resume guard at the DB layer.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_founding_sessions_active_per_league
  ON founding_sessions (league_id)
  WHERE state <> 'COMPLETE';
