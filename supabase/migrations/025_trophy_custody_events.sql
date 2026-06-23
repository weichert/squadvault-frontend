-- 025_trophy_custody_events.sql
-- W.5 Trophy Room - Championship Package, increment 1 (design of record: engine
-- _observations/OBSERVATIONS_2026_06_21_PHASE_11_W5_TROPHY_ROOM_SPECIFICATION_INC1.md, sections
-- 4 + 8.1; build brief SquadVault_EXECUTE_Brief_W5_Championship_Package_Build.md unit 1).
--
-- The custody TRANSFER ledger: an append-only record of a traveling trophy changing hands. In the
-- Championship Package only THE BELT (Group 1, traveling individual) populates this table - the Ring
-- (mint-and-keep) and the League Trophy (communal cumulative) are DERIVED reads off the championship
-- record and write nothing here (spec D1/D2). Later increments add Group-2 Live Records.
--
-- THE INVARIANT (C1): the current holder of a trophy is a DERIVED read - the latest event's
-- to_franchise per (league_id, trophy_id) - NEVER a stored mutable column. This table has NO holder
-- column, NO state column, NO UPDATE policy, NO DELETE policy. A correction is a NEW event, never an
-- edit. That append-only + derived-holder shape is proven structurally by migration 026's
-- custody_integrity_probe() (G25), the caption_separation_probe()/G24 sibling.
--
-- Manual Fact Import frame: every row is a COMMISSIONER-ratified manual fact (the Belt's per-
-- championship transfers and its historical backfill - "same dignity as oral history"). ratified_by
-- is the acting commissioner (= auth.uid()); ratified_at is the ratification moment. Approval is a
-- publication gate, not a fact-creation step. Member/anon cannot write (RLS).
--
-- FOUNDER-APPLIED via the Supabase SQL editor (Charter section 7): a FRESH prod object-existence
-- probe (scripts/probe_w5_preapply.ts) precedes this apply (repo-Done != prod-applied hazard). The
-- EXECUTE agent prepares + verifies; the founder applies.

CREATE TABLE IF NOT EXISTS trophy_custody_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       uuid REFERENCES leagues(id)    NOT NULL,
  -- The trophy this event concerns, by its taxonomy/Docket catalog code (NOT an FK: the taxonomy is
  -- a ratified document, not a table). Championship Package: the Belt = 'TR-CP-1'. A non-empty code.
  trophy_id       text NOT NULL CHECK (length(trim(trophy_id)) > 0),
  -- The prior holder. NULL for the first/origin event (the trophy's inception has no predecessor).
  from_franchise  uuid REFERENCES franchises(id),
  -- The new holder. The DERIVED current holder = the latest event's to_franchise (multi-valued only
  -- where a future Group-2 record is co-held; the Belt is single-holder). NOT NULL: an event always
  -- moves the trophy TO someone.
  to_franchise    uuid REFERENCES franchises(id) NOT NULL,
  -- The occasion / heist narrative, rendered with relish on the provenance chain. Optional; a gap is
  -- an honest gap (silence over speculation), never an invented story.
  occasion        text,
  -- The certified season the transfer pertains to; week is optional (season-grain transfers carry no
  -- week). Used to order the chain and render "since 2025 W9".
  season          integer NOT NULL,
  week            integer,
  -- The acting commissioner (the ratifier); the manual-fact author. = auth.uid() (RLS-enforced).
  ratified_by     uuid REFERENCES auth.users(id) NOT NULL,
  ratified_at     timestamptz NOT NULL DEFAULT now()
);

-- The derived-holder + chain read: latest event per (league, trophy) by season/week/ratified_at.
CREATE INDEX IF NOT EXISTS trophy_custody_events_lookup
  ON trophy_custody_events (league_id, trophy_id, season DESC, week DESC NULLS LAST, ratified_at DESC);

-- ── RLS: default-deny, SELECT league-authenticated, INSERT commissioner-only ──────────────
-- No UPDATE policy and no DELETE policy: append-only via RLS default-deny (the repo's no-rewrite
-- mechanism; the room_ratification_events / media_display_withdrawals sibling from migration 011).
-- Helpers is_commissioner / is_admin / get_user_league_id are defined in migration 003.
ALTER TABLE trophy_custody_events ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the league see the custody history (the Trophy Room is a league-authenticated
-- display surface); commissioner + admin too.
CREATE POLICY "trophy_custody_events_select" ON trophy_custody_events
  FOR SELECT USING (
    league_id = get_user_league_id()
    OR is_commissioner(league_id)
    OR is_admin()
  );

-- INSERT: commissioner-only (the Manual Fact Import frame). The ratifier is recorded as the acting
-- commissioner; no member or anon write path. There is NO member-request path this increment.
CREATE POLICY "trophy_custody_events_insert" ON trophy_custody_events
  FOR INSERT WITH CHECK (
    (is_commissioner(league_id) OR is_admin())
    AND ratified_by = auth.uid()
  );
-- No UPDATE and no DELETE policy: append-only by RLS default-deny. A correction is a new event.
