# D-W1-A6 ruling - playback rendition (RATIFIED 2026-06-12)

Fable DECIDE session 2026-06-12. Classification: mechanism work under invariant
6.9 inside the admitted W.1 surface - specification, not amendment (LEAN
precedent of b78070f). The D-W1-A ruling and every gate semantic in it are
untouched by this ruling; the rendition changes only which derived bytes a
gate-passing request receives.

## D-W1-A6-1 (RATIFIED: frame as registered) - Derived regenerable rendition

A playback.mp4 (H.264/AAC) is produced beside poster.jpg at the entry's
by-convention sibling path {league_id}/{entry_id}/playback.mp4. It is a derived
rendition in the poster's exact governance class (6.9): regenerable, deletable,
replaceable (upsert), never a fact, no fact event, no new table - filesystem
presence IS the state. The original is never modified and remains the retained
source of record. The sign route's playback variant signs
rendition-when-present-else-original: try playback.mp4, fall back to
entry.storage_path on absence. Progressive enhancement, zero regression -
Safari users lose nothing while renditions backfill. The gate is evaluated
identically, before either path is signed: same evaluatePlaybackGate, same
PLAYBACK_TTL_SECONDS = 600, same neutral 403, same zero playback logging, no
autoplay.

## D-W1-A6-2 (RATIFIED) - Recipe + pairing

Renditions are deterministic-in-method (ffmpeg output is not byte-stable across
versions; the method, not the bytes, is what's pinned). The canonical
invocation is recorded verbatim in the build memo together with the producing
ffmpeg -version line. Source resolution preserved; -pix_fmt yuv420p mandatory;
+faststart for range-request seek. Pairing: the build memo records, per
backfilled entry, the entry id, the original's content_hash (migration 013 -
cited as identification convenience per 013's own header, not as provenance;
entry id + storage path are the identity of record), and the sha256 of the
produced playback.mp4.

## D-W1-A6-3 (RATIFIED) - Production + upload path

Production is commissioner-side ffmpeg via an ~/sv-apply-style script - no
server-side transcode infrastructure, ever (anti-heavy-infra for a 10-person
league). Upload is commissioner-only. Binding constraint: rendition bytes never
transit a function body - a 1080p H.264 rendition exceeds the 4.5 MB limit by
an order of magnitude, so the poster route's multipart shape is structurally
unavailable. The mechanism is the remedy-B client-direct grant pattern; the
executor verifies mechanics at HEAD and picks the smaller diff between a
rendition variant on the existing grant flow and a sibling rendition-grant
route; either way the server names the path {folder}/playback.mp4, the grant is
commissioner-only and scoped to that one path, upload sets contentType
'video/mp4' explicitly, and upsert semantics apply (Set-Poster precedent).
Dashboard upload remains a legitimate manual fallback for backfill. No G21: no
new table, no new RLS surface; G16 already plants the cross-league grant-mint
test and storage RLS is unchanged. Backfill of the 2 corpus videos is founder
runway.

## D-W1-A6-4 (RATIFIED) - Content-type posture for originals

Existing originals' stored metadata is left untouched (append-only instinct;
playback stops depending on it the moment renditions exist). All new objects
set explicit contentType henceforth - verified at HEAD this is already true for
the client-direct path (ingest-panel passes contentType: file.type), so the
build item reduces to: guard the empty-file.type case (fall back to the grant's
declared mime) and confirm poster/thumb/rendition writers all pass explicit
types. The Safari header finding is settled empirically during runway: one
curl -I on a fresh signed URL of original.mov, one OBSERVED line in the memo.
No remediation of stored objects either way.

## D-W1-A6-5 (RATIFIED) - Verification plan

Founder runway ends with: rendition backfilled -> attested no-voice video plays
in Chrome with sound -> scrub-seek OBSERVED (closing the last D-W1-A flag) ->
the voiced video still refuses (gate regression check) -> original.mov
content-type header read and recorded -> optional Safari re-check. The build
memo's HEVC limitation line flips to resolved with hashes.

## Binding build shape

1. Ruling memo of record = first commit on the branch (the b78070f pattern).
2. sign/route.ts: playback variant signs {folder}/playback.mp4 when present,
   else entry.storage_path. Gate evaluation, TTL, neutral 403, video-only
   check, display/poster paths: byte-for-byte semantics unchanged.
3. Rendition upload mechanism per A6-3 (client-direct grant; commissioner-only;
   server-named path; video/mp4; upsert).
4. Empty-file.type contentType guard on the existing upload path.
5. ~/sv-apply ffmpeg backfill script: anchor-asserting, idempotent, never
   stages/commits/pushes; emits per-entry pairing lines.
6. Build memo with the pinned invocation + ffmpeg version + pairing table +
   runway checklist.

## Boundaries (inherited, restated)

Gate semantics untouched - attestation class, 2b leg, A2a vacuous-truth
exclusion, fail-closed posture, neutral refusal, TTL 600s, no autoplay, zero
playback logging all stand exactly as ruled in D-W1-A. No AI proposes or makes
attestations. No server-side transcode infrastructure. Original bytes never
modified. Renditions regenerable or deletable without fact loss. Option-3
rejection stands. Verified-vs-testimony distinction untouched.
