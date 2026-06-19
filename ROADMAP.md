# SquadVault Frontend — Roadmap

The single ordered record of frontend milestones. Before this file, milestone
state lived scattered across commit messages, chat history, and the Design
Brief. Commit refs are the canonical markers. Running observations and the
deploy-wiring record live in `_observations/`.

**Repo:** `weichert/squadvault-frontend` (Next.js 14 App Router, TypeScript,
Supabase, Tailwind, Vercel).
**Authoritative design source:** `SquadVault_Clubhouse_Design_Brief_v1_0.docx`.

---

## Current position

The core product surfaces named in the Design Brief are substantially complete.
The work has shifted from *building surfaces* to *connecting, hardening, and
documenting* them. Production is live on Vercel.

Every major route exists: landing, auth, community/Clubhouse (locked + active),
Commissioner Office approval queue, single-artifact review + First Approval
Ceremony, archive index and all four classes (recaps, records, rivalries),
Trophy Room, members (stub), and the full Commissioner Founding Session.

---

## Milestones

| # | Milestone | State | Key commits |
|---|-----------|-------|-------------|
| M0/M1 | Clubhouse scaffold + Supabase schema + magic-link auth | Done | `2134c0b` |
| M2 | Commissioner Office + approval ceremony (G-tests green) | Done | `eda8d39`, `a64704f`, `ad644bd` |
| M3 | Archive surfaces (index + recaps + records); data-cache fix | Done | `3466a65`, `bf6d396` |
| M4 | Surface surge: audience-split rendering, Trophy Room, Part VIII nav, role-aware 403, community section 7.1, F1 Rivalry Chronicle | Done | `97dd41c`, `8d0ae36`, `98b0724`, `8b7ba23`, `0bcf7fb`, `64d18ad`, `9e9b953`, `4f2e4e4`, `57bb1d8` |
| M5 | Commissioner Founding Session (State 3) + edge cases (F-4) | Done | `2012e0d`..`bbfc1c0`, `f68bc4a`..`d876d84` |
| Post-M5 | Deploy recovery + hardening: login Suspense build-fix, CI, `.nvmrc`, `vercel.json` framework guard, continuity scaffold | In progress | `b4219a0`, `397c215`, + this scaffold |
| W.6 | Member consent (D-V/D-X): `member_consent_events` foundation + member consent panel + write path; `founding_sessions.consent` reinterpreted as league-defaults layer. **NB:** migration 010 was committed here but only *applied to prod* 2026-06-18 in the E2.3 session (table + `member_consent_current` view were absent on prod until then; G11 false-passed on the missing table). | Done | `d58191b`, `06cf568`, `6c2ed32`, `248895c` |
| E2.3 | **Member onboarding minimal** (D-SEQ-2): magic-link invite + ratified franchise linkage. Migration 016 `franchise_member_links` (append-only, commissioner-write, no UPDATE/DELETE; sibling of 012/014/015); commissioner-only invite route + panel; `franchises.member_user_id` kept as derived pointer; G21 gov test. Discharged on 016-live + gov **129/0** (G21 active) + a real confirmed member linked (3 append rows + pointer) + read-model 2a-silence fail-closed via `member_consent_current`. Surfaced + applied the unapplied W.6 migration 010 (founder-approved). | Done | `0a72b16`, `6e49c26`, merge `5521637` |
| W.1 | A/V Room **Increment 1**: fail-closed room, photo ingest, five-kind provenance tagging, vacuous-tag rejection, correction-by-supersession, ratification, withdrawal, honest gaps; video present-but-not-playable (deferred) | Inc 1 done; video + member-testimony deferred | `c21e858`, `df79a4f`, `c284053`, `7eee29d`, `65da2e6` |
| W.1 | A/V Room **video-ingest hardening** (no playback): client-side size pre-check (D1), specific upload-failure reasons (D2), poster-frame as a derived rendition (D3, image-only). Makes the 50 MB cap honest; does not raise it (large-file ingest stays blocked on D-W1-V1). | Done | `7601f8c`, `b97b19c`, `99dafc0` |

Milestone numbering past M3 was assigned retroactively (work shipped without
labels); see `_observations/OBSERVATIONS_2026_06_04_CONTINUITY_SCAFFOLD.md`.

---

## Open work, by readiness

