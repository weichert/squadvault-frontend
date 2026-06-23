# OBSERVATIONS 2026-06-22 - W.5 Trophy Room Championship Package DISCHARGED (increment 1)

**Session type:** EXECUTE (Claude Code, Opus), FRONTEND repo + prod. Built the first W.5 build
increment under the ratified spec (engine `OBSERVATIONS_2026_06_21_PHASE_11_W5_TROPHY_ROOM_SPECIFICATION_INC1.md`)
and build brief `SquadVault_EXECUTE_Brief_W5_Championship_Package_Build.md`. Taxonomy v1.2 is the
binding catalog input (engine `e36aa1d`).

**Anchors:** frontend `f05f1ac` -> merge **`008ce16`** (PR #27). Units `3554023` (025) / `bdcaedb`
(026 + G25) / `56ecc54` (derived reads + types) / `bb1d490` (ratify route) / `88da08e` (band +
nameplates) / `0575b13` (proof + fix); paste-safe fix `7a92bca`. Branch archived
`archive/w5-championship-package-merged-0575b13`.

## What shipped
Grew the shipped flat `/league/[id]/trophy-room` (championship-only) into the custody-aware Trophy
Room for the Championship Package. Two data paths, kept structurally distinct (spec D1):

- **The Belt (traveling)** - migration **025** `trophy_custody_events`, the append-only transfer
  ledger. RLS default-deny, SELECT league-authenticated, INSERT commissioner-only
  (`ratified_by = auth.uid()`, the Manual Fact Import frame), **no UPDATE / no DELETE**. THE C1
  INVARIANT: the current holder is a DERIVED read (the latest event's `to_franchise` per
  league+trophy), never a stored mutable column - the table has no holder/state column.
- **The Ring (mint-and-keep) + The League Trophy (communal cumulative)** - DERIVED reads off the
  championship record (`trophy_room_entries` entry_type=CHAMPIONSHIP). No custody events. The Ring
  frames one ring per champion-season; the League Trophy frames one perpetual cumulative name list.
- **026** `custody_integrity_probe()` + **G25**: the structural proof (the caption_separation_probe/
  G24, vault_seal_probe/G22 sibling) - asserts table exists, RLS enabled, no UPDATE policy, no
  DELETE policy, and no stored holder/state column. Booleans-only, fails-closed (inverse-of-G11).
- **Belt ratify route** `POST /api/trophy-room/custody` - commissioner-only; member/anon have no
  write path. Validates holder franchises belong to the league. Append-only (INSERT only).
- **Sectioned band + nameplates** - the Championship Package featured band above the chronological
  list. Three Trophy Cards: derived holder labeled-derived, transfer ordinal, Docket ID
  `TR-CP-1-<season>`, trust bar reusing the extracted shared `PROVENANCE_LABEL`/`PROVENANCE_STYLE`
  module (`lib/trophy-provenance`, spec section 6), native `<details>` drill-ins (provenance chain /
  accumulated lists, on tap). Governed nameplate = the attested PFL expansion "Phony Football League"
  (C7 closed 2026-06-21); a holder/champion with no fact renders blank, never guessed.
- Era-correct names throughout (`franchise_season_names`): a champion renders under its title-season
  name, never the current name.

## Prod probe + governance
- **FRESH pre-apply probe** (`scripts/probe_w5_preapply.ts`, before any apply): shipped substrate
  live, prod == repo at 024, `trophy_custody_events` + `custody_integrity_probe` absent.
- **Post-apply** (founder applied 025 -> 026 via SQL editor): both live; `custody_integrity_probe`
  all-true (table exists, RLS on, no UPDATE policy, no DELETE policy, no holder column).
- Governance **154/0**, **G25 green**, no G1-G24 regression.

## Acceptance proof (the DONE bar - all met)
End-to-end against the live ratify route + Trophy Room page as a real commissioner
(`steven.weichert@gmail.com`, PFL Buddies / slug 70985), headless-minted session:

1. **NEGATIVE** - anon `POST /api/trophy-room/custody` -> 401; non-commissioner member
   (`swickywick@yahoo.com`) -> 403; nothing stored.
2. **POSITIVE** - commissioner ratifies two Belt transfers (origin -> Stu's Crew 2024; Stu's Crew ->
   Paradis' Playmakers 2025 W9). Derived current holder = the latest `to_franchise` (Paradis',
   era-correct); transfer ordinal = 2; the chain carries "taken from Stu's Crew" + the occasion.
3. **DISPLAY** - the band renders on the page: the Championship Package band, the Belt/Ring/League
   Trophy cards, the attested "Phony Football League" nameplate, Docket ID `TR-CP-1-2025`, the
   "Current holder (derived)" label, and the derived Ring ("16 rings minted") + League Trophy
   ("16 names engraved") off the 16-season championship record.
4. Acceptance custody events **scrubbed** post-proof (service role); prod clean. The discharge basis
   is the observed pass, not persisted synthetic rows.

## Lessons / hazards (for the next sessions)
- **No semicolons inside SQL comments for SQL-editor-applied migrations.** The 025 apply first failed
  (42601) because the Supabase SQL editor's statement splitter breaks on `;` characters that sat
  inside `--` comments within the multi-line `CREATE TABLE` body, truncating the statement. The DDL
  was valid Postgres. Fix (`7a92bca`): strip every in-comment semicolon, keep column docs out of the
  statement body, ASCII only. Make founder-applied migrations paste-safe by default.
- **Adjacent JSX expressions split into separate text nodes** (React inserts comment markers
  between them), so a contiguous-substring assertion over the rendered HTML fails even though the
  page reads correctly. Use a single template-literal text node when a string must be contiguous
  (the "16 names engraved" fix). See [[next-build-typechecks-scripts]] for the related scripts lesson.
- **C1 is structural, not conventional:** the integrity probe asserts there is no holder/state
  column, so a future "optimization" that caches the current holder would fail G25, not pass silently.

## Out of scope / deferred (registered, not built)
- **Increment 2 - Live Record Plaques** (Group 2; derived transfers, multi-valued holder on tie).
- **Increment 3 - per-season grants / accumulations / fixed records** (Groups 3-5; derived/fixed,
  no transfer ledger).
- A **commissioner ratify UI** (the route ships; an in-room ratify control is a thin follow-on).
- The **Mantel / A/V Room** (W.1, A/V lineage) - sequences separately.

**State at discharge:** frontend main `008ce16` (W.5 Championship Package DISCHARGED); prod
`qcaxemuydxlzpzgnnnoa` at 026, `custody_integrity_probe` all-true; governance 154/0.
