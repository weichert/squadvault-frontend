# Observations - W.1 A/V Room video-ingest hardening (no playback)

Dated 2026-06-10. Session: Claude Code / Opus 4.8 (EXECUTE). Branch
`feat/w1-video-ingest-hardening` off `main` at `3695c01`.
Brief: `_observations/session_brief_2026_06_10_w1_video_ingest_hardening.md`.

## What shipped

Three deliverables, one topic per commit, against the proven Increment 1 foundation.
No schema migration, no RLS change.

- **D1 - client-side size pre-check** (`7601f8c`). New single-source constant
  `MAX_UPLOAD_BYTES` in `src/lib/av-room-limits.ts` (dependency-free so client and
  server share one number), set to Supabase Storage's 50 MB per-file cap. The ingest
  panel `UploadForm` refuses an oversized file before any round-trip: exact size +
  limit shown, Upload disabled, no network request. At/under the limit is unchanged.
- **D2 - specific upload-failure reasons** (`b97b19c`). `upload/route.ts` now:
  (a) enforces `MAX_UPLOAD_BYTES` server-side after the commissioner boundary,
  returning 413 with the size + limit; (b) distinguishes a storage-reported size cap
  (413) from any other storage error (502), each with a human reason; (c) the
  persist-failure path explains the file was stored but its record could not be saved
  and the upload was rolled back (500). Client unchanged - it already renders `j.error`.
- **D3 - poster-frame as a derived rendition** (`99dafc0`). By-convention, no schema:
  the client extracts a still from a selected video (hidden `<video>` + `<canvas>` ->
  JPEG, best-effort) and submits it as a `poster` part; `upload/route.ts` writes it to
  `{league_id}/{media_entry_id}/poster.jpg` AFTER the original and the row, under the
  prefix the commissioner storage policy already allows. The room page lists the entry
  folder to confirm `poster.jpg` exists, signs it like a photo, and renders it
  image-only in the video slot. No `<video>`, no playback, no 2b read. Videos without a
  poster fall back to the existing placeholder.

## Gates

- `npm run type-check` clean; `npm run build` (`next build`) compiled successfully,
  no warnings.
- `npm run test:governance` against the live DB: **110 passed, 0 failed**. G12-G15
  (media RLS) unchanged - confirms no policy/schema drift, as expected.

## Invariants held

- **6.9 original retained unmodified**: the poster is a separate sibling object; the
  original at `original.{ext}` is written once and never touched.
- **No playback / fail-closed**: the poster is an `<img>`, not a `<video>`; video
  playback stays deferred to the unspecified voice-attestation class.
- **Boundary untouched**: the server size check sits after the commissioner check;
  RLS remains the real boundary (governance gate green).
- **Honest cap**: D1/D2 make the existing 50 MB cap honest (pre-checked + explained).
  They do NOT raise it.

## Carry-forwards / still open

- **D-W1-V1 (UNRULED, founder/Fable call)**: true large-file ingest above 50 MB is
  blocked by the server-passthrough design + storage cap, not a frontend bug. Two
  mutually-exclusive remedies - (A) raise the Supabase Storage per-file limit (keeps
  spec 5.1, but serverless body limits may still cap), or (B) client-direct-to-storage
  via `createSignedUploadUrl` (DEVIATES from spec 5.1, needs an amendment + reordered
  insert + storage policy review). This session deliberately did NOT attempt large-file
  upload.
- **Video playback + voice-attestation class**: positive design unspecified;
  option-3 soft-tag attestation rejected 2026-06-10. DECIDE work (chat/Fable).
- **Member testimony (Increment 2)**: still gated on E2.3 (member<->franchise linkage);
  untouched here.

## Notes for the next session

- The brief was a DRAFT authored in Claude Code (charter 5 normally routes brief
  authoring to chat/Fable); it was executed under founder instruction to start the
  session from it. The large-file decision-gate was correctly treated as out of scope.
- Poster existence is checked by a per-video `storage.list` of the entry folder. Fine
  for the current small corpus; if the corpus grows large this becomes N list calls per
  room render and could move to a stored convention or a HEAD check.
- The commissioner ingest-panel preview (`EntryCard`) already renders `<video controls>`
  for the commissioner's own selected/uploaded item (pre-existing Increment 1). That is
  the management surface, not the public room; D3 did not touch it. Flagging in case a
  future "no playback anywhere" reading wants it revisited - it was out of scope here.
