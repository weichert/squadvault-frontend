# Session brief - W.1 A/V Room video-ingest hardening (no playback)

Authored: 2026-06-10. Target tool/model: Claude Code / Opus 4.8 (EXECUTE).
Authoring note: drafted in Claude Code at founder instruction (charter section 5 normally
routes brief authoring to chat/Fable). Treat as a DRAFT pending founder ratification; the
large-file decision-gate (D-W1-V1 below) in particular is a Fable/founder call, not a build input.

## Verified HEAD at authoring

- Frontend `main` = `3006834` (PR #4 merge). VERIFY at session start: `git -C ~/squadvault
  log --oneline -1` should show `3006834 Merge pull request #4 ...`. If git disagrees, git wins -
  flag before executing (charter 3.4).

## Already done (with hashes - do NOT redo)

- W.1 Increment 1 BUILD MERGED + founder-PROVEN + DISCHARGED. Chain: foundation `c21e858`
  (migration 011 media_entries/tags/ratification/withdrawals + RLS + types + G12-G15) ->
  `df79a4f` (RLS-42501 test tighten) -> `c284053` (five `/api/av-room/*` routes + `src/lib/av-room.ts`
  read-model) -> `7eee29d` (ingest panel + display) -> `65da2e6` (PR #2). Ledger: `ee22e56` (PR #3,
  ROADMAP W.1 row + click-through memo); engine STATE.md `b9fd188`.
- Upload path is a server passthrough (`src/app/api/av-room/upload/route.ts`): bytes -> private
  `league-media` bucket at `{league_id}/{media_entry_id}/original.{ext}`, then one `media_entries`
  INSERT; orphan object rolled back on insert failure; original retained unmodified (6.9).
- Client error display ALREADY wired: `src/components/av-room/ingest-panel.tsx` UploadForm reads
  `j.error` from a non-ok response and renders it (lines ~220-223). The route just returns generic
  strings today (`'Upload failed'` 502; `'Persist failed'` 500).
- Display (`src/app/league/[id]/av-room/page.tsx`) signs URLs for PHOTOS only (~line 117); video
  renders a plain present-but-not-playable placeholder (~line 171). Sign route TTL = 120s
  (`src/app/api/av-room/sign/route.ts:20`).

## Deliverables + binary acceptance criteria

### D1 - Client-side size pre-check (REQUIRED)
- File: `src/components/av-room/ingest-panel.tsx` (UploadForm); define a shared `MAX_UPLOAD_BYTES`
  constant (single source, exported/co-located so D2 can reuse it).
- ACCEPT: selecting a file whose `file.size > MAX_UPLOAD_BYTES` shows an explicit message (e.g.
  "This file is NN MB; the limit is MM MB") AND keeps Upload disabled, with NO network request
  made. A file at/under the limit behaves exactly as today.

### D2 - Specific upload-failure reasons (REQUIRED)
- File: `src/app/api/av-room/upload/route.ts`. Inspect `storageErr` (status/message) and return a
  distinguishable response for the size-cap case (e.g. 413 + "File exceeds the storage limit
  (MM MB)") vs other storage errors vs the existing persist-failure. No client change needed beyond
  what already renders `j.error`.
- ACCEPT: an induced oversized/failed upload surfaces a SPECIFIC, human reason in the panel (not the
  bare word "failed"); a normal upload is unchanged; commissioner-only + RLS boundary untouched.

### D3 - Poster-frame as a derived rendition (SECOND; same session if D1/D2 land clean)
- Approach (no schema migration; by-convention sibling object): client extracts a still from the
  selected video (hidden `<video>` + `<canvas>` -> JPEG blob) and submits it as an extra `poster`
  form part; `upload/route.ts` writes it to `{league_id}/{media_entry_id}/poster.jpg` AFTER the
  original, under the same path prefix the commissioner storage policy already allows. Display derives
  the poster path from `storage_path` (swap `original.{ext}` -> `poster.jpg`), signs it like a photo,
  and renders it in the video slot.
- ACCEPT: uploading a video yields `original.{ext}` BYTE-UNCHANGED (6.9) plus a `poster.jpg` sibling;
  the room shows the poster still for that video instead of the plain placeholder; the poster is
  image-only with NO `<video>`/playback element and NO 2b read; videos without a poster fall back to
  today's placeholder (no error). `tsc` + `next build` clean.

## Decision-gate (BLOCKS true large-file ingest - OUT OF SCOPE until founder rules)

- **D-W1-V1**: the real-corpus `.MOV` that 400'd after ~40s is blocked by the server-passthrough
  design + storage cap, not a frontend bug. Two mutually-exclusive remedies, each needing a founder
  decision (Fable spec call):
  - **A.** Raise Supabase Storage's per-file limit (project dashboard) - keeps spec 5.1 passthrough,
    but serverless request-body limits may still cap very large files. Founder action, not code.
  - **B.** Client-direct-to-storage via `createSignedUploadUrl` (bytes never transit the function),
    then INSERT server-side - **DEVIATES from spec 5.1** ("no client-direct write, passes THROUGH
    this server route", `upload/route.ts:3`); needs a spec amendment + re-ordered insert + a storage
    read/write policy review.
- Until D-W1-V1 is ruled, this session does NOT attempt large-file upload. D1/D2 make the current cap
  HONEST (pre-checked + explained); they do not raise it.

## Gates to run (frontend; no pre-commit gates here - CI runs on push/PR; PR-to-main per #1-4)

- `npm run typecheck` (or `npx tsc --noEmit`) clean.
- `npm run build` (`next build`) clean.
- `npm run test:governance` against the live DB still GREEN (no RLS/schema change expected; if D3 or
  anything touches a policy, that is a signal to stop and re-scope).
- Founder click-through: (D1) oversized file is refused client-side with a reason, no request fired;
  (D2) an induced failure shows a specific reason; (D3) a video shows a poster still in the room, the
  original still downloads byte-identical, and nothing plays.

## OUT OF SCOPE (do not touch)

- Video PLAYBACK and the commissioner voice-ATTESTATION class - a NEW structured fact class with a
  2b consent gate. Option-3 (attestation as a soft provenance tag) was REJECTED 2026-06-10; the
  positive design is unspecified. That is DECIDE work (chat/Fable spec/four-memo), not this session.
- Any 2b (voice/likeness) read; member testimony / Increment 2 (gated on E2.3).
- Large-file ingest path (blocked on D-W1-V1 above).
- Any schema migration (D3 is deliberately by-convention, migration-free).
- Section-VIII nav / TopNav (W.2 domain).

## Pointers

- Prior session ledger: `ROADMAP.md` (W.1 row, "A/V Room - video increment" open-work block).
- Findings of record: `_observations/OBSERVATIONS_2026_06_10_AV_ROOM_INCREMENT_1_CLICKTHROUGH.md`
  (proven-live results, the 2a-silence/E2.3 structural note, video carry-forwards, and the option-3
  attestation rejection rationale).
