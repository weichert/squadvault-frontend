-- supabase/migrations/011_w1_av_room.sql
-- W.1 A/V Room four-memo chain (RATIFIED + FILED 2026-06-10, SAT #1). See engine
-- _observations/OBSERVATIONS_2026_06_10_W1_AV_ROOM_SPECIFICATION.md sections 5-6
-- and the W1_AV_Room_Contract_Card_v1_0. Increment 1 (founder/commissioner-operable
-- foundation) only; member testimony (Increment 2) is build-gated on E2.3 and is NOT
-- built here. No member-facing write path exists in this migration.
--
-- Four NEW append-only event/record classes, all governed the repo way: RLS
-- default-deny with SELECT + INSERT policies only, NO UPDATE and NO DELETE policy
-- (matching the approval_events / member_consent_events siblings). A correction is
-- a new superseding row, never an edit. Provenance "current state" is a DERIVED read
-- over the tag-event log (latest non-withdrawn event per item), never stored mutable
-- state (spec 5.3; same shape as W.6 section 1.1).
--
-- INSERT is COMMISSIONER-ONLY in Increment 1 (is_commissioner / is_admin), unlike the
-- member-only consent log: every Increment-1 write is commissioner-authored (D-W1-1(a)).
-- SELECT is league-authenticated (members browse the corpus + provenance panels).
--
-- 7.2 consent declaration (contract card): this surface READS member grants
-- (member_consent_current, migration 010) for 2a identified-display and 2b video
-- playback; it never reads founding_sessions.consent. With no member grants extant in
-- Increment 1, identified display and member-voice playback are inert by default
-- (fail-closed) exactly as the default-posture law requires. This migration builds the
-- governed schema; the gate-reading happens in the display route (separate deliverable).
--
-- Storage: a PRIVATE bucket `league-media` holds the bytes; rows here hold only the
-- storage_path. Bucket CREATION is a Supabase-side action (dashboard/CLI) = a FOUNDER
-- runtime step; the storage.objects policy at the foot of this file assumes the bucket
-- exists. There is no public read path; bytes are served via short-TTL server-issued
-- signed URLs inside the login-gated tree (spec 5.1).

-- ── media_entries (spec 5.2) ─────────────────────────────────────────────
-- One row per ingested photo/video. uploaded_by is the auth.users id of the
-- commissioner who ingested it (C3). storage_path is the object key in league-media.
CREATE TABLE IF NOT EXISTS media_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     uuid REFERENCES leagues(id)    NOT NULL,
  media_kind    text NOT NULL CHECK (media_kind IN ('photo', 'video')),
  storage_path  text NOT NULL,
  mime_type     text NOT NULL,
  uploaded_by   uuid REFERENCES auth.users(id) NOT NULL,
  upload_note   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_entries_league
  ON media_entries (league_id, created_at DESC);

-- ── media_provenance_tag_events (spec 5.3) ───────────────────────────────
-- Append-only provenance log. Current tag state for an item = latest non-superseded,
-- non-withdrawn event per tag_kind. A correction supersedes via the self-ref; honest
-- gaps stay gaps (no event = unknown, rendered as unknown). Five tag kinds:
--   contributor | date | season | event | member_identification
-- date carries a precision (exact|year|season) so honest partial dates render honestly;
-- member_identification carries the tagged member's auth id (a 2a-gated display act read
-- downstream). Two biconditionals keep the optional columns matched to their kind so
-- neither half can drift (same technique as member_consent_events_class_iff_synth).
CREATE TABLE IF NOT EXISTS media_provenance_tag_events (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_entry_id         uuid REFERENCES media_entries(id) NOT NULL,
  tag_kind               text NOT NULL CHECK (tag_kind IN (
                           'contributor',
                           'date',
                           'season',
                           'event',
                           'member_identification'
                         )),
  tag_value              text,
  date_precision         text CHECK (date_precision IN ('exact', 'year', 'season')),
  tagged_member_user_id  uuid REFERENCES auth.users(id),
  ratified_by            uuid REFERENCES auth.users(id) NOT NULL,
  note                   text,
  recorded_at            timestamptz NOT NULL DEFAULT now(),
  supersedes             uuid REFERENCES media_provenance_tag_events(id),
  -- date_precision is set iff the kind is 'date'.
  CONSTRAINT media_prov_tag_date_precision_iff_date
    CHECK ((tag_kind = 'date') = (date_precision IS NOT NULL)),
  -- tagged_member_user_id is set iff the kind is 'member_identification'.
  CONSTRAINT media_prov_tag_member_iff_identification
    CHECK ((tag_kind = 'member_identification') = (tagged_member_user_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS media_provenance_tag_events_lookup
  ON media_provenance_tag_events (media_entry_id, tag_kind, recorded_at DESC);

-- ── room_ratification_events (spec 5.4) ──────────────────────────────────
-- The fail-closed gate. The display route renders NOTHING for a league until a
-- room_ratification_event exists for it (the room is "ratified" / opened). Append-only:
-- a re-ratification (e.g. after a scope change) is a new row.
CREATE TABLE IF NOT EXISTS room_ratification_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     uuid REFERENCES leagues(id)    NOT NULL,
  ratified_by   uuid REFERENCES auth.users(id) NOT NULL,
  scope_note    text,
  recorded_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_ratification_events_league
  ON room_ratification_events (league_id, recorded_at DESC);

-- ── media_display_withdrawals (spec 5.5) ─────────────────────────────────
-- W.1 MINTS this class; later units (Increment 2 member testimony) reuse it. A current
-- withdrawal removes an item from display (the display route honors latest withdrawal
-- per item). media_entry_id is nullable so Increment 2 can target a testimony id instead;
-- league_id is carried explicitly (NOT NULL) so RLS league-scoping holds even when
-- media_entry_id is null. requested_by is who asked; ratified_by is the commissioner who
-- honored it (nullable until ratified). Append-only: a reinstatement would be a new class
-- decision for a later unit, NOT an edit of this row.
CREATE TABLE IF NOT EXISTS media_display_withdrawals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       uuid REFERENCES leagues(id)       NOT NULL,
  media_entry_id  uuid REFERENCES media_entries(id),
  requested_by    uuid REFERENCES auth.users(id)    NOT NULL,
  ratified_by     uuid REFERENCES auth.users(id),
  note            text,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_display_withdrawals_lookup
  ON media_display_withdrawals (media_entry_id, recorded_at DESC);

-- ── RLS: default-deny, SELECT league-authenticated, INSERT commissioner-only ──
-- No UPDATE policy and no DELETE policy on any of the four tables: append-only via
-- RLS default-deny (the repo's no-rewrite mechanism). Helpers is_commissioner /
-- is_admin / get_user_league_id are defined in migration 003.

ALTER TABLE media_entries                ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_provenance_tag_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_ratification_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_display_withdrawals    ENABLE ROW LEVEL SECURITY;

-- media_entries: members of the league see the corpus; commissioner ingests.
CREATE POLICY "media_entries_select" ON media_entries
  FOR SELECT USING (
    league_id = get_user_league_id()
    OR is_commissioner(league_id)
    OR is_admin()
  );

CREATE POLICY "media_entries_insert" ON media_entries
  FOR INSERT WITH CHECK (
    (is_commissioner(league_id) OR is_admin())
    -- GOVERNANCE: the ingesting commissioner is the recorded uploader; no proxy.
    AND uploaded_by = auth.uid()
  );

-- media_provenance_tag_events: scoped through the parent media_entries row (the
-- approval_events-through-artifacts precedent). SELECT league-authenticated; INSERT
-- commissioner-only, with the ratifier recorded as the acting commissioner.
CREATE POLICY "media_provenance_tag_events_select" ON media_provenance_tag_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM media_entries m WHERE m.id = media_entry_id
      AND (
        m.league_id = get_user_league_id()
        OR is_commissioner(m.league_id)
        OR is_admin()
      )
    )
  );

CREATE POLICY "media_provenance_tag_events_insert" ON media_provenance_tag_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM media_entries m WHERE m.id = media_entry_id
      AND (is_commissioner(m.league_id) OR is_admin())
    )
    AND ratified_by = auth.uid()
  );

