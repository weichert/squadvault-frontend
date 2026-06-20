-- 023_media_captions.sql
-- W.1 Increment 2 member captions (spec engine 905cb1c, sections 5.2 - 5.4; scope ruling
-- D-W1I2-1,4,5). The SECOND arrival of the governed-testimony fact class (L.1 was first this
-- same day; D-W1I2-1) - a REUSE of the L.1 020 append-only-table idiom, not a new foundation.
--
-- A media_caption is a consented, attributed, append-only MEMBER account ABOUT one A/V Room
-- media item - "as remembered by [member]" - captured and DISPLAYED beside (and visibly
-- distinct from) the human-ratified provenance facts. It is NOT a provenance fact:
--
-- THE PAYLOAD (spec 6.2, the W.1-specific sharp edge vs L.1): a caption legitimately MUST
-- reference the ITEM layer (media_entries - the structural meaning of "caption ON this item"),
-- while the human-ratified FACT layer (media_provenance_tag_events) and the broader event
-- ledger stay WALLED. The caption table has NO FK, NO trigger, NO write path into the FACT
-- layer or the ledger. A remembered caption provably cannot be read as, or merged into, a
-- ratified provenance fact. That separation is proven STRUCTURALLY by migration 024's
-- caption_separation_probe() (G24): the ONLY permitted confrelid from media_captions is
-- media_entries; any FK into media_provenance_tag_events or the ledger fails the probe.

-- == The caption: one append-only row, provenance-stamped, attributed to the PERSON =========
CREATE TABLE IF NOT EXISTS media_captions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- THE ALLOWED ITEM ATTACH POINT (D-W1I2-4): a caption is ON an item. This is the only FK
  -- the separation probe permits from media_captions. league scoping for RLS is DERIVED
  -- through this parent row (the media_provenance_tag_events precedent) - no league_id column.
  media_entry_id  uuid REFERENCES media_entries(id) NOT NULL,
  -- The PERSON who remembers (auth.uid()); member-only, no commissioner proxy (D-W1I2-5).
  author_user_id  uuid REFERENCES auth.users(id)    NOT NULL,
  body            text NOT NULL,
  -- The non-strippable S1 stamp (value-pinned): a fixed-value discriminator marking every row
  -- as belonging to the member-CAPTION layer - structurally distinct from a ratified event
  -- fact. NOT NULL + a fixed-value CHECK make it non-omittable and non-spoofable. Visible to
  -- every consumer, including the G24 verifier.
  provenance      text NOT NULL DEFAULT 'MEMBER_CAPTION'
                    CHECK (provenance = 'MEMBER_CAPTION'),
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  -- A correction is a NEW superseding caption row, never an edit (append-only, invariant 6.1).
  supersedes      uuid REFERENCES media_captions(id)
);

CREATE INDEX IF NOT EXISTS media_captions_lookup
  ON media_captions (media_entry_id, recorded_at DESC);

ALTER TABLE media_captions ENABLE ROW LEVEL SECURITY;

-- SELECT: league-authenticated (members + commissioner browse captions in the room), scoped
-- THROUGH the parent media_entries row - the media_provenance_tag_events_select precedent
-- (011). The consent/withdrawal DISPLAY gate lives in the route (spec 5.6); RLS only scopes
-- read to the league. (Strict author+admin SELECT was considered and not elected, spec 5.3:
-- captions are a DISPLAYED revealing act; protection is the grant-gated display +
-- revocable-forward + withdrawal, not capture-time read denial.)
CREATE POLICY "media_captions_select" ON media_captions
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

-- INSERT: member-only (D-W1I2-5, invariant 6.5). author_user_id is the authenticated PERSON;
-- the parent item must be in the author's OWN league (get_user_league_id() resolves the
-- member's league via the franchises.member_user_id pointer). Deliberately NO is_commissioner
-- / is_admin: the commissioner cannot proxy a caption (W.6 1.3). The route enforces the
-- media_caption GRANT before INSERT (GRANT-precedes-capture; RLS gates ownership +
-- append-only, the route gates the grant - the L.1 route-enforced precedent).
CREATE POLICY "media_captions_insert" ON media_captions
  FOR INSERT WITH CHECK (
    author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM media_entries m
      WHERE m.id = media_entry_id
        AND m.league_id = get_user_league_id()
    )
  );
-- No UPDATE and no DELETE policy: append-only by RLS default-deny (the 010/020 idiom). A
-- correction is a new superseding row, never an edit.

-- == Caption display-withdrawal: REUSE media_display_withdrawals (No-New-Foundations) ========
-- Spec 5.4 / D-W1I2 reconciliation: caption display-withdrawal rides the EXISTING
-- media_display_withdrawals (011) - NO new withdrawal class. EXECUTE choice (recorded in the
-- close-out): add a nullable caption_id target column rather than overload the existing
-- nullable media_entry_id with a discriminator. Rationale: an explicit, separately-typed FK
-- target keeps the two withdrawal kinds unambiguous (an item withdrawal carries media_entry_id;
-- a caption withdrawal carries caption_id), preserves the "honor latest withdrawal per target"
-- semantics with no discriminator branching, and keeps the table append-only (no UPDATE/DELETE
-- policy is added). The existing commissioner-only INSERT policy (011) already serves the
-- commissioner "honor" path; a member-request INSERT path is deferred (not required by the
-- acceptance proof, which proves revocable-forward via consent REVOKE, not via withdrawal).
--
-- This FK points INTO media_captions (conrelid = media_display_withdrawals); it is NOT a FK
-- FROM media_captions, so it does not touch the caption_separation_probe (which asserts the
-- forbidden confrelid set for FKs whose conrelid = media_captions).
ALTER TABLE media_display_withdrawals
  ADD COLUMN IF NOT EXISTS caption_id uuid REFERENCES media_captions(id);

CREATE INDEX IF NOT EXISTS media_display_withdrawals_caption_lookup
  ON media_display_withdrawals (caption_id, recorded_at DESC);
