# Observations - D-W1-A voice-attestation class + video playback (build)

Dated 2026-06-11. Session: Claude Code / Opus 4.8 (EXECUTE). Branch
`feat/w1-video-playback-attestation` off `main` at `b2884d7`. Mechanism specification
under spec 5.7 (no spec amendment consumed); ruling memo of record is the FIRST commit
on the branch (`b78070f`, the ff1b74b pattern). One PR. Discharge held pending migration
015 apply + founder click-through.

## Shipped (build order)

- **Migration 015 `media_voice_attestations` + G20** (`d63bba7`): sibling of 012/014 -
  append-only event, RLS SELECT league / INSERT commissioner / no UPDATE/DELETE,
  `attested_state` CHECK (`no_member_voice` | `member_voice_present`). G20 asserts
  commissioner-write + append-only (probe-skips until 015; governance 115/0, target 116/0).
- **`evaluatePlaybackGate`** in `src/lib/av-room.ts` (`d63bba7`): the spec-5.7 gate, server
  only. Leg1 (latest attestation = `no_member_voice`) OR Leg2 (>=1 identified member AND
  every identified member has a current `recorded_voice`/2b grant; A2a: zero identified =>
  Leg2 false). Reuses `loadRoomState`'s current (non-superseded) `member_identification`
  tags - NO twin. Any error / missing read-model / non-video => fail closed.
- **`sign/route.ts` variant `playback`** (`d63bba7`): video-only (400 otherwise),
  league-member auth, gate enforced AT THE ROUTE; pass -> sign the ORIGINAL at
  `PLAYBACK_TTL_SECONDS = 600`; fail -> neutral 403 `'Playback gated'` (no leg leakage).
  The 120s display TTL and the poster-for-video display path are untouched.
- **`/api/av-room/attest`** (`d63bba7`): commissioner-only, authed insert (RLS = guarantee),
  event-before-effect, graceful 503 until 015. No AI.
- **UI** (`478a034`): ingest detail-panel attestation line + "Attest: no member voice" /
  "Record contrary attestation" controls (video-only, each a new event); quick-look + room
  players fetched ON INTENT (Play click), never prefetched; room `RoomVideo` cell shows the
  attestation line to members + a gated Play; no autoplay; zero playback logging.

## UNIT 4 verification - TTL / range-request / in-flight-vs-issuance (recorded per brief)

The boundary AS BUILT (the D-U boundary applied to playback): supersession stops future
signed-URL **issuance** - a contrary attestation makes the next Play-click gate evaluate
`member_voice_present` and return 403, so no new URL is minted. An **already-minted** URL is
NOT revoked; it lives out its <=600s TTL. The grant-at-time provenance keeps an in-flight
stream legitimate; the past is never rewritten.

Expected range-request behavior (Supabase signed URLs embed an expiry in the token; the
`<video>` element issues byte-range requests for buffering/seeking, each carrying that
token): within the 600s window, range requests succeed -> seeking works; after expiry a new
range request is rejected (expired-token 400) -> further buffering/seeking stalls and the
member must press Play again, which RE-EVALUATES the gate (so a since-superseded video then
fails closed). **EMPIRICAL CONFIRMATION DEFERRED to the founder click-through:** the exact
status on an expired range request and seek-past-expiry behavior must be observed against a
real gate-passing video in the browser (it cannot be run headless here). Recorded as a
click-through item rather than asserted.

## Founder apply-steps + click-through (then discharge)

1. **Apply migration 015** via the dashboard SQL editor (pbcopy rhythm). Re-run governance
   -> expect **116/0** (G20 active).
2. Click-through:
   (1) Attest "no member voice" on the no-voice corpus video -> it PLAYS in the room and in
       quick-look (Play -> player; no autoplay).
   (2) The voiced video stays gated (poster + neutral message; no player).
   (3) Record a contrary attestation on the playing video -> the NEXT Play attempt is gated
       (issuance stops forward); an already-open stream is unaffected within its TTL.
   (4) Confirm zero autoplay anywhere and no playback logging; observe + note the
       range-request/seek-vs-expiry behavior (UNIT 4 above).

