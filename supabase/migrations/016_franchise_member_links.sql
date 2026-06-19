-- 016_franchise_member_links.sql
-- E2.3-minimal (D-SEQ-2, ruled in the Fable DECIDE session 2026-06-12). The
-- member<->franchise LINKAGE as a commissioner-ratified, append-only FACT.
--
-- franchises.member_user_id has existed since 001, but nothing in the app ever
-- wrote it - linkage was an out-of-band column edit with no provenance. This class
-- makes the linkage a GOVERNED event: never self-asserted by the member, always
-- the commissioner's ratification. The commissioner asserts the pairing (the act of
-- issuing the magic-link invite binds the franchise to the invited user_id); the
-- member only authenticates. A correction is a NEW event, never an edit.
--
-- DERIVED current state: the latest event per franchise is the current linkage
-- (supersession-by-append, the voice-attestation 015 idiom). franchises.member_user_id
-- remains the derived current pointer the invite route maintains so existing readers
-- keep working unchanged - the 2a identification gate (av-room loadRoomState),
-- member_consent_events scoping, and get_user_league_id() all read that column.
--
-- Sibling pattern of 012/014/015 exactly: league_id carried explicitly (NOT NULL) so
-- the established RLS league-scoping holds directly; linked_by required (the event IS
-- the commissioner's ratification); member_user_id NOT NULL (the event binds a specific
-- person - an "unlink" is out of scope for E2.3-minimal). RLS default-deny: SELECT
-- league-authenticated, INSERT commissioner-only, no UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS franchise_member_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       uuid REFERENCES leagues(id)     NOT NULL,
  franchise_id    uuid REFERENCES franchises(id)  NOT NULL,
  member_user_id  uuid REFERENCES auth.users(id)  NOT NULL,
  linked_by       uuid REFERENCES auth.users(id)  NOT NULL,
  note            text,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS franchise_member_links_lookup
  ON franchise_member_links (franchise_id, recorded_at DESC);

ALTER TABLE franchise_member_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "franchise_member_links_select" ON franchise_member_links
  FOR SELECT USING (
    league_id = get_user_league_id()
    OR is_commissioner(league_id)
    OR is_admin()
  );

CREATE POLICY "franchise_member_links_insert" ON franchise_member_links
  FOR INSERT WITH CHECK (is_commissioner(league_id) OR is_admin());
-- No UPDATE and no DELETE policy: append-only by RLS default-deny.
