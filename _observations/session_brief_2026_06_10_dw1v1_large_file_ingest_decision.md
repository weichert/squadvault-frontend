# Session brief - D-W1-V1: large-file video ingest (DECISION-READINESS)

Authored: 2026-06-10. **This is a DECIDE brief, not an EXECUTE brief.** Its output is a
RULING on decision-gate D-W1-V1 (which remedy, with what spec consequence) - a chat/Fable
+ founder artifact (charter 1 tool routing; 2.1 one-question test = DECIDE). An Opus/Claude
Code session does NOT rule this gate (charter 2.4: never Opus for constitutional
adjudication; 7: stop when a D-x is unmade or work would touch a frozen spec).

Authoring note: drafted in Claude Code at founder instruction (charter 5 normally routes
brief authoring to chat/Fable). Treat as a DRAFT decision package pending founder/Fable
handling. The code-grounded diagnostics below are verified against the repo at the HEAD
named; the framing of A vs B is carried verbatim from the prior session's gate, not
re-litigated here.

## Verified HEAD at authoring

- Frontend `main` = `2367479` (PR #6 merge: W.1 video-ingest hardening D1/D2/D3).
  VERIFY at session start: `git -C ~/squadvault log --oneline -1` should show
  `2367479 Merge pull request #6 ...`. If git disagrees, git wins - flag before
  proceeding (charter 3.4).

## The decision (one sentence)

True large-file video ingest (the real-corpus `.MOV` that 400'd after ~40s, above
Supabase Storage's global 50 MB cap) is blocked by the **server-passthrough design +
storage cap**, not a frontend bug. D1/D2 (`7601f8c`/`b97b19c`) made the 50 MB cap HONEST;
they did not raise it. Raising it requires choosing ONE of two mutually-exclusive remedies,
each with a different spec consequence. **The founder picks A or B. Nothing builds until
then.**

## Already done / load-bearing facts (with hashes - do NOT re-derive)

- Hardening shipped + merged: D1 client size pre-check `7601f8c`, D2 specific failure
  reasons `b97b19c`, D3 poster-frame `99dafc0`, ledger+memo `0392455`, merge `2367479`.
  `MAX_UPLOAD_BYTES = 50 MB` lives single-source in `src/lib/av-room-limits.ts`.
- Current ingest path (`src/app/api/av-room/upload/route.ts`, `runtime = 'nodejs'`):
  multipart POST -> the route BUFFERS THE ENTIRE FILE IN MEMORY
  (`new Uint8Array(await file.arrayBuffer())`, line ~100) -> one authed
  `storage.upload` -> one `media_entries` INSERT -> orphan rollback on insert failure.
- Storage write is governed by `league_media_commissioner_insert` (migration
  `supabase/migrations/011_w1_av_room.sql:213`): `bucket_id = 'league-media' AND
  is_commissioner(split_part(name,'/',1)::uuid) OR is_admin()`. The first path segment is
  the league id; commissioner write-scope keys off it. NO member SELECT policy on the
  bucket - bytes are served only by short-TTL server-signed URLs.
- `createSignedUploadUrl` / `uploadToSignedUrl` are used NOWHERE in `src/` today -
  remedy B is net-new.
- **Spec 5.1's normative text is NOT in this repo** (only inline code restatements, e.g.
  `upload/route.ts:3` "no client-direct write, passes THROUGH this server route"). The
  authoritative source is the Design Brief / four-memo chain. A spec-5.1 amendment is a
  chat/Fable + founder artifact and CANNOT be authored from this repo.

## The two remedies (carried from the gate; neutral)

### A. Raise Supabase Storage's per-file limit (founder dashboard action; keeps spec 5.1)
- KEEPS the passthrough invariant intact - no spec amendment, no client-direct write.
- Pure runtime/config change (Storage settings), NOT code.
- **BUT the passthrough has ceilings independent of the storage cap**, which raising the
  dashboard limit does NOT remove:
  1. Platform request-body limit on the serverless function (the prior brief flagged
     "serverless request-body limits may still cap very large files" - UNVERIFIED number;
     must be measured on the real Vercel deployment, not assumed).
  2. The route buffers the whole file in memory -> function MEMORY scales with file size.
  3. Function DURATION scales with upload time; no `maxDuration` is set, so the platform
     default applies (the `.MOV` failing "after ~40s" may be a timeout OR the storage 400
     - ambiguous; resolve empirically).
- So A is "cheap if it works," but whether it works for the real corpus size is an
  EMPIRICAL UNKNOWN that must be resolved before the founder commits (see Pre-decision
  measurements).

### B. Client-direct-to-storage upload (DEVIATES from spec 5.1; needs amendment)
- Bytes never transit the function: a server route mints a scoped upload grant
  (`createSignedUploadUrl`, or resumable/TUS per the ROADMAP's "resumable/direct-to-storage"
  note), the client uploads directly to Storage, then a server route does the
  `media_entries` INSERT against the already-uploaded path.
- REMOVES the function as the byte bottleneck (no body limit, no in-memory buffer, no
  duration-scales-with-size) - the only remedy that actually scales to large video.
- COSTS, each to be scoped by the implementing (EXECUTE) session AFTER the ruling:
  1. **Spec amendment to 5.1** (chat/Fable + founder) - the passthrough invariant is the
     thing being changed; this is the gating cost, not the code.
  2. **Re-ordered write**: insert-after-upload inverts today's upload-then-insert;
     rollback/orphan semantics change (a client-uploaded object with no row must be
     reaped). Define the failure model.
  3. **Storage policy review**: confirm a commissioner can mint a grant ONLY for their
     own `{league_id}/...` prefix, and that the signed-upload path's authorization
     interacts correctly with `league_media_commissioner_insert` (a signed-upload token is
     itself the grant; whether it rides or bypasses that INSERT policy is the precise
     question to answer - do NOT assume).
  4. **D3 poster path still holds** (poster is a separate small object; client already
     extracts it) - confirm it survives whichever upload mechanism B uses.

## Pre-decision measurements (resolve the empirical unknowns BEFORE ruling)

These make the ruling informed rather than speculative. They are diagnostics, not the
build - safe to run without ruling the gate:
- **M1 (gates remedy A):** on the real Vercel deployment, with the Storage per-file cap
  temporarily raised, attempt the real-corpus `.MOV` (and a deliberately larger file).
  Record: does the function receive the body at all, or is it rejected at the platform
  edge? At what size/duration? This single result can eliminate A outright.
- **M2:** capture the EXACT failure of the original 400 (status + body + timing) to settle
  the "storage cap vs function timeout" ambiguity. D2's new specific-reason path should
  now surface a distinguishable message - use it.

## What the ruling must produce (acceptance for THIS decision session)

- A binary pick: **A or B** (not "explore both").
- If **A**: a recorded measurement (M1) showing the real corpus fits, and the new honest
  ceiling (the value `MAX_UPLOAD_BYTES` should become); no spec change.
- If **B**: a founder-approved **spec 5.1 amendment** (authored in chat/Fable) plus a
  one-paragraph execution scope covering items B.2-B.4 above, handed to a subsequent
  EXECUTE (Opus/Claude Code) session as a normal section-5 execution brief.

## Conditional execution scaffolds (for the NEXT brief, AFTER the ruling - not this session)

- **If A:** founder raises the cap (dashboard) -> one-line code change to
  `MAX_UPLOAD_BYTES` -> rerun D1/D2 click-through at the new ceiling -> ledger. Small,
  single-topic, no schema/RLS.
- **If B:** new `createSignedUploadUrl` mint route (commissioner-scoped to the league
  prefix) -> client switches to direct upload + retains D3 poster part -> insert-after-
  upload route with redefined orphan reaping -> storage policy review/migration if needed
  -> governance gate (RLS) MUST stay green -> ledger + memo. Multi-step; pre-register the
  topics.

## OUT OF SCOPE (do not do in the decision session)

- Writing any code, migration, or `MAX_UPLOAD_BYTES` change - the gate is unruled.
- Authoring the spec 5.1 amendment text from this repo (chat/Fable + founder only).
- Video PLAYBACK and the voice-attestation class - separate DECIDE work, unspecified
  positive design (option-3 soft-tag attestation REJECTED 2026-06-10).
- Member testimony / Increment 2 - gated on E2.3.
- Re-litigating the A-vs-B framing into new options beyond the gate as set.

## Pointers

- Gate origin + prior framing: `_observations/session_brief_2026_06_10_w1_video_ingest_hardening.md`
  (D-W1-V1 section).
- Session of record for the hardening that made the cap honest:
  `_observations/OBSERVATIONS_2026_06_10_AV_ROOM_VIDEO_INGEST_HARDENING.md`.
- State ledger: `ROADMAP.md` (W.1 rows + "A/V Room - video increment" -> "Still open").
- Code: `src/app/api/av-room/upload/route.ts`, `src/lib/av-room-limits.ts`,
  storage policy `supabase/migrations/011_w1_av_room.sql:197-227`.
