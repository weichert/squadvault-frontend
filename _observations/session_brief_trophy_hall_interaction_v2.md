Session Brief — Trophy Hall Interaction v2: Cases, Categories, Trophy Detail
Date: 2026-07-05 (DECIDE-authored). Extends: Trophy Hall v1 (8380a78). Gates: ⛔ G1 verify-v1 + interaction design · ⛔ G2 tests · ⛔ G3 diff + eyeball. Repo: frontend.

## Kickoff

> You are the EXECUTE session for Trophy Hall Interaction v2. Read this brief, then the SHIPPED Trophy Hall v1 (the room page, its gallery, the hall manifest, the RoomScene objects overlay, the provenance toggle, the viewer-holdings and provenance-receipt pure seams) and the parent Trophy Hall brief (36f8ca3). Your FIRST task (§2) is to verify what v1's interaction actually is — group-hotspot-opens-modal, or a flat all-cards-visible grid — because the design of v2 depends on it, and you must extend what shipped, not what a description assumed. Two-lane discipline; three ⛔ gates. Hard rules: pure presentation of the shipped fact layer (no fact/award creation; the detail view shows only what the resolver returns); CO-R4 (enlarged trophy art is the same text-free plate, all labels runtime-overlaid); the provenance toggle in the detail view reveals the shipped receipt (faithful, object-aligned — the v1 pure seams already prove this); reflective viewer-highlight only, no gamification (the v1 negative-scan test extends to v2); reuse the room components, no fork; no engine changes; halt-don't-guess. Nothing pushed before G3.

## 1. Objective
Add the interaction depth the founder envisioned atop the shipped v1 hall: a viewer clicks a case (a taxonomy group) → a category modal reveals that group's trophies → clicking an individual trophy opens a detail view showing the trophy enlarged (the illustrated plate at large scale, or the graceful text state), its winner/year, its full custody / "how the mark moved" history, and the provenance toggle revealing that trophy's receipt. Three layers: room → category → trophy. Viewer-relative throughout (the viewer's own trophies emphasized).

## 2. Step 0 verifies what v1 shipped (load-bearing)
Before designing, determine from the code: does v1's hall use group-based hotspots (a case click opens a category modal) or a flat grid (all award cards visible at once, no case-level click)? Report which. If group-hotspots shipped, v2 ADDS the trophy-detail third layer beneath the existing category modal. If the flat grid shipped, v2 ADDS both the case→category interaction AND the trophy-detail layer (a larger unit). Do not assume; read the gallery/page and report the actual interaction as the first G1 finding. The rest of the design (§3–§4) is written to extend whichever shipped.

## 3. The three-layer interaction

Room layer (shipped): the hall with its cases/zones by taxonomy group; the viewer-relative plinth hero.
Category layer: clicking a case/zone opens a modal of that taxonomy group's awards (trophies + winners + provenance), viewer's own emphasized. (Confirm vs. extend per §2.)
Trophy layer (new): clicking an individual trophy opens its detail view (§4). Each layer is dismissable back to the prior; keyboard-navigable; the room never dead-ends.

## 4. The trophy detail view (the new heart of v2)
For a single award: the illustrated plate shown ENLARGED (or the graceful text state if no art), the runtime-overlaid title/winner/year, the full custody / mark-movement history (the "how the mark moved" ledger, already shipped as data), and the provenance toggle revealing that trophy's receipt (two-tier badge, docket ID, fact ID, entered-into-the-record) — drawn from the v1 provenance-receipt seam, object-aligned (the shipped test already guarantees the right trophy shows the right receipt). This is where the provenance toggle lives most powerfully: one trophy, enlarged, and one tap to see everything true about it. Empty/unheld/no-art → honest states, never fabricated.

## 5. Constitutional constraints
Pure presentation (no fact/award creation) · CO-R4 (enlarged art text-free, runtime overlay) · provenance toggle reveals the shipped faithful, object-aligned receipt · reflective viewer-highlight, no gamification (v1 negative scan extends) · graceful empty/no-art states · reuse room components, no fork · fact layer + v1 seams consumed unchanged · no engine changes.

## 6. Procedure
Step 0 — Ritual + VERIFY v1 (§2): identity, HEAD, tsc; read v1's gallery/page/manifest/seams; report the actual shipped interaction. Step 1 — Design (no build): the three-layer navigation extending what shipped; the trophy detail view; the enlarged-art rendering; the provenance toggle in the detail; viewer-relative emphasis; dismissal/keyboard/empty rules. ⛔ G1 (leads with the §2 v1-interaction finding). Step 2 — Tests first: category modal shows the correct group's awards; trophy detail shows the correct trophy's art + winner + history + receipt (object-aligned, extending the v1 alignment test); enlarged art is runtime-overlaid not baked; viewer emphasis reflective; negative-gamification scan; no fact-layer/seam change; empty/no-art honest states. ⛔ G2. Step 3 — Build + prove: the interaction layers + detail view; tsc/build/vitest green; v1 + clubhouse + office regressions intact; zero engine changes. ⛔ G3: founder eyeball on prod preview — click a case → category → a trophy → detail; the enlarged trophy reads beautifully; the provenance toggle reveals its honest receipt; the viewer's own trophies are emphasized; nothing dead-ends.

## 7. Successor gate notes
G1's first finding is the §2 verification — state plainly what v1's interaction is, so the founder adjudicates extend-vs-add scope. G2's key tests: the trophy-detail object-alignment (the enlarged trophy and its receipt are the same award) and the negative-gamification scan. G3 eyeball: the three-layer drill-down feels natural, the enlarged trophy is the payoff, and the provenance toggle in the detail view is the values-demonstration at its most powerful.

## 8. Acceptance
Case→category→trophy-detail navigation works (extending v1's verified interaction); trophy detail shows enlarged art + winner + history + object-aligned receipt; provenance toggle in the detail reveals honest receipts; viewer-relative emphasis; graceful empty/no-art states; nothing dead-ends; keyboard-navigable; fact layer + v1 seams unchanged; zero engine changes; tsc/build/vitest/CI green.

## 9. Out of scope
Any fact-layer / resolver / seam change · new awards · gamification · the signed-in indicator (separate brief) · trophy art rendering (founder art-track) · nostalgic-accretion features · engine changes — no engine changes.