### Connect (highest product value)
- **Voice bridge** — founding Voice Profile -> engine recap voice. Cross-repo;
  build only when deliberately designed. (Engine never reads
  `voice_profile_id` today.)
- **E2.3-minimal — member onboarding** — **DISCHARGED 2026-06-18** (merge `5521637`,
  PR #23; see Milestones table). Discharge basis: migration 016 live (in fact already
  applied to prod 2026-06-13 during build-session click-throughs), governance **129/0**
  with G21 active, a real confirmed member linked (`franchise_member_links` = 3 append
  rows + `franchises` pointer), and the read-model 2a-silence verified fail-closed via
  `member_consent_current`. Surfaced + closed a prod gap: W.6 migration 010
  `member_consent_events` had never been applied to prod (G11 false-passed on the missing
  table); applied this session, founder-approved. Residual (not blocking): the
  `renders-with-grant` leg is correct by construction but was not live-exercised; **Bug B**
  (implicit-flow `/auth/callback` reads only `?code` and no-ops, so the commissioner-claim
  block may never fire) is a separate flagged unit. Memo
  `_observations/OBSERVATIONS_2026_06_18_E2_3_MINIMAL_DISCHARGE.md`.
- **A/V Room — member testimony (Increment 2)** — build-gated on **E2.3**
  (member<->franchise identity linkage). No member-facing write path exists yet;
  the 6.6 fail-closed 2a-silence path is structurally unexercisable until a
  franchise carries a linked `member_user_id` (spec 8.1 anchors the first live
  test there). See `_observations/OBSERVATIONS_2026_06_10_AV_ROOM_INCREMENT_1_CLICKTHROUGH.md`.

### A/V Room — video increment (next, on the proven Inc 1 foundation)
Hardening (no playback) shipped 2026-06-10 — `7601f8c`, `b97b19c`, `99dafc0`:
- ~~Surface upload-failure reasons to the commissioner~~ — done (D2, `b97b19c`).
- ~~Client-side size pre-check (fail fast before the round-trip)~~ — done
  (D1, `7601f8c`).
- ~~Poster-frame extraction as a derived rendition~~ — done (D3, `99dafc0`;
  original untouched 6.9, image-only, no 2b read).

Done + still open:
- **Large-file ingest (D-W1-V1 = remedy B) — DONE + DISCHARGED 2026-06-11.**
  Client-direct upload under a server-minted grant (Spec 5.1 Amendment 1); cap 1 GB.
  Merged `5c1550b` (PR #10). >4.5 MB photo PROVEN TRANSITIVELY (a 68.7 MB file rode
  the same grant transport on prod). Ruling `_observations/OBSERVATIONS_2026_06_10_DW1V1_RULING_REMEDY_B.md`.
