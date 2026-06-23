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
| L.3 | **The Vault — capture slice** (D-L3-1..5, spec engine `fee0725`): compose -> grant `sealed_testimony` -> SEAL. Migration **017** widens the consent category CHECK (010-adjacent, founder-applied; GRANT is in-ceremony-only, D-SEQ-6); migration **018** is the two-table seal — `vault_sealed_letters` (readable metadata) + `vault_sealed_letter_bodies` (body behind **no read policy** = the seal, no role reads it pre-reveal), both append-only, plus `vault_seal_probe()`. Compose/seal surface at `/league/[id]/vault`, member-only `POST /api/vault/seal`. **G22** seal-fails-closed (inverse-of-G11). Discharged on gov **135/0** + 017/018 live on prod + a real member sealed a 2026 letter end-to-end + body unreadable by every role. **Reveal half deferred** (season-end successor, pairs with L.5). | Capture done; reveal deferred | `f0d2b04`, merge `4835c26` |
| L.1 | **Historian Interviews - capture-only first wave** (D-L1-1..6, S1..S6; spec engine `c9d32d5`): consented, attributed, append-only oral-history capture extending the founding pattern to members. Migration **019** widens the consent CHECK to add `oral_history_testimony` (010/017 idiom, founder-applied, GRANT-precedes-capture); migration **020** is the two-table append-only split - `member_history_sessions` (insert-once, member-identity-keyed via the franchises pointer) + `member_history_exchanges` (one row/turn, provenance NOT NULL `MEMBER_TESTIMONY`, author/admin-only RLS, no commissioner read); migration **021** `testimony_separation_probe()` proves THE PAYLOAD (no FK/trigger write path to the events ledger). Capture surface at `/league/[id]/history` reuses `lib/founding/*` by composition (diverge on per-turn-INSERT persistence). **G23** separation-fails-closed (inverse-of-G11). Discharged on gov **141/0** + 019/020/021 live on prod + a real member completed an interview end-to-end on the deployed routes (NEGATIVE: capture refused with no grant; GRANT precedes the first exchange; testimony attributed + unmerged; probe all-true). **DISPLAY half deferred** ("as remembered by" successor; pairs the two-layer rendering). | Capture done; display deferred | `e216bce`, `63a71ad`, `761fcf1`, `7a1894b`, merge `50741bf` |
| W.1 | A/V Room **Increment 1**: fail-closed room, photo ingest, five-kind provenance tagging, vacuous-tag rejection, correction-by-supersession, ratification, withdrawal, honest gaps; video present-but-not-playable (deferred) | Inc 1 done; video + member-testimony deferred | `c21e858`, `df79a4f`, `c284053`, `7eee29d`, `65da2e6` |
| W.1 | A/V Room **video-ingest hardening** (no playback): client-side size pre-check (D1), specific upload-failure reasons (D2), poster-frame as a derived rendition (D3, image-only). Makes the 50 MB cap honest; does not raise it (large-file ingest stays blocked on D-W1-V1). | Done | `7601f8c`, `b97b19c`, `99dafc0` |
| W.1 | A/V Room **Increment 2 - member captions (capture + two-layer display)** (D-W1I2-1..6; spec engine `905cb1c`): a consented, attributed, append-only member CAPTION on an A/V Room item, captured and displayed beside - and visibly distinct from - the human-ratified provenance facts (the two-layer rendering invariant, built here for the first time). Migration **022** widens the consent CHECK to add `media_caption` (019 idiom, founder-applied, GRANT-precedes-capture); **023** is the `media_captions` append-only table (`media_entry_id` the ONLY permitted FK = the item attach point; FACT layer + ledger walled; non-strippable value-pinned `MEMBER_CAPTION` stamp; member-only INSERT, no UPDATE/DELETE) + a nullable `caption_id` reuse of `media_display_withdrawals` (No-New-Foundations); **024** `caption_separation_probe()` proves THE PAYLOAD (no FK/trigger from a caption into `media_provenance_tag_events` or the ledger). Capture route `POST /api/av-room/caption` (GRANT-precedes-capture, route-enforced) + a structurally-distinct "as remembered by" panel beside the verified provenance panel, member-only composer. **G24** separation-fails-closed (inverse-of-G11). Discharged on gov **147/0** + 022/023/024 live on prod + a real franchise-linked member captioned end-to-end on the route (NEGATIVE: no grant -> refused, nothing stored; POSITIVE: GRANT precedes caption, verbatim + attributed + append-only, renders in the distinct panel; REVOCABLE-FORWARD: REVOKE withholds display, captured row intact). **MARGINALIA successor deferred** (communal multi-author annotation). | Done | `3f75597`, `dcbe2f5`, `3c66c33`, `699f0c6`, merge `b653c9c` |
| W.5 | Trophy Room **Championship Package** (increment 1; spec engine `OBSERVATIONS_2026_06_21_PHASE_11_W5_TROPHY_ROOM_SPECIFICATION_INC1`, taxonomy v1.2): grows the shipped flat `/league/[id]/trophy-room` into the custody-aware Trophy Room. Two data paths kept distinct (D1): migration **025** `trophy_custody_events` (the Belt's transfer LEDGER - append-only, RLS league-auth SELECT + commissioner-only INSERT, no UPDATE/DELETE; **C1: no stored holder column**, current holder = derived latest `to_franchise`); migration **026** `custody_integrity_probe()` proves append-only + no-stored-holder. Belt ratify route `POST /api/trophy-room/custody` (commissioner-only manual fact). Ring (mint-and-keep) + League Trophy (communal cumulative) are DERIVED reads off the championship record (no events). Sectioned Championship Package band: Trophy Cards (derived holder labeled-derived, Docket ID `TR-CP-1-<season>`, shared trust-bar/provenance module, `<details>` drill-ins), attested nameplate "Phony Football League" (C7), blank-not-guessed. **G25** custody-integrity-fails-closed (inverse-of-G11). Discharged on gov **154/0** + 025/026 live on prod + a real commissioner ratified two Belt transfers end-to-end (NEGATIVE: anon 401 / member 403, nothing stored; POSITIVE: derived holder = latest, transfer ordinal, "taken from" chain era-correct; band renders Belt/Ring/League-Trophy + attested nameplate + 16 derived rings/names). **Increments 2 (Live Records) + 3 (grants/accumulations/fixed) deferred.** No points / no transfer leaderboards / no streaks. **Follow-on: the commissioner Belt ratify UI shipped** (PR #28 `b764a3e`) - a commissioner-only form on the Trophy Room over the proven route; gating proven (commissioner sees it, member + anon do not); gov 154/0. | Done | `3554023`, `bdcaedb`, `56ecc54`, `bb1d490`, `88da08e`, merge `008ce16`; ratify UI `7d9ee82`, merge `b764a3e` |
| W.5 | Trophy Room **Increment 2 Wave 1 - Live Records (Group A)** (spec engine `OBSERVATIONS_2026_06_22_W5_INC2_LIVE_RECORDS_SPECIFICATION`): the Live Records section - 4 traveling-record plaques DERIVED off the synced `franchise_season_records` (008), **frontend-only, no migration**. #24 Cavallini Standard (all-time win-pct), #25 Dynasty (titles), #26 Eternal Runner-Up (runner-ups, no title), #30 The Floor (worst season, multi-valued on tie C6). Derived holders (C1, never stored), era-correct names, Docket `TR-LRC-<#>-<season>`, CANONICAL trust bar, "how the mark moved" drill-in (leader-over-time, replayed from completed seasons); reuses the inc-1 architecture. Discharged on gov **154/0** + an independent recompute matching the rendered page (Italian Cavallini .571 / Paradis' Playmakers 4 titles / Ben's Gods 3 no-title / Brandon Knows Ball 2025 .000). No leaderboard / streak / counter. **#29 Unbroken Chain (deferred) + increment 3 OUT OF SCOPE.** | Done | `f3a132b`, `d25d2ed`, `c6f0f2b`, `0864e1f`, merge `b223355` |
| W.5 | Trophy Room **Increment 2 Wave 2 - Live Records (Group B)** (cross-repo): #27 The Executioner (most wins by 60+, all games; holder Paradis' 0002) + #28 The Iron Curtain (best regular-season points-allowed avg; holder Italian Cavallini 0009), DERIVED off two new engine-derived columns. Migration **027** adds `points_against` + `blowout_wins_60` (nullable); the now-tracked engine generator pipeline (`gen_franchise_records.py`) computes them off `WEEKLY_MATCHUP_RESULT`, applied to prod by a **targeted UPDATE backfill** (160 rows, not a re-seed). Reads gated behind a graceful column-read so Wave 1 is unaffected pre-027; C1 derived holders, C6 multi-valued. **Corrected the brief's premise** (`franchise_season_records` is a generated seed, not a `sync_to_supabase` table) + committed the previously-untracked generators (provenance gap closed). Discharged on gov **154/0** + post-apply 160/0-null/total-blowout-60=80 + independent recompute matching the render. **#29 Unbroken Chain + increment 3 OUT OF SCOPE.** | Done | engine `0219b30` (PR #3); fe `a806fd0`, `9828690`, merge `9fba01f` |

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
- **L.1 Historian Interviews — capture-only first wave** — **DISCHARGED 2026-06-19**
  (merge `50741bf`, PR #25; see Milestones table). Discharge basis: migrations 019/020/021
  live on prod; governance **141/0** with G23 active; a real franchise-linked member (member
  `279af3cd`, PFL Buddies) completed an interview end-to-end against the deployed routes —
  the NEGATIVE case (no grant -> capture refused; REVOKE -> turn refused 403) and the POSITIVE
  case (GRANT precedes the first exchange; testimony stored attributed + unmerged, every row
  provenance-stamped; `testimony_separation_probe` all-true) both observed. Acceptance interview
  scrubbed post-proof (service role, one-time test hygiene; the `d298a2a` precedent). The
  **DISPLAY successor** ("as remembered by" rendering + commissioner read-at-display) is
  deferred, not foreclosed. Memo `_observations/OBSERVATIONS_2026_06_19_L1_HISTORIAN_CAPTURE_DISCHARGE.md`.
- **A/V Room — member captions (Increment 2)** — **DISCHARGED 2026-06-19**
  (merge `b653c9c`, PR #26; see Milestones table). Discharge basis: migrations 022/023/024
  live on prod `qcaxemuydxlzpzgnnnoa`; governance **147/0** with G24 active
  (`caption_separation_probe` all-true: only the `media_entries` item-attach FK, no FK/trigger
  into the FACT layer or ledger); a real franchise-linked member (member `279af3cd`, PFL Buddies)
  captioned an item end-to-end against the live route — NEGATIVE (no grant -> refused, nothing
  stored), POSITIVE (GRANT precedes the caption in `recorded_at`; body verbatim, attributed,
  append-only; renders in the visibly-distinct "as remembered by" panel, never merged into the
  provenance panel), and REVOCABLE-FORWARD (member-authored REVOKE withholds display, the captured
  row stays intact). Acceptance data scrubbed post-proof (service role; the `d298a2a` precedent).
  Display-withdrawal shape: reused `media_display_withdrawals` via a new nullable `caption_id`
  target column (No-New-Foundations). The **MARGINALIA successor** (communal multi-author
  annotation; "annotate another member's item"; still no reaction/engagement counts) is deferred,
  not foreclosed. Memo `_observations/OBSERVATIONS_2026_06_19_W1_INC2_CAPTIONS_DISCHARGE.md`.

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
