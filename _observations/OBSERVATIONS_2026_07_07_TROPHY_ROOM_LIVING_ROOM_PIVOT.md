# Trophy Room "Living Room" pivot - G1/G2 execution (Steps 2+3)

Date: 2026-07-07. Session: Claude Code (Opus-class execution against the Fable G1/G2
rulings relayed by the founder). Feat commit: `603b469` on `feat/trophy-hall-v2`
(stacked on the v2 furnished-room tune `53b448f`). NOT pushed - G3 (founder eyeball on
the live preview) gates the push per the G2 clearance.

## What the rulings fixed (G1, all five ratified)

- **D-BANDS**: Case View marquees 5 real trophies large (viewer's held first, then
  docket), plus a "See all N" affordance reusing the shipped category grid - the
  complete set, no pagination, no hidden facts.
- **D-NAV**: the "Trophy Room" nav tab fronts the illustrated room (`/trophy-hall`);
  the full record (`/trophy-room`) is one tap deeper. Zero route changes.
- **D-LOWER**: lower panel carries a static descriptive category note, never
  fact-bearing; blank is the fallback.
- **D-PLINTH**: League Trophy + reigning champion on the plinth, full champion roll in
  the detail. The Ring is a Championship-case shelf object; the League Trophy never
  enters a case.
- **D-CASE-NAV**: Case View is a RoomModal-style in-room overlay; trophy detail stacks
  above; Escape closes top-first (the shipped v2 contract).

