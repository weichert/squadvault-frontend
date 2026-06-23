-- 025_trophy_custody_events.sql
-- W.5 Trophy Room - Championship Package, increment 1. Design of record: engine
-- _observations/OBSERVATIONS_2026_06_21_PHASE_11_W5_TROPHY_ROOM_SPECIFICATION_INC1.md sections
-- 4 and 8.1, build brief SquadVault_EXECUTE_Brief_W5_Championship_Package_Build.md unit 1.
--
-- The custody TRANSFER ledger: an append-only record of a traveling trophy changing hands. In the
-- Championship Package only THE BELT (Group 1, traveling individual) populates this table. The Ring
-- (mint-and-keep) and the League Trophy (communal cumulative) are DERIVED reads off the championship
-- record and write nothing here (spec D1/D2). Later increments add Group-2 Live Records.
--
-- THE INVARIANT (C1): the current holder of a trophy is a DERIVED read - the latest event's
-- to_franchise per (league_id, trophy_id) - NEVER a stored mutable column. This table has no holder
-- column, no state column, no UPDATE policy, no DELETE policy. A correction is a NEW event, never an
-- edit. That append-only and derived-holder shape is proven structurally by migration 026's
-- custody_integrity_probe() (G25), the caption_separation_probe()/G24 sibling.
--
-- Manual Fact Import frame: every row is a COMMISSIONER-ratified manual fact (the Belt's per-
-- championship transfers and its historical backfill, the same dignity as oral history). ratified_by
-- is the acting commissioner, equal to auth.uid(). ratified_at is the ratification moment. Approval
-- is a publication gate, not a fact-creation step. Member and anon cannot write (RLS).
--
-- Column notes (kept out of the statement body so the SQL stays paste-safe):
--   trophy_id      - the taxonomy/Docket catalog code, NOT an FK (the taxonomy is a document, not a
--                    table). Championship Package: the Belt is 'TR-CP-1'. CHECK forbids an empty code.
--   from_franchise - the prior holder. NULL for the first/origin event (no predecessor).
--   to_franchise   - the new holder. The derived current holder is the latest event's to_franchise.
--   occasion       - the heist narrative, rendered with relish. Optional. A gap is an honest gap.
--   season/week    - the certified season (week optional) the transfer pertains to. Orders the chain.
--
-- FOUNDER-APPLIED via the Supabase SQL editor (Charter section 7). A FRESH prod object-existence
-- probe (scripts/probe_w5_preapply.ts) precedes this apply (repo-Done != prod-applied hazard). The
-- EXECUTE agent prepares and verifies, the founder applies.

CREATE TABLE IF NOT EXISTS trophy_custody_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       uuid REFERENCES leagues(id)    NOT NULL,
  trophy_id       text NOT NULL CHECK (length(trim(trophy_id)) > 0),
  from_franchise  uuid REFERENCES franchises(id),
  to_franchise    uuid REFERENCES franchises(id) NOT NULL,
  occasion        text,
  season          integer NOT NULL,
  week            integer,
  ratified_by     uuid REFERENCES auth.users(id) NOT NULL,
  ratified_at     timestamptz NOT NULL DEFAULT now()
);

-- The derived-holder and chain read: latest event per (league, trophy) by season/week/ratified_at.
CREATE INDEX IF NOT EXISTS trophy_custody_events_lookup
  ON trophy_custody_events (league_id, trophy_id, season DESC, week DESC NULLS LAST, ratified_at DESC);

-- RLS: default-deny, SELECT league-authenticated, INSERT commissioner-only. No UPDATE policy and no
-- DELETE policy means append-only via default-deny (the room_ratification_events /
-- media_display_withdrawals sibling from migration 011). Helpers is_commissioner / is_admin /
-- get_user_league_id are defined in migration 003.
ALTER TABLE trophy_custody_events ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the league see the custody history, and commissioner and admin too.
CREATE POLICY "trophy_custody_events_select" ON trophy_custody_events
  FOR SELECT USING (
    league_id = get_user_league_id()
    OR is_commissioner(league_id)
    OR is_admin()
  );

-- INSERT: commissioner-only (the Manual Fact Import frame). The ratifier is recorded as the acting
-- commissioner. No member or anon write path, and no member-request path this increment.
CREATE POLICY "trophy_custody_events_insert" ON trophy_custody_events
  FOR INSERT WITH CHECK (
    (is_commissioner(league_id) OR is_admin())
    AND ratified_by = auth.uid()
  );
-- No UPDATE and no DELETE policy: append-only by RLS default-deny. A correction is a new event.
