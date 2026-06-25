# OBSERVATIONS 2026-06-24 - W.5 Display name format (RENDER layer) + #23 skill-floor reseed

**Lane:** EXECUTE (Part 2 of 2). **Frontend:** from `d141147`. Paired with the engine #23 skill-floor (FACT
layer). Two layers kept separate: the seed/detail keep `player_directory`'s canonical "Last, First"; the
display formats to "First Last". Render-only - no schema, no migration.

## What shipped (frontend)
- **Reseed**: `supabase/seed/004_season_award_winners.sql` regenerated from the merged engine generator -
  delta vs the prior seed is ONLY #23's four changed seasons (2014/2018/2019/2022 -> Hopkins/Lindsay/
  Andrews/J.Williams); 0 non-#23 lines changed; 256 rows. Names in the seed stay canonical "Last, First".
- **`formatPlayerName(raw)`** (`src/lib/trophy-room.ts`, exported): split on the FIRST comma ->
  "{rest} {last}"; no comma -> return raw unchanged (fail-safe); trailing comma -> last only. Handles
  person ("Vick, Michael" -> "Michael Vick"), apostrophe ("Bell, Le'Veon" -> "Le'Veon Bell"), D/ST
  ("Patriots, New England" -> "New England Patriots"), and suffix ("Beckham Jr., Odell" -> "Odell Beckham
  Jr." under first-comma split - no current winner carries a suffix, so it's a guard).
- **Applied in `allTimeCard`** (the loader path): `playerName` is formatted from `detail.player_name`; the
  #4/#12 callers carry no `player_name` (null) -> not formatted -> byte-identical. `TrophyCard` is unchanged
  (renders the already-formatted string).

## Proof
- **Reseed delta**: only #23's four seasons differ; #13-#22 + all other rows byte-identical; 256 rows
  (no silence). All-time #23 face stays Vick 352.00 / 2010.
- **Formatter unit proof** (`scripts/proof_w5_lifeline_name_format.ts`, `npx tsx`): 10/10 - person,
  apostrophe, D/ST, suffix (first-comma), no-comma fallback, trailing-comma, + the four upgraded #23 names.
- **Render regression**: Cannon/Black Rose byte-identical (no `playerName`). typecheck + production build
  green.

## The four upgraded #23 cards (rendered, post-apply)
2014 DeAndre Hopkins 108.0 (WR) | 2018 Phillip Lindsay 99.2 (RB) | 2019 Mark Andrews 115.0 (TE) | 2022
Jamaal Williams 81.6 (RB). The previous kicker/defense winners (Vinatieri, Crosby, NE Patriots, Bass) are
gone from #23 by the skill-floor (they remain eligible only for #17 The Boot / #18 The Wall).

## Prod-apply (FOUNDER-gated; NO prod write)
The formatter auto-deploys on merge (Vercel) - every #13-23 name renders "First Last" immediately. The
upgraded #23 DATA needs the founder's seed re-apply (same idempotent DELETE+INSERT; only #23 differs). Until
re-apply, the four seasons still show the old kicker/defense winners (but now formatted "First Last").

## Guardrails
The stored fact stays canonical (no name reformatting in the seed). CANONICAL trust bar. Silence over
speculation. No leaderboard. Era-correct franchise names unchanged.