G2 rulings on the open items: (1) numeral ban on category notes ADOPTED (stricter than
the ruling's own "Six awards" example - counts in static copy drift); (2) placeOnBands
THROWS on >5 (fail loud, never silently truncate a fact); (3) the /trophy-room
route-hotspot pin RE-HOMED, not deleted; (4) trophy-preview OUT of scope this build.

## What shipped (all in `603b469`)

- **Assets**: `tr_master_web.webp` (baked room, 1672x941) + `tr_case_frontal_web.webp`
  (frontal case, 1122x1402), both founder-LOCKED, CO-R4-verified per MANIFEST.md
  provenance (md5s recorded there). The prior empty-case master (`th_master_web`) and
  its per-shelf `cases` geometry are SUPERSEDED (file kept on disk, no production
  reference remains - guard-tested).
- **Manifest v3** (`hotspots.json`): six case click zones (one per taxonomy group),
  the plinth zone, and the `case_view` block - header plaque, lower panel, and the five
  measured bands (four lit shelves + base counter), each with shelf + placard rects.
  `hotspots` is now empty (the reading chair retired with the old master). All rects
  are a G3 eyeball tune; retunes are zero-API-change.
- **Pure seam** `src/lib/trophy-room/case-view-bands.ts`: MARQUEE_BANDS=5,
  selectMarquee (held-first prefix), placeOnBands (throws on overflow), buildPlinth,
  championshipCaseObjects (Belt + Ring, never League Trophy), placardLine ("shared +N"
  co-held truth; "unclaimed"), truncatePlacard (visible ellipsis, prefix verbatim),
  CATEGORY_NOTES (numeral-free).
- **Case View** `src/components/trophy-room/case-view.tsx`: the frontal render as a
  RoomModal overlay; runtime header/placard/note text positioned by manifest geometry
  (no coordinate in code); band trophies constrained to a centered footprint; the
  full-record state is the shipped category grid (moved here as CategoryGrid, same
  markup). Shared trophy visuals (ShelfTrophy/EnlargedTrophy) moved here so imports
  stay one-directional (interactive -> case-view).
- **Interactive overlay** rewrite: room layer = case buttons + plinth button only
  (the room's trophies are baked art, not live objects). Details keep BeltDetailView
  (custody chain with relish, ATTESTED) + LiveRecordDetail (receipts) and gain
  RollDetail (League Trophy communal-perpetual framing / Ring mint-and-keep framing,
  both off the shipped champions read, CANONICAL, "an unnamed franchise" for era gaps).
- **Page**: master swap to tr_master_web; title/alt swept to "Trophy Room"; objects =
  fact-backed pairs + championshipCaseObjects; plinth = buildPlinth(pkg.champions)
  (the old viewer-held heroKey plinth is superseded - held emphasis now lives in the
  marquee ordering + glow); page-level "The full record ->" link under the room (the
  re-homed guarantee).
- **Nav**: the Trophy Room tab targets `/trophy-hall`; isActive covers both routes.
- **RoomModal**: additive optional `maxWidth` (default 420, existing callers pass
  nothing) + maxHeight/scroll on the card. The Case View passes 720. This is the one
  shipped-component touch beyond the ratified list - flagged for G3 review; the
  alternative (a forked dialog) would have violated the no-fork rule.
- **Naming sweep**: zero user-facing "Trophy Hall" remains (page title, alt text,
  provenance-toggle aria-label, comment mentions in room-scene/trophy-room.ts). Routes
  untouched. Guard-tested (title-case scan; lowercase route slugs exempt by form).

## Test package (Step 2, G2-cleared; all green at Step 3)

Two suites, 30 tests: `case-view-bands.test.ts` (pure contract: marquee min(5,N),
held-first, NO-HIDDEN-FACTS as a strict-prefix property against the shipped
categoryObjects ordering, placement purity + overflow throw, plinth roll + honest
gaps + blank-not-guessed, Belt+Ring-never-League-Trophy, placard honesty, note
constraints) and `trophy-room-pivot-guards.test.ts` (assets landed, master swap +
supersession, naming sweep, nav retarget, no routed sub-view + RoomModal reuse,
manifest v3 geometry: 5 bands in-frame top-to-bottom / header above / panel below /
zones-only cases covering exactly the six groups / plinth zone, gamification + CO-R4
extended). The shipped trophy-hall-manifest.test.ts route-hotspot pin was re-homed to
the page-level link with a supersession comment (G2 ruling 3). RED baseline was
exactly the 9 implementation-owed pins; 186/186 shipped tests stayed green throughout.

Gates: vitest 195/195; tsc clean; production build green at CI parity (Node 24,
NODE_ENV=production; route 4.93 kB).

## Live-preview eyeball - what was verifiable locally

Local `.env.local` carries PLACEHOLDER Supabase credentials ("local build only"), so
every league route 404s locally - a data-backed render is only possible on the
deployed preview. (The 500s seen first were the known Next 14 dev error-page bug
reacting to the 404, the CO.1 finding.) What WAS verified here: a geometry harness
overlaying the real manifest rects on the real renders with the components' own
percent math - case zones sit on the six painted cases with labels on the painted
plaques; plinth zone on the pedestal (nudged y 555->580 after the eyeball); Case View
header text centered on the painted plaque; band cards bottom out on the glass
shelves; placard bars read on the shelf front edges; the base band rests on the
counter with the note centered on the painted lower panel. The full furnished render
with real trophies is the founder's G3 on the Vercel preview.

## Answers and follow-ons

- **trophy-preview (G2 ruling 4 question)**: it is the league-home (Community) page's
  three-card championship preview section (`src/components/ui/trophy-preview.tsx`,
  shipped W.5/D8, "spare, no upsell"); its "Trophy Room" heading links to the
  `/trophy-room` fact page. Left untouched this build per the ruling. Candidate
  follow-on: retarget its heading to the illustrated room for nav consistency - one
  href, founder call.
- placeObjects + the HallCase shelf types remain in `hall-cases.ts` (their shipped
  tests are law) though the room no longer calls them; removal is a registered
  follow-on, not silent scope.
- Mobile: case zones + plinth are tappable overlay buttons; the Case View fits by
  viewport height. A dedicated small-screen pass (min target sizes on the room zones)
  is a G3-informed follow-on.
- Untracked `Trophy Images/` at repo root is the founder's source-asset folder - left
  untouched (source PNGs stay out of git per MANIFEST provenance policy).

## Deviations

- RoomModal additive `maxWidth` + scroll containment (above) - additive-optional
  idiom, existing callers render unchanged; flagged for G3.
- No ESLint run (repo has no config; CI runs type-check + build only - consistent
  with CO.1..CO.3 precedent).
