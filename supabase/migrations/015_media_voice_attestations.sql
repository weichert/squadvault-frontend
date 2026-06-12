-- 015_media_voice_attestations.sql
-- D-W1-A (Spec 5.7 mechanism specification, ratified 2026-06-11). The voice-attestation
-- class - the OWN class satisfying spec 5.7's first playback-gate disjunct ("no member
-- voice attested by commissioner"). Option-3 (a soft tag carrying a hard gate) was
-- rejected 2026-06-10; the rejection stands. This is its own append-only event class.
--
-- The attestation is VOICE-ONLY: a human commissioner's act asserting "this video
-- contains no member's voice." It says nothing about likeness (visual presence stays
-- governed by room ratification + 2a-for-identification, the W.6 boundary). Append-only
-- like its withdrawal/reinstatement/expungement siblings: a contrary or superseding claim
-- is a NEW event, never an edit or delete. The playback gate reads the LATEST event and
-- fails closed forward the moment current state is not 'no_member_voice'.
--
-- A2a vacuous-truth exclusion (recorded for the read-model, not enforced in schema): the
-- 2b-consent gate leg is FALSE when zero members are identified. Absence of tags is not
-- evidence of absence of voices - an untagged, unattested video stays gated; the only
-- path to playback for an untagged video is the commissioner's attestation.
--
-- E2.3 forward note: the 2b-consent gate leg ('recorded_voice' grants, member_consent_
-- current) is inert-but-real until members can hold grants - it becomes live when grants
-- exist, with NO schema change here.
--
-- Sibling pattern of 012/014 exactly: league_id carried explicitly (NOT NULL) so the RLS
-- league-scoping holds directly; attested_by required (the event IS the claim). RLS
-- default-deny: SELECT league-authenticated, INSERT commissioner-only, no UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS media_voice_attestations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       uuid REFERENCES leagues(id)       NOT NULL,
  media_entry_id  uuid REFERENCES media_entries(id) NOT NULL,
  attested_state  text NOT NULL CHECK (attested_state IN ('no_member_voice', 'member_voice_present')),
  attested_by     uuid REFERENCES auth.users(id)    NOT NULL,
  note            text,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_voice_attestations_lookup
  ON media_voice_attestations (media_entry_id, recorded_at DESC);

ALTER TABLE media_voice_attestations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_voice_attestations_select" ON media_voice_attestations
  FOR SELECT USING (
    league_id = get_user_league_id()
    OR is_commissioner(league_id)
    OR is_admin()
  );

CREATE POLICY "media_voice_attestations_insert" ON media_voice_attestations
  FOR INSERT WITH CHECK (is_commissioner(league_id) OR is_admin());
-- No UPDATE and no DELETE policy: append-only by RLS default-deny.
