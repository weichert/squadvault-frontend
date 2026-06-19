-- 021_testimony_separation_probe.sql
-- L.1 Historian Interviews, capture-only first wave (S2, RATIFIED 2026-06-19; spec engine
-- c9d32d5, sections 5.5 + 6.2). The structural proof of THE PAYLOAD: testimony provably
-- cannot be read as, or merged into, an event fact. This is the L.1 analogue of L.3's
-- vault_seal_probe() / G22 - the inverse-of-G11 discipline (a MISSING object FAILS, never a
-- vacuous pass).
--
-- pg_constraint / pg_trigger (pg_catalog) are NOT reachable via PostgREST, so the governance
-- harness (G23) cannot assert "no FK/trigger to the ledger" directly. This SECURITY DEFINER
-- helper reads the catalog and returns BOOLEANS ONLY (no testimony content). It asserts:
--   (i)   both testimony tables exist;
--   (ii)  member_history_exchanges.provenance is present AND NOT NULL (the non-strippable
--         S1 stamp);
--   (iii) NO foreign key from either testimony table references a fact/event-bearing table
--         (the frontend realization of "the canonical events ledger": artifacts,
--         artifact_versions, approval_events, franchise_season_records, trophy_room_entries) -
--         i.e. there is no structural write path from testimony INTO the ledger;
--   (iv)  NO user-defined trigger fires on either testimony table (no trigger can copy a
--         remembered datum into a fact table);
--   (v)   a MISSING object -> the existence booleans are FALSE, so G23 fails closed.
--
-- This is the bounded, provable structural claim (mirroring vault_seal_probe's bounded
-- approach): the separation is enforced by SCHEMA, not by prompt guardrail.
CREATE OR REPLACE FUNCTION testimony_separation_probe()
RETURNS TABLE (
  sessions_table_exists   boolean,
  exchanges_table_exists  boolean,
  provenance_not_null     boolean,
  no_ledger_fk            boolean,
  no_triggers             boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT
    to_regclass('public.member_history_sessions')  IS NOT NULL,
    to_regclass('public.member_history_exchanges') IS NOT NULL,
    COALESCE((
      SELECT a.attnotnull
      FROM pg_attribute a
      WHERE a.attrelid = to_regclass('public.member_history_exchanges')
        AND a.attname = 'provenance'
        AND a.attnum > 0
        AND NOT a.attisdropped
    ), false),
    NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.conrelid IN (
          to_regclass('public.member_history_sessions'),
          to_regclass('public.member_history_exchanges')
        )
        AND c.confrelid IN (
          to_regclass('public.artifacts'),
          to_regclass('public.artifact_versions'),
          to_regclass('public.approval_events'),
          to_regclass('public.franchise_season_records'),
          to_regclass('public.trophy_room_entries')
        )
    ),
    NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid IN (
          to_regclass('public.member_history_sessions'),
          to_regclass('public.member_history_exchanges')
        )
        AND NOT t.tgisinternal
    );
$$;
