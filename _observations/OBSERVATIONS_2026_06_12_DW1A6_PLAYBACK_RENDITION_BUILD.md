# Observations - D-W1-A6 playback rendition (build)

Dated 2026-06-12. Session: Claude Code / Opus 4.8 (EXECUTE). Branch
`feat/w1-a6-playback-rendition` off `main` at `cb3ba97`. Mechanism work under invariant
6.9 inside the admitted W.1 surface - specification, not amendment (the b78070f LEAN
precedent). Ruling memo of record = first commit (`1379739`). One PR. Discharge held for
the founder click-through (rendition backfill + confirming the Network filename switches to
playback.mp4). The D-W1-A scrub-seek flag is now CLOSED on the original (batch-2 below).

## Shipped

- **Ruling memo of record** (`1379739`): D-W1-A6 verbatim. Every D-W1-A gate semantic is
  untouched; the rendition changes only which derived bytes a gate-passing request receives.
- **Sign route prefers the rendition** (`cb04b02`): the playback variant signs
  `{folder}/playback.mp4` when present, else `entry.storage_path` exactly as before.
  Progressive enhancement, zero regression - the gate is evaluated identically before either
  path is signed; TTL 600s, neutral 403, video-only 400, display/poster/download paths
  byte-for-byte unchanged.
- **Client-direct rendition upload** (`4509397`): new `/api/av-room/rendition-grant`
  (commissioner-only, video-only, server-names `{folder}/playback.mp4`, upsert). Bytes flow
  client-direct under the grant (a 1080p H.264 rendition dwarfs the 4.5 MB function-body
  limit - the poster multipart shape is structurally unavailable). A sibling route, not a
  grant-route variant - the smaller diff, leaving the critical new-upload path untouched, no
  finalize (filesystem presence IS the state). UI: "Upload playback rendition" beside Set
  poster; contentType `video/mp4` explicit.
- **Empty-file.type contentType guard** (`6f2204b`, A6-4): the original upload sets
  `file.type || mime` (grant-declared, server-validated) so the stored object always has an
  explicit content-type. All derived writers pass explicit types (poster/thumb at finalize =
  image/jpeg; poster route = poster.type; thumb route = image/jpeg; rendition = video/mp4).
  Existing stored originals untouched.
- **Backfill script** (delivered by path, NOT committed):
  `~/sv-apply/apply_a6_rendition_backfill_v1.sh` - anchor-asserts ffmpeg + the founder-
  supplied source paths/entry ids/hashes, runs the pinned invocation per source, prints the
  sha256 + PAIRING lines, idempotent (skip existing unless FORCE=1), never stages/commits.

## Gates

`npm run type-check` clean; `npm run build` compiled (`/api/av-room/rendition-grant`
present); `npm run test:governance`: **116 passed, 0 failed** - NO new probe / no G21 (no
new table, no new RLS surface; G16 already plants the cross-league grant-mint test and
storage RLS is unchanged).

## Pinned invocation (deterministic-in-method)

```
ffmpeg -i original.mov \
  -c:v libx264 -profile:v high -level 4.1 -pix_fmt yuv420p \
  -crf 21 -preset slow \
  -c:a aac -b:a 160k \
  -movflags +faststart \
  playback.mp4
```

Source resolution preserved (no scale filter). `-pix_fmt yuv420p` mandatory (iPhone HEVC
may be 10-bit; 4:2:0 8-bit is the broad-decode target). `+faststart` fronts the moov atom
for range-request seek on a signed URL. ffmpeg output is not byte-stable across versions -
the METHOD is pinned, not the bytes.

**Producing ffmpeg -version:** `<PLACEHOLDER - paste the script's first line at runway>`

## Pairing table (filled at runway)

| entry id | original content_hash (mig 013, ID convenience) | rendition sha256 |
|----------|--------------------------------------------------|------------------|
| `<entry1>` | `<hash1>` | `<sha1>` |
| `<entry2>` | `<hash2>` | `<sha2>` |

## Runway venue (recorded honestly)

Batch-2 observations were taken on **local dev at `b8c3cd2` against the REAL Supabase
project** (signed URLs carry the project ref) - evidence equivalent to the preview for
CSP/transport purposes.

## Pre-merge defect 1: CSP blocked ALL video playback (fixed, `b8c3cd2`) - re-attributed

Step-0 OBSERVED: the gate passed and `sign` returned 200 carrying the **original.mov** URL
(rendition absent -> route fell through to the original). **The A6 fallback leg is
CONFIRMED.** But the mounted `<video>` issued NO network request; the console showed a CSP
refusal.

