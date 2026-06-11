# Ruling memo - D-W1-V1: large-file video ingest - RULED REMEDY B

Dated 2026-06-10. Session: DECIDE -> file. The ruling was made by the founder in the
Fable chat project; this memo is the durable record of it (charter 1: chat decides,
Claude Code files). Verified at authoring: frontend `weichert/squadvault-frontend` main
= `75e25d2` (PR #8); engine `weichert/squadvault` main = `ced7884`.

Companion artifacts: decision-readiness brief
`_observations/session_brief_2026_06_10_dw1v1_large_file_ingest_decision.md`; handoff
prompt `_observations/handoff_2026_06_10_dw1v1_fable_chat_prompt.md`; the EXECUTE brief
authored from this ruling, `_observations/session_brief_2026_06_10_w1_large_file_ingest_remedy_b_build.md`.

## The ruling

**D-W1-V1 = REMEDY B**: client-direct upload to Storage under a server-minted upload
grant. Remedy A (raise the Supabase per-file cap and keep the server passthrough) is
ELIMINATED. Spec 5.1 Amendment 1 is ratified as drafted (verbatim below). Large-file
ingest is UNBLOCKED; the frontend build is the next unit (EXECUTE brief filed).

## Measurements that grounded the ruling

- **M2 RESOLVED** - the original failure was the **Supabase 50 MB Storage per-file cap**,
  not a function timeout. Dev log shows `storage/v1/object` returning 400 at ~40s (the
  time is upload duration to the storage layer, not a serverless wall).
- **M1 RESOLVED BY DOCUMENTATION** - Vercel's serverless **function request-body limit is
  4.5 MB, unconfigurable**, returning 413 at the platform edge before the function runs.
  This eliminates remedy A outright: raising the Supabase Storage cap addresses the WRONG
  ceiling - the bytes never reach Storage because the function edge rejects them first.
- **Supabase cap raised** (founder, 2026-06-10): plan upgraded to **Pro**; per-file cap
  set to **1 GB** in the dashboard. The free-tier deferral framing from the chat is
  therefore MOOT - not an open item. `MAX_UPLOAD_BYTES` target for the build = 1 GB
  (1073741824 bytes).

## Corollary finding (a live production bug, surfaced by the ruling)

Production **photo** uploads over 4.5 MB are **broken TODAY** on the deployed passthrough:
every original - photo or video - transits the serverless function, so the 4.5 MB edge
limit caps both. Local testing never saw this because dev has no platform edge (that is
why local upload bound at the 50 MB Storage cap, masking the real production ceiling).
Remedy B fixes photo and video alike, because the original then flows direct-to-Storage
and never transits the function.

- **Parallel founder check** (NOT an EXECUTE blocker): one live-deploy upload of a >4.5 MB
  photo, expecting `413 FUNCTION_PAYLOAD_TOO_LARGE`. The ruling grounds are the documented
  unconfigurable platform limit; this test only confirms a corollary of an
  already-eliminated remedy. It **self-discharges when B ships** - once the passthrough
  stops carrying bytes the 413 becomes unobservable; close as overtaken if unrun by then.

## Spec 5.1 Amendment 1 (VERBATIM - ratified in Fable chat, D-W1-V1, 2026-06-10)

> Spec 5.1 Amendment 1 (D-W1-V1, 2026-06-10). The sentence "no client-direct
> write — uploads pass through the authenticated commissioner surface
> (server-side)" is amended: bytes MAY flow client-direct to Storage under a
> server-minted upload grant, provided every governance property of the
> passthrough is preserved by the grant mechanism: (a) the server mint route
> performs the same commissioner authorization as the upload route before
> issuing any grant; (b) the grant is single-use, short-TTL, and scoped to a
> server-chosen object path ({league_id}/{media_entry_id}/original.{ext} — the
> client never names paths); (c) the media_entries INSERT remains server-side
> via the authed client (RLS-backed), finalizing the record only after upload
> completion; (d) a client-uploaded object never finalized is a pre-record
> orphan — unreferenced, invisible, and reapable as hygiene without violating
> append-only discipline, which begins at the record, not the byte; (e) the
> original is stored unmodified (6.9 unchanged); (f) the signed-URL read path
> and absence of any public policy are unchanged. The amendment changes the
> transport, not the authority: every upload remains an attributed commissioner
> act (C3).

## Execution scope (one paragraph, from the ruling)

Grant-mint route (commissioner-scoped, single-use, short-TTL, server-chosen path); client
direct upload retaining the D3 poster part; finalize route = insert-after-upload with a
pre-record orphan model + reap rule; the signed-upload-token vs `league_media_commissioner_insert`
interaction VERIFIED with a planted cross-league mint test; `MAX_UPLOAD_BYTES` raised to
the new honest ceiling (1 GB; the founder raised the Supabase cap in the dashboard as part
of this unit); governance suite green throughout. Transcribed into binary acceptance
criteria in the EXECUTE brief above.

## Authority + boundary note

Amendment 1 moves the write boundary: under the passthrough, `league_media_commissioner_insert`
(migration `011_w1_av_room.sql:213`) gated the byte write; under B the security lives in the
**mint route's commissioner check + server-chosen path** (clauses a/b), because a signed-upload
token authorizes its own write. The planted cross-league mint test is the proof that this
relocation holds (a commissioner of league X cannot obtain or use a grant to write league Y's
prefix). The `media_entries` INSERT stays RLS-backed server-side (clause c); append-only
begins at the record, not the byte (clause d).

## What this unblocks / next

- EXECUTE brief filed: `_observations/session_brief_2026_06_10_w1_large_file_ingest_remedy_b_build.md`
  (Opus/Claude Code, frontend). Out of scope there: video playback + voice-attestation class
  (still Fable-spec-first; option-3 rejected), member testimony Inc 2 (gated E2.3), and the
  413 photo live-test (parallel founder check, self-discharging).
- Ledgers updated this series: frontend `ROADMAP.md`; engine `docs/STATE.md`.
