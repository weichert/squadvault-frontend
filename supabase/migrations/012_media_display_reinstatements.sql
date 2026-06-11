-- 012_media_display_reinstatements.sql
-- W.1 D5: reinstatement of a withdrawn A/V Room item. Migration 011 deliberately
-- left this as "a new class decision for a later unit, NOT an edit of the withdrawal
-- row"; this is that class. Append-only, like its sibling media_display_withdrawals:
-- a reinstatement is a NEW event that reverses a specific prior withdrawal, never an
-- edit or delete. The read-model derives display state from the LATEST event:
--   an item is withdrawn iff its latest withdrawal postdates its latest reinstatement.
--
-- league_id is carried explicitly (NOT NULL), exactly as the withdrawals sibling does,
-- so the established RLS league-scoping pattern (SELECT league / INSERT commissioner)
-- holds directly without joining through media_entries. withdrawal_id names the
-- specific withdrawal being reversed (FK), so the full history reads as a chain.
--
-- SPEC NOTE (D5, records the Increment-1 boundary): "Post-E2.3, a member-requested
-- withdrawal may not be reinstated by the commissioner alone; reinstatement of
-- member-requested withdrawals requires that member's renewed consent. Enforcement
-- lands with Increment 2; the commissioner-only Increment 1 case is self-consistent."
CREATE TABLE IF NOT EXISTS media_display_reinstatements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       uuid REFERENCES leagues(id)                   NOT NULL,
  media_entry_id  uuid REFERENCES media_entries(id),
  withdrawal_id   uuid REFERENCES media_display_withdrawals(id) NOT NULL,
  reinstated_by   uuid REFERENCES auth.users(id)                NOT NULL,
  note            text,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_display_reinstatements_lookup
  ON media_display_reinstatements (media_entry_id, recorded_at DESC);

ALTER TABLE media_display_reinstatements ENABLE ROW LEVEL SECURITY;

-- The established sibling pattern: SELECT league-authenticated; INSERT commissioner-
-- only in Increment 1 (Increment 2 adds the member-consent constraint per the spec
-- note above). No UPDATE and no DELETE policy: append-only via RLS default-deny.
CREATE POLICY "media_display_reinstatements_select" ON media_display_reinstatements
  FOR SELECT USING (
    league_id = get_user_league_id()
    OR is_commissioner(league_id)
    OR is_admin()
  );

CREATE POLICY "media_display_reinstatements_insert" ON media_display_reinstatements
  FOR INSERT WITH CHECK (is_commissioner(league_id) OR is_admin());
