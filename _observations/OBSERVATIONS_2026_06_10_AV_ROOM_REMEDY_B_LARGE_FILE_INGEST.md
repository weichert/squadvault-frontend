# Observations - W.1 large-file ingest, remedy B build (client-direct under server-minted grant)

Dated 2026-06-10. Session: Claude Code / Opus 4.8 (EXECUTE). Branch
`feat/w1-large-file-ingest-remedy-b` off `main` at `ad80a51`.
Brief: `_observations/session_brief_2026_06_10_w1_large_file_ingest_remedy_b_build.md`.
Ruling + Spec 5.1 Amendment 1: `_observations/OBSERVATIONS_2026_06_10_DW1V1_RULING_REMEDY_B.md`.

## What shipped (one topic per commit)

- **D-B5 - 1 GB ceiling** (`0fe61c8`). `MAX_UPLOAD_BYTES = 1 GiB`; added `MAX_UPLOAD_LABEL`
  ("1 GB") + a GB/MB-aware `formatSize` so copy reads "1 GB" not "1024 MB".
- **D-B1 - grant-mint route** (`ba640c4`). New `POST /api/av-room/upload/grant`: same
  commissioner authorization as the old passthrough, mints `mediaEntryId` + the
  server-chosen path `{leagueId}/{mediaEntryId}/original.{ext}`, issues a single-use
  signed upload grant via `createSignedUploadUrl`. Declared-size >1 GB rejected 413 before
  minting. Shared mime/ext/kind helpers lifted into `src/lib/av-room.ts`.
- **D-B3 - finalize route** (`25ba78e`). New `POST /api/av-room/upload/finalize`: re-verify
  commissioner, RE-DERIVE the path server-side (client path never trusted), confirm the
  object exists, append the `media_entries` row via the authed client (RLS-backed), then
  write the video poster sibling (best-effort, D3). Orphan reap: failed non-duplicate
  finalize reaps the object(s); duplicate finalize (`23505`) is treated as already-finalized
  and does NOT reap.
- **D-B2 - client cutover** (`37daac5`). UploadForm runs the 3-step flow (grant ->
  `uploadToSignedUrl` original client-direct -> finalize w/ poster part); direct-upload
  errors surface a specific reason. The old passthrough `POST /api/av-room/upload` is
  REMOVED. `MAX_UPLOAD_MB` dropped (unused).
- **D-B4 - G16 security test** (`2f2fa0c`). Storage defense-in-depth: a service-role probe
  confirms the bucket exists (skip, not false-pass, if absent), then anon is denied a direct
  write into league-media (own demo prefix + an arbitrary other prefix).

## Gates

- `npm run type-check` clean; `npm run build` compiled, no warnings (routes present:
  `/api/av-room/upload/grant`, `/api/av-room/upload/finalize`; passthrough gone).
- `npm run test:governance`: **112 passed, 0 failed** (110 + 2 G16 assertions).

## Invariants held (Spec 5.1 Amendment 1)

- (a)/(b) **boundary relocated**: the grant route's commissioner check + server-chosen path
  are the write boundary now (a signed-upload token authorizes its own write; it does not
  ride storage.objects RLS). The client never names paths.
- (c) the `media_entries` INSERT stays server-side via the authed client (RLS-backed),
  finalizing only after upload.
- (d) **pre-record orphan**: an uploaded-but-unfinalized object is unreferenced, invisible,
  reapable; append-only begins at the record, not the byte.
- (e) original stored unmodified (6.9); poster is a separate sibling.
- (f) signed-URL read path + no public policy unchanged (sign route untouched).

## Honest coverage boundary (flagged, not hidden)

- G16 covers the **storage RLS defense-in-depth** layer (anon write denial). The PRIMARY
  remedy-B guarantee - a commissioner of league X cannot MINT a grant for league Y - is
  enforced in the grant route by `isLeagueCommissioner(leagueId)` + the server-chosen path,
  which is an authenticated-ROUTE assertion. The governance harness is anon-only by design
  (its own G10-G15 notes say so), so that route-level path is covered by code + the shared
  `isLeagueCommissioner` helper (DB-tested) and the founder click-through, NOT by an
  automated authed-HTTP test. Standing the harness up with auth sessions would be its own
  unit; not done here.

## Carry-forwards

- **Founder click-through (required before merge-confidence)**: upload a >4.5 MB photo and
  a large video; both land end-to-end; the video shows its poster in the room; the original
  downloads byte-identical; nothing plays. (This also discharges the parallel 413 photo
  corollary check - B is the fix.)
- **Straggler orphan reaper**: the immediate reap (finalize failure) is implemented. The
  mint+upload-but-never-finalize case is DOCUMENTED as an ops hygiene sweep (list league-media
  prefixes, remove any whose `media_entry_id` is absent from `media_entries`), not a
  request-path concern. If abandoned uploads prove common, promote the sweep to a scheduled job.
- **Grant TTL**: `createSignedUploadUrl` grants are single-use; the TTL is the supabase-js
  default (not set explicitly). If a shorter window is wanted, confirm whether the installed
  version exposes a TTL option and set it.

## Out of scope (untouched, per brief)

- Video playback + voice-attestation class (Fable-spec-first; option-3 rejected).
- Member testimony / Increment 2 (gated E2.3). No storage RLS policy change (none needed).
