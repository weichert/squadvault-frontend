# Observations - D-W1-A6 playback rendition (build)

Dated 2026-06-12. Session: Claude Code / Opus 4.8 (EXECUTE). Branch
`feat/w1-a6-playback-rendition` off `main` at `cb3ba97`. Mechanism work under invariant
6.9 inside the admitted W.1 surface - specification, not amendment (the b78070f LEAN
precedent). Ruling memo of record = first commit (`1379739`). One PR. Discharge held for
the founder click-through (rendition backfill + the closing D-W1-A scrub-seek flag).

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

## Pre-merge defect: CSP blocked video playback (fixed on the PR)

Runway step-0 on the preview (`089a80d`) OBSERVED: the gate passed and `sign` returned 200
carrying the **original.mov** URL (rendition absent -> the route fell through to the
original). **The A6 fallback leg is CONFIRMED** end-to-end. But the mounted `<video>` issued
NO network request, and the console showed a CSP refusal.

Root cause: `next.config.js` had `img-src` and `connect-src` for Supabase but **no
`media-src` directive** - media fell back to `default-src 'self'` and Chrome refused the
cross-origin fetch. **Latent from D-W1-A** (masked there by the HEVC dead-player expectation;
it also likely explains Safari's crossed-play glyph, previously attributed to content-type).

Fix (this PR, `media-src` added to the CSP array, no other directive change):
`media-src 'self' https://${SUPABASE_HOSTNAME}`.

## original.mov content-type (OBSERVED at runway)

`curl -I` on a fresh signed URL of an original.mov, content-type line verbatim:
`<PLACEHOLDER - paste the observed Content-Type header>`. NOTE: the Safari crossed-play
glyph is now suspected to be the CSP defect above, not content-type; the header read still
happens in runway to settle it empirically. No remediation of stored objects either way
(A6-4): playback stops depending on the original's stored metadata the moment a rendition
exists.

## Boundaries held

Gate semantics untouched - attestation class, 2b leg, A2a vacuous-truth exclusion,
fail-closed posture, neutral refusal, TTL 600s, no autoplay, zero playback logging all
stand exactly as ruled in D-W1-A. No AI proposes or makes attestations. No server-side
transcode infrastructure - commissioner-side production only. Original bytes never modified;
renditions regenerable or deletable without fact loss. Option-3 rejection stands.
Verified-vs-testimony distinction untouched.

## Founder runway

1. Run `~/sv-apply/apply_a6_rendition_backfill_v1.sh` (fill the source paths/entry ids/hashes
   first); collect 2 `playback.mp4` + the PAIRING lines; record the ffmpeg version line.
2. Upload each via the "Upload playback rendition" affordance (dashboard upload acceptable;
   confirm `video/mp4` in object metadata).
3. Click-through, in order:
   - the attested no-voice video plays in **Chrome WITH SOUND**;
   - **scrub-seek mid-stream OBSERVED** (closes the last open D-W1-A flag);
   - the voiced video still shows the neutral refusal (gate regression check);
   - `curl -I` a fresh signed URL of `original.mov`, record the Content-Type line verbatim;
   - optional Safari re-check.
4. Paste the PAIRING lines + observations back for the build-memo close-out commit; merge
   PR #22 via `gh pr merge`.