-- room_ratification_events: SELECT league-authenticated; INSERT commissioner-only.
CREATE POLICY "room_ratification_events_select" ON room_ratification_events
  FOR SELECT USING (
    league_id = get_user_league_id()
    OR is_commissioner(league_id)
    OR is_admin()
  );

CREATE POLICY "room_ratification_events_insert" ON room_ratification_events
  FOR INSERT WITH CHECK (
    (is_commissioner(league_id) OR is_admin())
    AND ratified_by = auth.uid()
  );

-- media_display_withdrawals: SELECT league-authenticated; INSERT commissioner-only
-- in Increment 1 (Increment 2 may add a member-requested path under E2.3).
CREATE POLICY "media_display_withdrawals_select" ON media_display_withdrawals
  FOR SELECT USING (
    league_id = get_user_league_id()
    OR is_commissioner(league_id)
    OR is_admin()
  );

CREATE POLICY "media_display_withdrawals_insert" ON media_display_withdrawals
  FOR INSERT WITH CHECK (is_commissioner(league_id) OR is_admin());

-- ── Storage: private league-media bucket policy ──────────────────────────
-- The bucket itself is created out-of-band (FOUNDER runtime step; private, no public
-- policy). These policies assume `storage.objects` RLS (enabled by Supabase default).
-- Object key convention: {league_id}/{media_entry_id}/original.{ext} — the first path
-- segment is the league id, so commissioner write-scope keys off it. No SELECT policy
-- is granted to league members: bytes are NEVER served by direct client read, only by
-- short-TTL server-issued signed URLs (which bypass RLS by design). Guarded so a missing
-- bucket / pre-existing policy does not abort the migration.
DO $$
BEGIN
  -- Commissioner (or admin) may write objects into their own league's prefix.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'league_media_commissioner_insert'
  ) THEN
    CREATE POLICY "league_media_commissioner_insert" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'league-media'
        AND (
          is_commissioner((split_part(name, '/', 1))::uuid)
          OR is_admin()
        )
      );
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'storage.objects not present; skipping league-media storage policy';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'insufficient privilege for storage.objects policy; create it in the dashboard';
END $$;