- **Ingest ergonomics + room-poster (D0-D6) — DONE + DISCHARGED 2026-06-11.** D0
  commissioner set/replace poster + de-silence (the room showed placeholders because
  no poster objects existed, not a render bug); D1 drag-drop queue; D2 batch tagging;
  D3 compact rows; D4 newest-first ingest; D5 reinstate (migration 012 applied, G17);
  D6 HEIC honesty. Merged `c82bd5f` (PR #11); migration 012 live (governance 113/0);
  posters confirmed on prod. Memo `_observations/OBSERVATIONS_2026_06_11_AV_ROOM_INGEST_ERGONOMICS.md`.
- **Ingest ergonomics round 2 — DONE + DISCHARGED 2026-06-11.** D1 ingest thumbnails use
  the set poster (`ea63a51`); D2 compact rows + detail behind per-item expand (`8ffe2c1`);
  D3 deterministic find-without-scrolling filters — kind/season/event/withdrawn +
  substring, compose by AND, no ranking (`b2acded`). Merged `4c3251f` (PR #13).
  Memo `_observations/OBSERVATIONS_2026_06_11_AV_ROOM_INGEST_ERGONOMICS_ROUND_2.md`.
- **Ingest round 3 (performance at scale) — DONE + DISCHARGED 2026-06-11.** R3-D1 photo
  thumbnail renditions — lists serve thumb.jpg/poster.jpg, never the original; client-side
  canvas at upload + backfill + new `/api/av-room/thumb` (`6794744`). R3-D2 batch signing —
  one `createSignedUrls` round-trip per page, not N (`8e5db41`). R3-D3 list virtualization —
  `@tanstack/react-virtual` windows the DOM, filters operate on the full set; dev-only
  `?synthetic=N` harness (`dc06f11`). R3-D4 mobile function-at-width — explicit viewport,
  tap-to-choose upload, responsive tag form (`295844c`). Backfill names unreadable items
  (`609398e`). Merged `e684292` (PR #15; replaced #14, auto-closed when its stacked base
  branch was deleted on #13's merge). No new table; governance 113/0.
  Memo `_observations/OBSERVATIONS_2026_06_11_AV_ROOM_INGEST_ROUND_3.md`.
  Click-through finding folded to R4-D3: a HEIC/HEVC file renamed `.jpg` bypasses the
  extension-based D6 gate — fix is magic-byte content sniffing (memo
  `_observations/OBSERVATIONS_2026_06_11_AV_ROOM_R3_CLICKTHROUGH_HEIC_GATE.md`).
- **Ingest round 4 (the curator's bench) — COMPLETE + DISCHARGED 2026-06-11.** D1 quick-look,
  D2 download, D3 duplicate detection + HEIC content-sniff, D4 autocomplete + ordering
  assertion, D5 untagged queue, D6 keyboard-first, D7 retry-failed, D8 select-all-in-filter,
  plus jump-to-item, derived duplicate indicator, and the D-W1-E1 media expungement class.
  Migrations 013 + 014 applied; governance 115/0. The only W.1 ingest threads left are
  deferred-by-design: video playback / voice-attestation (a DECIDE session) and Increment 2
  member work (E2.3).
  - **R4-D3 deterministic duplicate detection + HEIC content-sniff — DONE + DISCHARGED
    2026-06-11.** Migration 013 (`content_hash`, a convenience not provenance) applied to
    prod + verified (column present, nullable). Byte-equality duplicate refusal ("already
    in the record" + override), HEIC-by-content refusal (no override; correct asymmetry),
    backfill (admin-client write after the silent-RLS-no-op fix), G18 append-only proof.
    Merged `339b73a` (PR #16). Governance 114/0. Founder click-through ALL PASSED (10
    entries / 0 NULLs; cross-kind + against-withdrawn matching; control upload prepends).
    Memos: `_observations/OBSERVATIONS_2026_06_11_AV_ROOM_INGEST_ROUND_4_R4D3.md`,
    `_observations/OBSERVATIONS_2026_06_11_AV_ROOM_R4D3_HASH_BACKFILL_RLS_FIX.md`.
  - **Continuation batch 1 — DONE + DISCHARGED 2026-06-11** (merged `a97fd15`, PR #18;
    founder click-through PASSED in full). R4-D1 quick-look (`a6aef39`), R4-D2 download
    original (`7d01097`), R4-D5 untagged work queue (`f2cf807`), R4-D8 select-all-in-filter
    (`6393b2a`), override-prepend fix (`2ef04bb`). Governance 114/0.
  - **Continuation batch 2 — DONE + DISCHARGED 2026-06-11** (merged `6f8dddb`, PR #19;
    migration 014 applied to prod; founder click-through passed). R4-D4 tag autocomplete +
    D4 ordering assertion (`6d8ed09`), R4-D7 retry-failed (`1eb5520`), R4-D6 keyboard-first
    (`312938a`), jump-to-item link (`8d7582c`), derived duplicate indicator (`a594cec`),
    media expungement (`7119651`), and two click-through fixes — stale-value-on-kind-switch
    + date validation, and no-retry-on-permanent-refusals (`37d6c0e`). **Governance 115/0
    (G19 active).** Memo `_observations/OBSERVATIONS_2026_06_11_AV_ROOM_ROUND_4_CONT_BATCH_2.md`.
  - **D-W1-E1 media EXPUNGEMENT class — ADMITTED + BUILT + DISCHARGED 2026-06-11** (founder,
    Fable chat; Spec 5.2 Amendment 1 ratified verbatim). Append-only, commissioner-ratified,
    reason-required expungement event that DELETES the stored bytes (original + renditions)
    and tombstones the entry (row never deleted; log testifies it existed and was expunged).
    Terminal (no reinstatement); content_hash survives so re-upload surfaces as
    duplicate-of-expunged. Merged `6f8dddb` (PR #19): migration 014 applied + verified (G19
    active, governance 115/0); expunge route (authed-insert event = license, then admin
    byte-delete), room excludes expunged, "Expunged" tombstone filter, Expunge action behind
    a required-reason confirm, dup-check distinguishes expunged. Post-E2.3 consent dimension
    deferred to Inc 2. Ruling memo
    `_observations/OBSERVATIONS_2026_06_11_AV_ROOM_DW1E1_EXPUNGEMENT_RULING.md`.
    **Engine-side follow-up still OPEN (next engine session, doc-only):** flip the parked
    candidate (engine memo `6dce2f6` + STATE.md Deferred line) PARKED -> ADMITTED.
  - Bright lines: no AI tagging/face-detection/AI-search; no gamification/streaks/nudges;
    no relevance ranking — filters/matches stay deterministic.
- **Video playback + the voice-attestation class (D-W1-A) — DONE + DISCHARGED 2026-06-11/12**
  (merged PR #21; migration 015 applied, governance 116/0; gate verified end-to-end - TTL
  600s on-token, expired-URL rejection observed, supersession gates forward, neutral refusal,
  no autoplay). DECIDE ruling Fable 2026-06-11 (mechanism spec under 5.7; option-3 REJECTED
  STANDS). Migration 015 `media_voice_attestations` + G20; route-enforced gate (Leg1
  attestation OR Leg2 2b-consent, A2a exclusion, fail-closed; `sign` variant `playback`, TTL
  600s, neutral 403); `/api/av-room/attest`; attestation UI + gated player. Four click-through
  fixes folded in (player wiring, overlay controls, local date, gated affordance). The one
  open limitation (corpus is iPhone HEVC; Chrome can't decode) is addressed by D-W1-A6. Memos
  `…_DW1A_VOICE_ATTESTATION_RULING.md`, `…_DW1A_VOICE_PLAYBACK_BUILD.md`.
- **D-W1-A6 playback rendition — DONE + DISCHARGED 2026-06-12** (merged PR #22; founder
  click-through complete). DECIDE ruling Fable 2026-06-12 (mechanism spec under 6.9; the
  b78070f LEAN precedent). A derived `playback.mp4` (H.264/AAC) sibling in poster.jpg's
  governance class: the sign route signs rendition-when-present-else-original (`cb04b02`,
  progressive enhancement, zero regression); client-direct upload via a new commissioner-only
  `/api/av-room/rendition-grant` (`4509397`, server-named path, video/mp4, upsert, no finalize);
  empty-file.type contentType guard (`6f2204b`, A6-4); CSP `media-src` fix (`b8c3cd2`) +
  quick-look portrait height fix (`93db8aa`). Verified end-to-end: rendition leg serves
  playback.mp4 (picture + sound), refusal cycle both directions, scrub-seek (closes the last
  D-W1-A flag). Governance 116/0. Memos `…_DW1A6_PLAYBACK_RENDITION_RULING.md`,
  `…_DW1A6_PLAYBACK_RENDITION_BUILD.md`. **Carry-forward candidates (not built):** a backfill
  script v2 (per-entry output path; refuse empty HASH; no false PAIRING on SKIP); same-footage-
  different-bytes duplicates evade the byte-hash detector (accepted limitation); an HDR-to-8-bit
  recipe v2.

### Harden / operate
- CI live on push/PR (this scaffold).
- `vercel.json` framework guard (this scaffold).
- `leagues.docket_code` governed column — when a second real league onboards.

### Deferred polish (decisions, mostly, not code)
- Full Member Office (stub today).
- Archive search.
- "This Week in History" (requires historical calibration, engine-side).
- Print stylesheet; light-mode toggle.

---

## Leagues (state of record)

- **PFL Buddies** — `canonical_id` `70985`, seeded `active`. The real league.
- **FOUNDING-TEST** — `canonical_id` `FOUNDING-TEST`, used for the founding
  walkthrough. Predates the auto-activate transition, so it may render
  LockedRoom; re-walk, use Office re-run, or set `status='active'` to view the
  established Clubhouse.

For the full open-decisions and cross-repo dependency picture, see the engine
gap analysis referenced in `_observations/README.md`.
