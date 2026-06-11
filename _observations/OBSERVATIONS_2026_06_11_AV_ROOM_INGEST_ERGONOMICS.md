# Observations - W.1 A/V Room ingest ergonomics + room-poster fix

Dated 2026-06-11. Session: Claude Code / Opus 4.8 (EXECUTE). Branch
`feat/w1-ingest-ergonomics` off `main` at `5c1550b`. In-spec unit (spec 5.7 / D-G
"photo-first tooling": drag-drop, batch tagging) - no DECIDE gate.

## D0 - room poster: diagnosis inverted the brief's premise (flagged, charter 3.4)

The brief's finding ("ingest shows thumbnails; the room renders bare placeholders -
wire the poster signed URL") assumed poster objects exist and the room fails to render
them. Live production data (queried via service role) showed the opposite:

- Both video entries' folders contain ONLY `original.mov` - no `poster.jpg`.
  (`681316b1` "Out on the Lake", `9be767f9` "Trophy Celebration".)

The room render code is CORRECT - it lists the folder, signs `poster.jpg`, renders it
image-only, and falls back to the placeholder when absent. It shows placeholders because
there is nothing to show. Root cause is upstream: client `extractPosterBlob` is
best-effort and silent for codecs the upload browser cannot decode (iPhone .mov / HEVC
in Chrome) or large files that exceed its window. I cannot regenerate the stills (no
ffmpeg; the room may not use a `<video>` element - that is forbidden by the image-only /
2b-gate invariant).

Fix (founder-chosen Option 1, in-spec, no media pipeline), `3992479`:
- New `POST /api/av-room/poster`: commissioner sets/replaces `poster.jpg` for a video
  (small image, passthrough; league derived from the entry; upsert).
- Ingest read-model surfaces `hasPoster` per video; the panel shows "Set/Replace poster"
  and an honest "no still yet" hint where one is missing (de-silenced).
- Hardened `extractPosterBlob` (12 s window + playsInline) so the auto path succeeds more
  often; failure is now visible, never silent.

## D1-D6 (one topic per commit)

- **D1 drag-drop multi-file upload** (`e26db26`): drop N files; each runs the remedy-B
  flow through a bounded-concurrency (3) queue with per-file failure isolation and honest
  per-file pre-checks (HEIC / over-1 GB / unsupported).
- **D2 batch tagging** (`0237ebc`): select items; apply one tag (contributor/season/event)
  = one ordinary tag event PER ITEM via the existing route, append-only, attributed. No
  new tag kinds.
- **D3 compact corpus rows** (`1b585e9`): the per-item tag form + poster control collapse
  behind a "Tag / edit" toggle; default row = thumbnail + current tags + Withdraw/Reinstate.
- **D4 newest-first on ingest** (`c6d42d7`): ingest list orders `created_at` DESC; the room
  stays oldest-first (founder taste call; W.2 owns presentation).
- **D5 reinstate** (`8211d27`): append-only `media_display_reinstatements` (migration 012),
  sibling RLS pattern; read-model now derives withdrawn iff latest withdrawal postdates
  latest reinstatement; WITHDRAWN rows gain REINSTATE; G17 (anon-insert-denied, probe-skip
  until 012 applied).
- **D6 HEIC honesty** (`85bbeb8`): client refuses HEIC/HEIF before any round-trip with an
  explicit "export as JPEG" message (browsers can't render it); grant route 415 backstop.

## D5 spec note (VERBATIM, recorded in migration 012 + the reinstate route)

> Post-E2.3, a member-requested withdrawal may not be reinstated by the commissioner
> alone; reinstatement of member-requested withdrawals requires that member's renewed
> consent. Enforcement lands with Increment 2; the commissioner-only Increment 1 case is
> self-consistent.

## Gates

- `npm run type-check` clean; `npm run build` compiled, no warnings (routes present:
  `/api/av-room/poster`, `/api/av-room/reinstate`, `/api/av-room/upload/{grant,finalize}`).
- `npm run test:governance`: **112 passed, 0 failed**; G17 probe-skips until migration 012
  is applied, then self-activates.

## Founder apply-steps + the held D-W1-V1 discharge

These require founder action; the code is inert/partly inert until then:
1. **Apply migration 012** to production (dashboard SQL editor - no CLI/DATABASE_URL here,
   the established pattern). Until then: reinstate is a no-op route and G17 skips; the
   read-model degrades gracefully to withdrawal-only.
2. **Set the two video poster stills** via the new "Set poster" control - this is what
   makes D0's acceptance ("both videos show posters in the production room") true.
3. **Founder click-through** (production, post-merge): bulk-drop a handful of photos;
   batch-tag them; reinstate the trophy photo; posters visible in the room.

**D-W1-V1 DISCHARGE is HELD until D0 is verified on production** (step 2 above), per the
brief's discharge rider. Staged for that update: the >4.5 MB photo check is PROVEN
TRANSITIVELY - the same grant transport carried a 68.7 MB file on production, so no
photo-specific byte path remains; a dedicated photo test is optional, non-blocking. Once
posters render in the production room, the prepared D-W1-V1 DISCHARGED ledger entry runs.

## Out of scope (untouched)

- Voice-attestation class + playback (own DECIDE session); Increment 2 / member anything
  (E2.3); W.2 aesthetics; straggler-orphan ops sweep; AI tagging of any kind.
