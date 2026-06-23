# OBSERVATIONS 2026-06-23 - W.5 Increment 3 Wave A (Grants / Fixed / Multi-list) DISCHARGED

**Session type:** EXECUTE (Claude Code, Opus), FRONTEND repo. Built Wave A of the increment-3 spec
(engine `_observations/OBSERVATIONS_2026_06_23_W5_INC3_SPECIFICATION.md` section 3). Frontend-only:
no migration, no engine code, no DB writes - 8 derived reads off `franchise_season_records`.

**Anchors:** frontend `7e0ee94` -> merge **`e9ab712`** (PR #31). Units `c542cd7` (loaders) /
`e9059e4` (section components) / `9457b77` (page wiring) / `c1418c8` (acceptance proof). Engine
inc-3 chain at `4a4841e`.

## What shipped
The Annual Awards + Permanent Records sections on the Trophy Room, 8 plaques, all DERIVED off
`franchise_season_records` (no migration, no custody ledger). Each holder is a derived read (C1,
never stored), multi-valued on tie (C6, via the existing `leaders()` helper), era-correct where
season-bound.

- **Annual (per-season grants)** - latest-season holder + per-season history drill-in:
  - **#2 The Bridesmaid Bouquet** - this season's runner-up (Weichert's Warmongers, 2025).
  - **#5 The Sieve** (tone-care) - most points allowed in a season (Weichert's Warmongers, 1957.3).
    Self-gates on `points_against` (inc-2 Wave 2, migration 027) - **LIT** this wave (column present +
    fully populated on prod).
  - **#8 The Climb** (C4) - biggest year-over-year win-pct gain (Miller's Genuine Draft, +.595).
  - **#10 The Banner** - best record this season (Paradis' Playmakers, .889).
  - **#11 The Engine** - most points scored this season (Paradis' Playmakers, 2482.3).
- **Permanent**:
  - **#32 The Inaugural Champion** (fixed) - the 2010 champion (Robb's Raiders).
  - **#34 Back-to-Back** (list) - champions in consecutive seasons (2019-2020).
  - **#35 The Perfect Storm** (multi-list; tone-care) - every winless season (1 entry).

Reuse: refactored `live-records.tsx` to export `TrophyCard` + a generic `RecordSection` (LiveRecords
is now a thin wrapper); `season-awards.tsx` adds the Annual section, the Permanent section, and a
`ListCard` for the two multi-lists. The loader reuses `leaders` / `winPct` / `fmtPct` / the era-name
maps / the graceful `points_against` read. No counts-as-contest, no leaderboard, no live counter.

## Verification (the DONE bar - all met)
- **Fresh prod probe** (the Sieve gate, before any code): `points_against` PRESENT, 160 rows, 0 null
  -> **The Sieve lights this wave**; `points_for` non-null (The Engine ships).
- **End-to-end proof** (`scripts/proof_w5_inc3_wavea.ts`): independent recompute (service role) vs the
  rendered page - all 8 holders/values match; Docket IDs `TR-LRC-2/5/8/10/11/32/34/35`, CANONICAL
  trust labels, the Back-to-Back span + the Perfect Storm winless entry all rendered. 14/14 assertions.
- **Governance 154/0** (frontend-only; no new DB object -> no new gate); type-check + production build green.

## Notes
- **The Sieve is LIT, not pending** - `points_against` was applied to prod in the inc-2 Wave 2 session
  (migration 027 + backfill). No follow-up needed; the self-gating `hasPA` pattern would have rendered
  it silent had the column been absent.
- Two-data-source consistency: Bridesmaid + Sieve both land on Weichert's Warmongers (2025 runner-up
  who also allowed the most points) - a fact, rendered factually (tone-care, no mockery).

## Out of scope / deferred (registered, not built)
- **Wave B1** - #1 Cannon / #3 Black Rose / #4 One-Point Club via a new `season_award_winners` table +
  migration ~028 + a weekly-score generator (its own engine + frontend arc).
- **Wave B2** - 15 player-domain plaques, gated on D3 (defer if not exactly computable).
- The Founder's Seal (attested + continuity-corroborated) and the Mantel / A/V Room.

**State at discharge:** frontend main `e9ab712` (W.5 Inc 3 Wave A DISCHARGED); governance
154/0; no migration this wave.
