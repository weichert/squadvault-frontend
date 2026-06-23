# OBSERVATIONS 2026-06-22 - W.5 Increment 2 Wave 2 (Live Records, Group B) DISCHARGED

**Session type:** EXECUTE (Claude Code, Opus), CROSS-REPO + prod. Built Wave 2 of the increment-2
spec (engine `_observations/OBSERVATIONS_2026_06_22_W5_INC2_LIVE_RECORDS_SPECIFICATION.md` section 4):
the 2 Group-B Live Records via a scoped engine->frontend data-generator extension + a targeted prod
backfill. (Brief premise corrected first: the data is a generated SEED, not a `sync_to_supabase`
table - see the engine close-out below.)

**Anchors:** engine `1ba54cf` -> `0219b30` (PR #3); frontend `a6eb95b` -> merge **`9fba01f`** (PR #30).
Engine units `d5de213` (track generators) / `e400625` (extend gen_franchise_records) / `4f0fd52`
(backfill mode) / `71f37fc` (fingerprint refresh). Frontend `a806fd0` (027 + reads) / `9828690`
(proof). Branches archived. Separate `fix(ci)` PR #4 (`b24e269`) greened engine main first.

## What shipped
- **#27 The Executioner** - most wins by 60 or more points (ALL decided games), max. Holder:
  Paradis' Playmakers (0002), 14 blowouts.
- **#28 The Iron Curtain** - best all-time points-allowed AVERAGE (REGULAR SEASON), min. Holder:
  Italian Cavallini (0009), 103.4 pts allowed/game.

Both derive off two new engine-derived columns on `franchise_season_records` (migration 027:
`points_against`, `blowout_wins_60`). The columns are computed by the now-tracked generator pipeline
(`scripts/gen_franchise_records.py` in the engine, off the same `HistoricalMatchup` stream) and
applied to prod by a TARGETED UPDATE backfill (160 rows), never a destructive re-seed. The
regular-season game count for the Iron Curtain average is derived frontend-side (`w+l+t` minus a
CHAMPION/RUNNER_UP championship appearance), so no count column. Both reads reuse the Wave 1 / inc-1
architecture (Trophy Card, Docket `TR-LRC-27/28`, CANONICAL trust bar, drill-in), C1 derived holders,
C6 multi-valued on tie.

**Graceful coupling:** the Wave 2 columns are read in a SEPARATE graceful query, so Wave 1's four
plaques keep working whether or not 027 is applied; the two new plaques render only when the columns
exist AND every row is backfilled (silence over speculation).

## Provenance gap closed (the load-bearing finding)
The brief assumed the engine computes + syncs `franchise_season_records` via `sync_to_supabase`. Git
showed otherwise: `sync_to_supabase` carries only artifacts/leagues/docket_ids/sync_log, and
`franchise_season_records` is a GENERATED frontend seed (`supabase/seed/003_pfl_buddies_real.sql`)
produced by `gen_franchise_records.py` -> JSON -> `gen_supabase_rebuild.py`, all previously UNTRACKED
in `~/sv-apply/`. The corrected mechanism (founder-confirmed): generator pipeline + targeted backfill,
not sync. The generators are now committed to the engine `scripts/` (the track-existing commit),
closing the untracked-prod-data-generator provenance gap.

## Verification (the DONE bar - all met)
- **Prod** (`qcaxemuydxlzpzgnnnoa`): fresh pre-apply probe passed (columns absent); post-apply 160
  rows, 0 null, total `blowout_wins_60` = 80 (exact match to the calibration probe).
- **End-to-end proof** (`scripts/proof_w5_wave2_live_records.ts`): independent recompute (service role)
  vs the rendered page - Executioner = 0002 (14), Iron Curtain = 0009 (103.4); Docket IDs, CANONICAL
  labels, Wave 1 intact.
- **Governance 154/0** (no new DB object -> no new gate); type-check + build green.

## Engine CI debt fixed en route (separate clean commit, PR #4)
Engine main had been red since ~2026-06-10 for two reasons unrelated to Wave 2: (a) `.github/
workflows/ci.yml` installed `hypothesis>=6.100` unquoted (the `>=` redirect wrote a stray `=6.100`
file, failing the repo-root allowlist test); (b) the docs-map allowlist test was not updated for 4
registered docs. Both fixed in a standalone `fix(ci)` PR so main greened on a clean commit (the
founder's instruction: no merge-despite-red). Separately, the two new `gen_*.py` generators are in
scope of the creative-surface fingerprint, so the canonical fingerprint was regenerated on the Wave 2
branch.

## Out of scope / deferred (registered, not built)
- **#29 The Unbroken Chain** - DEFERRED (playoff entrants not in the canonical event model).
- **Increment 3** (per-season grants / accumulations / fixed records); the Mantel / A/V Room.
- The on-disk seed `003_pfl_buddies_real.sql` was NOT regenerated (prod brought current via the
  backfill); the rebuild generator now carries the columns so a future re-seed is complete.

**State at discharge:** frontend main `9fba01f`, engine main `0219b30`; W.5 Inc 2 Wave 2 DISCHARGED;
governance 154/0.
