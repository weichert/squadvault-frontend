-- 014_media_expungement_events.sql
-- D-W1-E1 (Spec 5.2 Amendment 1, ratified 2026-06-11). Media EXPUNGEMENT - the RULED
-- EXCEPTION to byte immutability. Removal-from-display is a withdrawal event (012);
-- EXPUNGEMENT is a different, TERMINAL event that deletes the stored bytes (original +
-- renditions) and TOMBSTONES the entry: the row is never deleted, and this append-only
-- log permanently records that an item existed and was expunged (when / by whom / why).
--
-- No reinstatement path exists or ever will for this class - reinstating content whose
-- bytes are gone is incoherent (terminal by design). content_hash survives on
-- media_entries, so a re-upload of expunged content surfaces as a duplicate-of-expunged
-- and requires explicit override. Expunged items render nowhere except an explicit ingest
-- filter showing the tombstone.
--
-- Post-E2.3 a consent dimension attaches (member-requested expungement; commissioner-
-- initiated expungement of member-likeness media), adjudicated with Increment 2. Until
-- then the class is commissioner-only and self-consistent.
--
-- Sibling pattern of 012: league_id carried explicitly (NOT NULL) so the established RLS
-- league-scoping holds directly; reason is REQUIRED (NOT NULL). Append-only via RLS
-- default-deny: SELECT league-authenticated, INSERT commissioner-only, no UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS media_expungement_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       uuid REFERENCES leagues(id)       NOT NULL,
  media_entry_id  uuid REFERENCES media_entries(id) NOT NULL,
  reason          text                              NOT NULL,
  expunged_by     uuid REFERENCES auth.users(id)    NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_expungement_events_lookup
  ON media_expungement_events (media_entry_id, recorded_at DESC);

ALTER TABLE media_expungement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_expungement_events_select" ON media_expungement_events
  FOR SELECT USING (
    league_id = get_user_league_id()
    OR is_commissioner(league_id)
    OR is_admin()
  );

CREATE POLICY "media_expungement_events_insert" ON media_expungement_events
  FOR INSERT WITH CHECK (is_commissioner(league_id) OR is_admin());
-- No UPDATE and no DELETE policy: append-only by RLS default-deny.