Root cause: `next.config.js` had `img-src`/`connect-src` for Supabase but **no `media-src`**
- media fell back to `default-src 'self'` and the browser refused the cross-origin fetch.
Fix (`b8c3cd2`): `media-src 'self' https://${SUPABASE_HOSTNAME}`, no other directive change.

**Re-attribution (batch 2):** the missing `media-src` was the **ENTIRE playback blocker, all
browsers, latent since D-W1-A** - not just a Chrome/HEVC issue. POST-FIX, the **HEVC ORIGINAL
played in Chrome-on-macOS with picture AND sound** (rendition not yet uploaded; Network shows
`original.mov` 206s). The HEVC dead-player expectation had masked it.

## Pre-merge defect 2: quick-look media height unbounded for portrait video (fixed, this commit)

The quick-look overlay did not constrain the media region's height, so a portrait video's
poster/player pushed the gated-Play affordance and the refusal line **below the viewport with
no scroll path** - hiding the gate's own surface (a member who can't see Play can't reach
gate-passing playback; one who can't see the refusal loses the attestation's trust
legibility). Fix: CSS-only - the image side is a bounded flex column with the media in a
`flex:1 1 auto; min-height:0; overflow:hidden` cell (object-fit contain) and the affordance
strip `flex:none`, so the strip is always reserved on-screen. The room `RoomVideo` cell is a
FIXED aspect-ratio box (absolute Play overlay, line below) so the hazard does not apply there;
added `object-fit:contain` to its `<video>` for portrait correctness. No route/gate/logic change.

## original.mov content-type - content-type theory DEAD

`curl -I` on a fresh signed URL OBSERVED verbatim: **`content-type: video/quicktime`**.
Stored originals were correctly typed all along - the grant flow's `contentType: file.type`
worked; **no stored-object defect ever existed**. The A6-4 empty-`file.type` guard stays as
belt-and-braces. The Safari crossed-play glyph is now **confirmed CSP** (defect 1), not
content-type.

## Observations banked (D-W1-A flags closed)

- **Original played to completion with sound** (1:05 / 1:05) in Chrome-on-macOS.
- **SCRUB-SEEK OBSERVED** on the original: founder scrubbed, playback resumed; Network shows
  multiple **206 partial-content range requests** against the signed URL (some disk-cached,
  ~45 MB / ~20 MB chunks). **The D-W1-A seek flag CLOSES** on this evidence (it will be
  re-observed incidentally on the rendition). The expiry half was already observed; both
  halves of the seek/expiry boundary are now settled.
- Fallback leg banked (sign returned `original.mov` with the rendition absent).

## Rendition justification (re-framed, batch 2)

The HEVC premise NARROWS, it does not die: Chrome on recent macOS hardware-decodes HEVC, so
the original played on the founder's machine. "Chrome cannot decode HEVC" still holds for
Windows / older hardware. The rendition unit's justification is therefore **member reach** -
a 10-person league on mixed hardware where some members' browsers cannot decode the iPhone
HEVC original - NOT the founder's machine. The H.264/AAC rendition is the broad-decode target;
the sign route already serves it when present (progressive enhancement).

## Boundaries held

Gate semantics untouched - attestation class, 2b leg, A2a vacuous-truth exclusion,
fail-closed posture, neutral refusal, TTL 600s, no autoplay, zero playback logging all
stand exactly as ruled in D-W1-A. No AI proposes or makes attestations. No server-side
transcode infrastructure - commissioner-side production only. Original bytes never modified;
renditions regenerable or deletable without fact loss. Option-3 rejection stands.
Verified-vs-testimony distinction untouched.

## Founder runway (remaining after the two fixes land)

Already closed: CSP playback (Chrome, with sound), scrub-seek, expiry, fallback leg,
content-type, the quick-look height hazard. What's left:

1. Run `~/sv-apply/apply_a6_rendition_backfill_v1.sh` (fill the source paths/entry ids/hashes
   first); collect 2 `playback.mp4` + the PAIRING lines; record the ffmpeg version line.
2. Upload each via the "Upload playback rendition" affordance (dashboard upload acceptable;
   confirm `video/mp4` in object metadata).
3. Play -> confirm the Network filename **switches to `playback.mp4`** (the rendition leg now
   serves instead of the original).
4. Voiced-video refusal check - but **verify each entry's CURRENT attestation state first**
   (states churned during #21 testing; the latest event is what the gate reads).
5. Paste the PAIRING lines + the playback.mp4-Network observation back for the build-memo
   close-out commit (fill the pairing table + ffmpeg-version + content-type lines); merge PR
   #22 via `gh pr merge`.