## Boundaries held

No AI audio analysis proposes or makes attestations - the attestation is a human
commissioner's act. No autoplay, no view counts, no engagement mechanics (6.3). 2b grants
remain each member's own authenticated act (E2.3); the 2b leg is inert-but-real until then.
Option-3 (soft-tag-carrying-hard-gate) rejection stands. Fail closed everywhere.

## Click-through OBSERVED evidence (founder, pre-merge on PR #21)

The GATE behaviour verified end-to-end:
- **Gate-pass mints a playback URL** (sign 200 `{url, ttl}`); **TTL 600s on the token**
  (decoded JWT `iat`/`exp` delta = 600s). Gate-FAIL returns the neutral refusal, rendered
  in place of the player. **Supersession gates forward** (a contrary attestation -> the next
  Play is refused). **No autoplay** anywhere.
- **Expired URL rejects** - verbatim body: `InvalidJWT: "exp" claim timestamp check failed`
  (a 90-byte JSON). So the expiry half of the seek/expiry boundary is now OBSERVED: an
  expired token is refused outright.
- **Full-original retrieval via a fresh URL** confirmed - `curl` served the full **69 MB**
  original. So the transport + signing are correct; the bytes are reachable.

Codec finding (root cause of the "looks dead" playback):
- The corpus videos are **iPhone HEVC/AAC `.mov`** (QuickTime inspector confirmed) - healthy
  originals. **Chrome cannot decode HEVC**, so even a correctly-wired `<video>` shows nothing
  playable in Chrome.

## Pre-merge defect fixes (this commit)

1. **FIX 1 - playback URL never attached to `<video>` src.** Evidence: the playback sign POST
   returned 200 but no `original.mov` media request fired. Hardened the player wiring -
   `playUrl` now takes precedence over the poster-loading state and the `<video>` carries
   `key={playUrl}` so it remounts cleanly and applies the src (the metadata request fires on
   press). Both quick-look and the room `RoomVideo`.
2. **FIX 2 - dead player controls in the quick-look overlay.** The overlay was a full-bleed
   click-catcher whose child `stopPropagation` handlers sat over the player region. Replaced
   with a backdrop-only close (`e.target === e.currentTarget`) and removed the child
   `stopPropagation`, so the `<video>` controls (play/volume/fullscreen) are fully
   interactive; header buttons + keyboard still drive nav/close.
3. **FIX 3 - attestation date rendered UTC-tomorrow.** `recorded_at` (timestamptz) was
   formatted with `toISOString()` (UTC); now `toLocaleDateString('en-CA')` in viewer-local
   time, in both the ingest detail line and the room (RoomVideo formats it client-side from
   the raw timestamp).
4. **FIX 4 - gated-item Play affordance (founder pick b).** When the RENDERED attestation
   state is `member_voice_present`, the Play affordance is replaced by the refusal text
   directly (using only state the panel already renders; the route gate is untouched, the UI
   still never decides).

## Limitation + verification path

Corpus originals are HEVC; Chrome cannot decode them even when wired - a **playback rendition**
(transcode to a web-decodable codec) is the registered follow-up **D-W1-A6, ruled separately**
and is NOT in this PR. **Safari plays HEVC natively and is the interim verification path.**
Seek/expiry flag: the **expiry half is now OBSERVED** (expired-token rejection above); the
**seek half verifies in Safari** post-fix (scrub a playing gate-passed video).

> **Correction (2026-06-12, D-W1-A6 runway).** A missing CSP `media-src` directive (fixed in
> D-W1-A6) blocked the `<video>` cross-origin fetch entirely - latent here, masked by the
> HEVC dead-player expectation. The Safari crossed-play glyph is now the SUSPECTED PRIMARY
> CAUSE (CSP), not content-type; the `curl -I` header read still happens in runway to settle
> it. See `_observations/OBSERVATIONS_2026_06_12_DW1A6_PLAYBACK_RENDITION_BUILD.md`.
