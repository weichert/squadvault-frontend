# Session brief - W.1 large-file ingest, remedy B build (client-direct under server-minted grant)

Authored: 2026-06-10. Target tool/model: Claude Code / Opus 4.8 (EXECUTE). This is a
section-5 execution brief transcribed from a FOUNDER-RATIFIED ruling (D-W1-V1 = remedy B,
Spec 5.1 Amendment 1), so the acceptance criteria are binding, not a draft. Authoring note:
drafted in Claude Code at founder instruction; the scope it encodes is ratified.

## Verified HEAD at authoring

- Frontend `weichert/squadvault-frontend` main = `75e25d2` (PR #8) at the start of the
  filing series; the ruling memo + ledger + this brief land in that same series (PR open).
  VERIFY at session start: `git -C ~/squadvault log --oneline -1` and confirm the ruling
  memo `_observations/OBSERVATIONS_2026_06_10_DW1V1_RULING_REMEDY_B.md` is on main. If git
  disagrees, git wins - flag before executing (charter 3.4).

## Authority

- **D-W1-V1 RULED REMEDY B**; **Spec 5.1 Amendment 1** ratified 2026-06-10. Both VERBATIM in
  `_observations/OBSERVATIONS_2026_06_10_DW1V1_RULING_REMEDY_B.md` - read it first. The
  amendment moves the write boundary from the storage INSERT policy to the **mint route's
  commissioner check + server-chosen path**; honor clauses (a)-(f) exactly.

## Already done (with hashes - do NOT redo)

- Inc 1 foundation + hardening: `c21e858`->`65da2e6` (PR #2); D1 `7601f8c`, D2 `b97b19c`,
  D3 `99dafc0`, hardening merge `2367479`. `MAX_UPLOAD_BYTES` single source in
  `src/lib/av-room-limits.ts`. D3 poster extraction `extractPosterBlob` lives in
  `src/components/av-room/ingest-panel.tsx`.
- Supabase per-file cap ALREADY raised to **1 GB** (founder, dashboard, Pro plan,
  2026-06-10). No founder dashboard action remains for the cap.
- Storage write policy `league_media_commissioner_insert`
  (`supabase/migrations/011_w1_av_room.sql:213`) keys off the `{league_id}/...` prefix.

## Why B (one line, for the executor)

The real ceiling is Vercel's **unconfigurable 4.5 MB function body limit** (413 at the edge),
not the Supabase cap. The current passthrough (`src/app/api/av-room/upload/route.ts`) routes
EVERY original - photo and video - through the function, so it caps both at 4.5 MB in prod.
B routes the original direct-to-Storage; it retires that ceiling for photos and video alike.

## Deliverables + binary acceptance criteria

### D-B1 - grant-mint route (REQUIRED)
- New: `src/app/api/av-room/upload/grant/route.ts` (POST). Re-uses the upload route's
  commissioner authorization (clause a). Mints `mediaEntryId` server-side, derives the
  server-chosen path `{leagueId}/{mediaEntryId}/original.{ext}` (clause b - client never
  names paths), and issues a single-use signed upload grant via
  `createSignedUploadUrl(path)` (admin client). Returns `{ mediaEntryId, path, token }`
  (and the signed URL). Set a short TTL if the API exposes it; otherwise document the
  default and rely on single-use + the path scoping as the controls.
- ACCEPT: a non-commissioner (or a commissioner naming a `leagueId` they do not commission)
  gets **403 and NO grant is minted**; a commissioner gets a token scoped to a server-chosen
  path under THEIR league prefix; `mediaEntryId` is server-minted; the client supplies NO path.

### D-B2 - client direct upload, poster retained (REQUIRED)
- `src/components/av-room/ingest-panel.tsx` UploadForm: replace the single passthrough POST
  with the B flow - (1) POST `/api/av-room/upload/grant`; (2) `uploadToSignedUrl(path, token,
  file)` to put the ORIGINAL (any kind) direct to Storage; (3) POST the finalize route.
  KEEP `extractPosterBlob`: for a video, extract the poster and send it as the `poster` part
  to the finalize route (the poster is tiny, well under 4.5 MB, so it may transit the
  function). D1 client size pre-check stays, now at the 1 GB ceiling.
- ACCEPT: uploading a >4.5 MB original (photo OR video) succeeds end-to-end; the bytes go
  direct-to-Storage (visible in the network trace as a Storage PUT, not a function POST); a
  video still yields a `poster.jpg` sibling; the failure-reason UX (D2) still renders.

### D-B3 - finalize route, insert-after-upload + orphan reap (REQUIRED)
- New: `src/app/api/av-room/upload/finalize/route.ts` (POST). Re-verify commissioner;
  RE-DERIVE the expected path from `{leagueId}/{mediaEntryId}` server-side (do NOT trust a
  client-supplied path); confirm the uploaded object exists at that path; INSERT the
  `media_entries` row via the authed client (clause c, RLS-backed), finalizing only after
  upload; then write `poster.jpg` (video, best-effort, as in D3). The old passthrough route
  `src/app/api/av-room/upload/route.ts` is REMOVED (every original now goes via B).
- Orphan model (clause d): an uploaded object with no finalized row is a **pre-record orphan**
  - unreferenced, invisible (no SELECT policy; only row-derived signed URLs), reapable.
  Reap rule: (i) on finalize-insert failure, immediately remove the just-uploaded
  object(s) (the existing rollback pattern); (ii) define a hygiene sweep for stragglers
  (objects with no matching `media_entries` row, older than the grant TTL) - implement a
  minimal reaper or document the exact trigger + query. Append-only is untouched: it begins
  at the record, not the byte.
- ACCEPT: a row is created ONLY after the object exists; the original is byte-unchanged (6.9);
  a deliberately abandoned upload (mint+upload, no finalize) leaves an object with no row that
  the reap rule removes (or is documented as removable); `tsc` + `next build` clean.

### D-B4 - cross-league mint security test (REQUIRED)
- `scripts/test-governance.ts`: add a planted test (next G-id, e.g. G16) proving the
  relocated boundary. Assert: (a) the grant route denies a non-commissioner and a
  cross-league commissioner (403, no grant); (b) the minted path is always under the
  caller's own league prefix; (c) the existing `league_media_commissioner_insert` still
  denies a raw authed-client write into another league's prefix (defense in depth). No raw
  service-role secret in the test beyond what the suite already uses.
- ACCEPT: the planted cross-league mint attempt is denied; **the full governance suite is
  GREEN** (existing 110 + the new assertions). If any storage RLS policy must CHANGE to make
  token uploads work, STOP and re-scope (that is a policy-touch signal, escalation rule 7).

### D-B5 - raise the honest ceiling (REQUIRED)
- `src/lib/av-room-limits.ts`: `MAX_UPLOAD_BYTES = 1073741824` (1 GB) - the new honest
  ceiling matching the raised Supabase cap. D1 client pre-check and D2 server check inherit it.
- ACCEPT: a ~1 GB file is accepted by the client pre-check and the path end-to-end; an
  over-1 GB file is still refused with the specific reason (D1/D2 copy now reads "1 GB").

## Gates to run (frontend; CI on push/PR; PR-to-main)

- `npm run type-check` clean. `npm run build` (`next build`) clean.
- `npm run test:governance` GREEN, INCLUDING the new D-B4 assertions.
- Founder click-through: a >4.5 MB photo and a large video both upload end-to-end; the video
  shows its poster in the room; the original downloads byte-identical; nothing plays.

## OUT OF SCOPE (do not touch)

- Video PLAYBACK + the voice-attestation class - still Fable-spec-first (option-3 rejected
  2026-06-10); positive design unspecified.
- Member testimony / Increment 2 - gated on E2.3.
- The 413 live-deploy PHOTO test - a PARALLEL founder check, NOT a blocker on this build;
  it self-discharges when B ships (the passthrough stops carrying bytes). Do not gate on it.
- Any storage RLS policy change - not expected; if one appears necessary, STOP and re-scope.
- Raising the Supabase cap - already done (1 GB).

## Pointers

- Ruling + Amendment 1 (read first): `_observations/OBSERVATIONS_2026_06_10_DW1V1_RULING_REMEDY_B.md`.
- Decision-readiness brief: `_observations/session_brief_2026_06_10_dw1v1_large_file_ingest_decision.md`.
- State ledger: `ROADMAP.md` ("A/V Room - video increment" -> "Next + still open").
- Code: `src/app/api/av-room/upload/route.ts` (to be removed), `src/lib/av-room-limits.ts`,
  `src/components/av-room/ingest-panel.tsx`, storage policy `011_w1_av_room.sql:197-227`.
