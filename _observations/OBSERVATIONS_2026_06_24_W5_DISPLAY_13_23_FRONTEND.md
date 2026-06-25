# OBSERVATIONS 2026-06-24 - W.5 Trophy Room Display #13-23 (Option A) - FRONTEND leg

**Lane:** EXECUTE (Part 2 of 2). **Frontend:** from `42595a3`. **Spec:**
`SquadVault_W5_Display_13_23_Specification_2026_06_24.md` (rev 2, Option A). Engine leg (detail.player_name)
is the paired engine PR. No migration, no schema change, no new Supabase table, no sync.

## What shipped (frontend)
Renders awards #13-23 in the Trophy Room with the player named on each card:
- **Reseed**: `supabase/seed/004_season_award_winners.sql` regenerated from the merged engine generator -
  name-enriched. Delta vs the prior 18-award seed is EXACTLY `detail.player_name` on the 154 single-player
  rows; fact tuples `(award_id, season, franchise_id, value)` byte-identical (proved).
- **`allTimeCard` lifted to module scope** (`src/lib/trophy-room.ts`): added `dir: 'max'|'min'` (default
  max) and reads `detail.player_name` into the holder. The #4/#12 callers use the default with a
  detail-less `saw` -> `playerName: null` -> byte-identical.
- **`loadPlayerAndAuctionAwards`**: reads award_ids 13-23 with `detail`, builds the era-name maps (keyed by
  canonical code, since season_award_winners.franchise_id is the canonical code), calls `allTimeCard` per
  catalog row. Returns `{ positional, auction }`, omitting zero-row awards.
- **`TrophyCard` player line** (`live-records.tsx`): renders `holder.playerName` as a secondary line only
  when present (wrapped in a keyed `Fragment` so absent -> identical DOM). #21 and every existing caller
  carry no name -> unchanged.
- **`player-auction-awards.tsx`** (new): two `RecordSection`s - "Positional Records" (#13-18), "Auction &
  Acquisition" (#19-23); each auto-omits when empty. Wired into `page.tsx` after `<SeasonAwards>`.

## Proof
- **Reseed delta** (engine-side, restated): 256 rows; 0 fact-tuple changes; detail minus player_name ==
  prior detail; player_name added to 154 rows == exactly the rows with a player_id; #4/#12/#33 unchanged.
- **Render regression**: Cannon (#4) / Black Rose (#12) byte-identical by construction - `allTimeCard` at
  defaults yields the same `LiveRecord` (playerName null), and `TrophyCard` with no playerName renders the
  same DOM (Fragment wrapper). typecheck + production build green.
- **Silence**: `loadPlayerAndAuctionAwards` returns empty arrays on no rows; `RecordSection` returns null
  when empty; a holder without `player_name` renders no player line. **Before the seed-004 apply the whole
  unit renders nothing** (the live render proof runs post-apply).

## All-time holders (the card faces, with names - from the regenerated seed)
#13 Signal Caller 724.0 -> Drew Brees (2011); #14 Workhorse 369.1 -> Christian McCaffrey (2019); #15 Deep
Threat 309.1 -> Cooper Kupp (2021); #16 Tight Window 260.3 -> Travis Kelce (2020); #17 The Boot 194.1 ->
Brandon Aubrey (2024); #18 The Wall 171.0 -> New England Patriots (2019); #19 The Steal 300.15 -> Dak
Prescott (2019, a $1 pick); #20 The Burning Money $65 -> Le'Veon Bell (2018, a held-out season - tone-care,
neutral register); #21 The Patience Premium 0.114 -> franchise 0002 (2025, franchise-level, no name); #22 The
Whale $76 -> co-held Saquon Barkley (2019) + Christian McCaffrey (2020); #23 The Lifeline 352.00 -> Michael
Vick (2010, his comeback season).

## Prod-apply (FOUNDER-gated; NO prod write)
The pending seed-004 hand-apply now targets the NAME-ENRICHED seed (idempotent DELETE+INSERT, supersedes the
prior 18-award seed cleanly - still one apply). The display renders the moment the seed is applied; nothing
renders before. The live render proof (recompute vs render, in the proof_w5_*.ts style) runs post-apply.

## Guardrails
`player_name` is a denormalized fact (`player_directory.name`), never invented. CANONICAL trust bar across
#13-23. Silence over speculation (empty -> omitted card/heading/line). C6 co-holders via the helper (#22 ->
two named holders). #20 neutral register. Era-correct franchise names. No leaderboard.

## Deferred (named, spec section 6)
Co-player names on same-franchise ties (card names the primary only); player team/position suffix.
