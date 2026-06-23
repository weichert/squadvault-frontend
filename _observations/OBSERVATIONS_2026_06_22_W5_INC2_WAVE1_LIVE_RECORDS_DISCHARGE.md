# OBSERVATIONS 2026-06-22 - W.5 Increment 2 Wave 1 (Live Records, Group A) DISCHARGED

**Session type:** EXECUTE (Claude Code, Opus), FRONTEND repo. Built Wave 1 of the increment-2 spec
(engine `_observations/OBSERVATIONS_2026_06_22_W5_INC2_LIVE_RECORDS_SPECIFICATION.md`, memo 3, section 3).
Frontend-only: no migration, no schema, no engine code.

**Anchors:** frontend `a6eb95b` -> merge **`b223355`** (PR #29). Units `f3a132b` (loadLiveRecords) /
`d25d2ed` (Live Records section) / `c6f0f2b` (page wiring) / `0864e1f` (acceptance proof). Branch
archived `archive/w5-inc2-wave1-live-records-merged-0864e1f`.

## What shipped
The Live Records section of the Trophy Room, rendering the 4 **Group A** plaques - all DERIVED off
the existing synced `franchise_season_records` (migration 008), no new pipeline:

- **#24 The Cavallini Standard** - highest all-time win-pct (`sum(wins)/sum(games)` per franchise).
- **#25 The Dynasty** - most championships (`count(result='CHAMPION')`).
- **#26 The Eternal Runner-Up** - most runner-ups, no title (`count(RUNNER_UP)` where `titles=0`).
- **#30 The Floor** - worst single-season record (min season win-pct); **multi-valued on tie (C6)**.

Each holder is a DERIVED read (C1, never stored), labeled derived; the immutable qualification carries
no baked-in holder; names are era-correct (`franchise_season_names`, 009) for the season-specific
record (The Floor) and the current franchise name for the all-time aggregates. A `<details>` "how the
mark moved" drill-in shows the leader-over-time history, replayed from completed seasons (the computed
analogue of the Belt's ratified chain). Reuses the increment-1 shared architecture: Trophy Card idiom,
Docket ID (`TR-LRC-<#>-<season>`), the shared `PROVENANCE_LABEL`/`PROVENANCE_STYLE` module, `TrustBar`
(provenance CANONICAL - engine-derived facts). No leaderboard, no streak, no live counter (boundary):
the value and its history are displayed as record, not contest.

No manual custody ledger - a Live Record writes nothing; its holder is the current extreme value
(distinct from the Belt's `trophy_custody_events`, which Live Records do not touch).

## Acceptance proof (the DONE bar - all met)
`scripts/proof_w5_wave1_live_records.ts` INDEPENDENTLY recomputes the 4 records from
`franchise_season_records` (service role, not the app lib) and asserts the rendered
`/league/70985/trophy-room` matches. Against prod (PFL Buddies, 16 seasons):

- #24 -> **Italian Cavallini** (.571); #25 -> **Paradis' Playmakers** (4 titles); #26 -> **Ben's Gods**
  (3 runner-ups, no title); #30 -> **Brandon Knows Ball (2025)** (.000) - all era-correct.
- Page renders the Live Records section, all 4 cards, the holders, Docket IDs `TR-LRC-24/25/26/30`,
  the "Held by (derived)" labels, and the CANONICAL trust label.
- **Governance 154/0** (frontend-only; no new DB object -> no new gate); type-check + production build green.
- Read-only proof (no writes; nothing to scrub).

## Note / honest disposition
- **C6 multi-valued render not driven by a real tie.** PFL Buddies has a single worst season (no Floor
  tie), so the multi-valued RENDER path (all co-holders listed, "co-held" label) is logic-correct and
  exercised by the recompute (holders are arrays throughout), but not driven end-to-end by an actual
  tie. The same multi-valued path serves Cavallini/Dynasty/Eternal-Runner-Up ties; none occur in this
  data either. The capability is structurally present; this dataset just does not trigger it.
- **Era-correctness for all-time aggregates** uses the current franchise name (an all-time record spans
  every era, so there is no single season name); The Floor, being season-specific, uses the era name at
  the worst season. Recorded as the deliberate choice.

## Out of scope / deferred (registered, not built)
- **Wave 2** - #28 The Iron Curtain (points-against) + #27 The Executioner (blowout-60, the pinned 60+
  threshold) - needs the engine->frontend sync extension; a separate engine + frontend increment.
- **#29 The Unbroken Chain** - DEFERRED (playoff entrants not in the canonical event model).
- **Increment 3** (per-season grants / accumulations / fixed records); the Mantel / A/V Room.

**State at discharge:** frontend main `b223355` (W.5 inc2 Wave 1 DISCHARGED); governance 154/0;
no migration this Wave.
