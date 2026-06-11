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
| W.6 | Member consent (D-V/D-X): `member_consent_events` foundation + member consent panel + write path; `founding_sessions.consent` reinterpreted as league-defaults layer | Done | `d58191b`, `06cf568`, `6c2ed32`, `248895c` |
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
- **Ingest ergonomics round 2 — DONE on branch, in PR #13; DISCHARGE HELD pending
  founder click-through.** D1 ingest thumbnails use the set poster (`ea63a51`); D2
  compact rows + detail behind per-item expand (`8ffe2c1`); D3 deterministic
  find-without-scrolling filters — kind/season/event/withdrawn + substring, compose by
  AND, no ranking (`b2acded`). Branch `feat/w1-ingest-ergonomics-r2` off `b5f5bf6`.
  Memo `_observations/OBSERVATIONS_2026_06_11_AV_ROOM_INGEST_ERGONOMICS_ROUND_2.md`.
  Discharges once the founder click-through passes (poster thumbnails on ingest,
  expand/collapse density, filter to a single item two ways).
- **Video playback + the voice-attestation class** — still BLOCKED; the positive
  design is unspecified (option-3 soft-tag attestation REJECTED 2026-06-10). DECIDE
  work (chat/Fable) — the next DECIDE moment. Shares the **attestation class + 2b
  playback gate** (attestation is its own class, not a sixth provenance tag).

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
