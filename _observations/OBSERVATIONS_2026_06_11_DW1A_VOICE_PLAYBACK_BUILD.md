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
