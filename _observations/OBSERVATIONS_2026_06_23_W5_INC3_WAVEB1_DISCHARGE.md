# OBSERVATIONS 2026-06-23 - W.5 Increment 3 Wave B1 (Cannon / Black Rose / One-Point Club) DISCHARGED

**Session type:** EXECUTE (Claude Code, Opus), cross-repo (engine generator already merged; this
session landed the FRONTEND branch + verified prod). Built/landed Wave B1 of the increment-3 spec
(engine `_observations/OBSERVATIONS_2026_06_23_W5_INC3_SPECIFICATION.md` section 4) - the first
tenant of the new `season_award_winners` table.

**Anchors:** frontend `98b08e0` -> merge **`c48838b`** (PR **#32**). Units `91744ad` (migration 028
`season_award_winners`) / `767f27b` (seed 004, 34 rows) / `0cb37cd` (3 derived reads in
`trophy-room.ts`) / `98b08e0` (acceptance proof). Engine generator `gen_season_award_winners.py`
born tracked at engine `6097e3b` (PR #5); its JSON output is the seed verbatim.

## What shipped
The three weekly-score-derived plaques on the Trophy Room, DERIVED off the new
`season_award_winners` table (engine-computed, immutable/append-only, one row per (award, season),
N on tie - C6). Holders are derived reads (C1, never stored), era-correct, gracefully silent if the
table is ever unseeded.

- **#4 The Cannon** - all-time highest single-week franchise score. Per-season max in; all-time max
  read out (Paradis' Playmakers, 2024, **198.8**). Per-season rows give a free chronological drill-in.
- **#12 The Black Rose** (tone-care) - all-time highest LOSING score. Same shape (Italian Cavallini,
  2019, **174.5**).
- **#33 The One-Point Club** (accumulating multi-list, C6) - championships decided by margin < 2,
  **winner only** (founder ruling 2026-06-23). Two members: 2013 -> Italian Cavallini (by 1.0),
  2019 -> Paradis' Playmakers (by 1.45).

`season_award_winners` (028): `id`, `league_id` FK->`leagues`, `award_id`, `season`, `franchise_id`
(canonical code resolved at read time - no hardcoded UUID FK), `value`, `detail jsonb`,
`provenance`, unique `(league_id, award_id, season, franchise_id)`. Seed 004 is idempotent
(DELETE awards 4/12/33 for league 70985, then INSERT 34 rows; BEGIN/COMMIT). Reads extend
`loadSeasonAwards` with a graceful `season_award_winners` read; Wave A unaffected.

## The recovery (honest record)
The prior session's manual prod apply **crashed mid-attempt and rolled back even the DDL** - this
session's FRESH pre-apply probe found `season_award_winners` ABSENT on prod (PGRST205, confirmed
genuine: every known post-024 object resolved while the target alone 404'd - schema cache was fresh,
not stale). So prod was a clean pre-apply slate, NOT a partial-row mess. The founder re-applied
migration 028 + seed 004 **manually via the SQL editor 2026-06-23** (table created clean from the
committed 028 verbatim -> repo == prod, no hardening needed), and the result was verified: **34 rows
= award 4:16 / 12:16 / 33:2**. No DB writes this session.

## Verification (the DONE bar - all met)
- **Fresh prod re-probe** (read-only, service role): `season_award_winners` present (HTTP 200, schema
  cache now sees it), **34 rows**, distribution **4:16 / 12:16 / 33:2**, all under league
  `00000000-0000-0000-0000-000000000001` (canonical 70985, "PFL Buddies"). Headline marks recomputed:
  Cannon 0002/2024/198.8, Black Rose 0009/2019/174.5, One-Point Club {2013:0009, 2019:0002}.
- **Provenance integrity** (verified, not trusted): committed seed 004 == committed generator JSON
  `scripts/season_award_winners_70985.json`, exact 34-row match.
- **End-to-end proof** (`scripts/proof_w5_inc3_waveb1.ts`, against the branch frontend on prod):
  independent recompute (service role) vs the rendered page - **11/11 ALL ACCEPTANCE CRITERIA MET**.
  Cannon/Black Rose/One-Point Club cards + holders + values, Docket IDs `TR-LRC-4/12/33`, CANONICAL
  trust label, Wave A intact (The Climb still present).
- **Frontend CI gates green on PR #32** (type-check + production build; Vercel deploy pass);
  `mergeStateStatus CLEAN`. Engine `prove_ci` green on its clean tree (`6097e3b`).
- **Governance unchanged at 154/0** - no new DB-object gate this wave (`season_award_winners` is an
  admin-bypass read table with no probe, the `franchise_season_records` idiom; the merge added no
  governance/probe files). The live-mutating governance suite was NOT re-run, to honor the
  no-DB-writes constraint.

## Notes
- **The One-Point Club build-pin is resolved**: founder ruled winner-only, margin < 2, on 2026-06-23;
  the ruling is baked into the committed generator and reflected in the seed (both qualifying rows
  carry the winner, with the runner_up recorded in `detail`).
- **Reads degrade gracefully** - the loader is written so an absent/unseeded table renders silent and
  leaves Wave A untouched, so the merge was safe in any order relative to the prod apply.

## Out of scope / deferred (registered, not built)
- **Wave B2** - 15 player-domain plaques, each gated on its D3 data-fact pin (extend the same
  `gen_season_award_winners.py` + `season_award_winners`; defer any award not exactly computable).
- The Founder's Seal (#31; attested + continuity-corroborated) and the Mantel / A/V Room.

**State at discharge:** frontend main `c48838b` (W.5 Inc 3 Wave B1 DISCHARGED, PR #32); engine
`6097e3b`; prod `season_award_winners` 34 rows verified; proof 11/11; governance 154/0 (no new gate).
