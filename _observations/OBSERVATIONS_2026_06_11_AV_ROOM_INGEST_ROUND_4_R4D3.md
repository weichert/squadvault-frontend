# Observations - W.1 A/V Room ingest ROUND 4: R4-D3 (duplicate detection), partial

Dated 2026-06-11. Session: Claude Code / Opus 4.8 (EXECUTE). Branch
`feat/w1-ingest-round4` off `main` at `e684292` (rounds 2+3 merged). In-spec (D-G
photo-first tooling + spec 5.1 derived-renditions reasoning); no DECIDE gate.

Round 4 is the curator's bench (8 deliverables). This memo covers the FIRST shipped
deliverable, R4-D3, filed at a deliberate pause: R4-D3 is the migration-gated piece, so
it lands independently and the founder applies migration 013 before the rest continues
(founder pacing choice this session: "pause - apply 013 + review first").

## Pre-work: merge recovery + ledger

This session also merged rounds 2 and 3 to `main` and recovered a tooling mistake worth
recording. Merging #13 with `gh pr merge 13 --merge --delete-branch` deleted
`feat/w1-ingest-ergonomics-r2`, which was the BASE of the stacked #14 - GitHub CLOSES a
PR whose base branch is deleted (it does NOT retarget it to main). #14 went CLOSED +
CONFLICTING and could not be reopened (base gone). Recovery: a fresh PR #15 from the same
head `feat/w1-ingest-round3` -> `main` (round 2 already landed, so the diff was clean, 0
conflicts), merged as `e684292`. LESSON: do not `--delete-branch` when merging the lower
PR of a stack; let GitHub retarget, delete branches only after the whole stack lands.
Rounds 2+3 then marked DISCHARGED in ROADMAP (`4d541f1`).

## R4-D3 - deterministic duplicate detection + HEIC content-sniff (`15fa5c1`)

**Migration 013** (`supabase/migrations/013_media_entries_content_hash.sql`): nullable
`content_hash` (sha256 hex) + a partial index `(league_id, content_hash) WHERE content_hash
IS NOT NULL` on the existing `media_entries`. Recorded in the migration as a CONVENIENCE,
NOT provenance - byte-identity only, never gates display, freely re-derivable, nullable
because non-essential. No new TABLE, so per the "new table = new G-test" rule there is no
new G-test; content_hash rides media_entries' existing RLS (governance stays 113/0).

**One byte read, two results (client).** `inspectFileBytes` reads the file's bytes once
and returns `{ hash, heic }`:
- `heic` from a magic-byte check (`ftyp` at offset 4, brand in
  heic/heix/hevc/heif/mif1/msf1 at offset 8) - this is the R3 click-through carry-forward
  (a HEIC renamed `.jpg` bypassed the extension gate, then failed thumbnail decode). HEIC
  is now refused by CONTENT with the honest "export as JPEG" message.
- `hash` = sha256 hex, used for duplicate detection.

**Duplicate flow.** Pre-upload, the client POSTs the hash to `/api/av-room/duplicate`
(commissioner-checked, league-scoped). On a match it throws a `DuplicateError` carrying
the existing entry id; the queue shows "Already in the record (uploaded <date>)" and an
explicit "Upload anyway" override that resubmits the SAME file with the check bypassed
(`allowDuplicate`). content_hash is stored at finalize, and `/api/av-room/hash` (GET
targets + POST) backfills the existing corpus (same shape as the thumbnail backfill).

**Graceful until 013 is applied** (the 012/G17 rhythm): the finalize insert retries
WITHOUT content_hash on undefined-column (42703) so uploads never break; the duplicate +
hash routes report `inactive`. The type carries `content_hash?` ahead of the column so
the typed client compiles.

## Founder apply-steps (R4-D3 discharges after these)

1. Apply migration 013 via the Supabase dashboard SQL editor.
2. Run "Backfill content hashes" once - the existing corpus gets hashes.
3. Click-through: re-upload an existing file -> honest refusal + "Upload anyway"; a HEIC
   renamed `.jpg` -> refused by content.

## Known follow-up (deferred, tracked)

The duplicate refusal names the existing item's DATE but not a jump-to-item LINK. A real
jump interacts with list virtualization (the target row may not be in the DOM) and
cross-component filter state; deferred to the R4 continuation rather than bolted on.

## Remaining round 4 (NOT built - next session, off main after #16)

R4-D1 quick-look (spacebar/tap lightbox, arrow-key walk of the filtered corpus, tag panel
alongside; video = poster + attestation placeholder, no player). R4-D2 download original
(signed URL, download disposition). R4-D4 tag vocabulary autocomplete (own ratified values
ONLY, never invents). R4-D5 untagged work queue (filter for tag-ABSENCE + quiet count).
R4-D6 keyboard-first flow (J/K, space, enter, shift-click range, tab order). R4-D7 retry
failed uploads (persistent named list + per-file/retry-all). R4-D8 select-all-in-filter.

Bright lines (recorded): no AI tagging/face-detection/AI-search; no gamification, streaks,
or nudges; no relevance ranking anywhere - filters/matches stay deterministic. Room
presentation = W.2. Whole-corpus export = Track L (parked).
