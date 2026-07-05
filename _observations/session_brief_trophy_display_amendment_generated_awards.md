Session Brief — Trophy Room Display Amendment: The Four Generated Awards

Date: 2026-07-05 (DECIDE-authored). Amends: the landed Trophy Room Illustrated Display brief (064716a). Foundation: engine DB-status read (2ee828d) established these facts exist. Gates: ⛔ G1 resolver-extension design · ⛔ G2 tests · ⛔ G3 diff + eyeball. Repo: frontend.

## Kickoff

> You are the EXECUTE session for the Trophy Room display amendment. Read this brief, then the landed parent brief (_observations/session_brief_trophy_room_illustrated_display.md), the shipped resolver (src/lib/trophy-room.ts — you EXTEND its award enumeration to read award_id 3/6/7/9, you do NOT touch the award facts or generators), the engine DB-status report (award_id 3=Hammer 24 rows, 6=Benchwarmer 16, 7=Clairvoyant 17, 9=Oracle 28 — GENERATED, engine-side), the artifact spec (PFL_Award_Artifact_Prompts — canonical slugs/definitions), and the staged trophy art (Trophy Images/staged/ — Hammer/Benchwarmer/Clairvoyant knocked-out CO-R4-clean; Oracle sundial art PENDING). Two-lane discipline; three ⛔ gates. Hard rules: DISPLAY-ONLY — you surface awards whose facts the engine already generated; you create NO fact, NO generator, NO award (narratives derived never fact-creating); the frontend reads what the engine produced; CO-R4 (art text-free, title/winner/provenance overlay at runtime); no invention; no engine changes; the four awards render on prod ONLY after the founder applies seed 004 (§4) — until then they are honestly absent, never faked; halt-don't-guess. Nothing pushed before G3.

## 1. Objective
Surface the four already-generated awards the frontend resolver currently ignores — Hammer, Benchwarmer, Clairvoyant, Oracle (award_id 3/6/7/9) — in the illustrated trophy room, each rendering its staged trophy art with runtime title/winner/provenance overlay, grouped into the shipped taxonomy, with the Option-A viewer-aware highlight from the parent brief. Result: the illustrated room grows from 32 to 36 fact-backed awards, zero engine changes.

## 2. What the engine verdict established
The engine read (2ee828d) confirmed: award_id 3/6/7/9 have generator blocks (gen_season_award_winners.py:495/549/577/603) AND generated winner rows (24/16/17/28) in the seed-004 winner set. The frontend trophy-room.ts simply does not enumerate them (0 hits in src/). This is a READ gap, not a fact gap — the amendment closes the read gap only.

## 3. The four awards + Oracle

Hammer / Benchwarmer / Clairvoyant — facts generated, art STAGED (CO-R4-clean, knocked out). Wire the resolver to read them; attach award_the_hammer / award_the_benchwarmer / award_the_clairvoyant.
Oracle (award_id 9) — fact generated (28 rows), but its SUNDIAL art is PENDING (the staged crystal ball is CLAIRVOYANT, not Oracle — see §7). Wire the resolver to read Oracle; until sundial art lands, Oracle uses the graceful text-card fallback (per the parent brief's fallback rule) — never broken, never the wrong art.
The three staged plates land into public/trophy-room/ (webp-optimized, alpha verified) at Step 0; Oracle's slot is text-fallback until art.

## 4. The seed-004 dependency (founder-gated)
The four awards' facts exist in the GENERATED seed-004 winner set, but per docs/STATE.md seed 004's PROD apply is a pending founder hand-apply. Therefore: the amendment is BUILT and TESTED against the generated data now, but the four awards render on PRODUCTION only after the founder applies seed 004 to prod. This apply is a founder act (like every prod write) — the session never touches prod. The resolver must handle "fact row absent in prod" gracefully (award shows its unclaimed/empty state honestly, never a fabricated winner) so that pre-apply prod is never broken and post-apply prod lights the awards up. State this explicitly; test both states.

## 5. Constitutional constraints
Display-only (no fact/generator/award creation) · reads engine-generated facts, never invents · CO-R4 (text-free art, runtime overlay) · graceful fallback (Oracle text-card until art; any absent-in-prod fact → honest empty state, never faked) · Option-A reflective highlight, no gamification (parent brief's negative test extends to these four) · seed-004 prod apply is a founder act, never a session write · no engine changes.

## 6. Procedure
Step 0 — Ritual + assets: identity (FAIL engine test), HEAD, tsc; land the 3 staged plates (webp, alpha verified); confirm Oracle text-fallback. Step 1 — Resolver-extension design (no build): how trophy-room.ts enumerates award_id 3/6/7/9, the fact-present vs fact-absent-in-prod handling (§4), the art-attach by slug, the taxonomy grouping, the Option-A highlight extension. ⛔ G1. Step 2 — Tests first: each of the four renders when its fact is present; each shows honest empty state when its fact is absent (the seed-004 pre/post-apply cases); Oracle text-fallback when art absent; runtime overlay not baked; no-invention (no award without an engine fact); Option-A highlight fires for held not unheld; the negative gamification test still passes; parent-brief regressions intact. ⛔ G2. Step 3 — Build + prove: resolver extension + art; tsc/build/vitest green; the shipped 32-award display + CO room + clubhouse regressions intact; zero engine changes. ⛔ G3: diff + founder eyeball on prod preview (against generated data: the four awards render with correct winners; Oracle shows text-fallback; own-trophy highlight works).

## 7. Open founder rulings (carry, do not resolve in this brief)

Clairvoyant imagery: the crystal-ball art is constitution-clean by FACT (retrospective optimal-start rate, no prediction) but READS as fortune-telling. Founder to rule: keep crystal ball, or swap to a non-prediction motif. Until ruled, the staged crystal ball is used.
Oracle sundial art + Cavallini re-check: Oracle needs sundial art; the audit's I03/I04/I34 "Cavallini sundials" may include mismapped Oracle art. Founder visual re-check outstanding. Until resolved, Oracle uses text-fallback.

## 8. Acceptance
Resolver reads award_id 3/6/7/9; the three staged awards render illustrated (Oracle text-fallback); fact-present and fact-absent-in-prod both handled honestly (no fabricated winner); runtime overlay not baked; Option-A highlight + negative gamification test pass; 32-award display + regressions intact; zero engine changes; tsc/build/vitest/CI green. Prod render of the four awaits the founder's seed-004 apply.

## 9. Out of scope
The Unbroken Chain (fact-blocked/DEFERRED — no generator, no fact; art staged but NOT wired; a future engine-generation unit, not this display work) · any engine change/generator/migration · seed-004 prod apply (founder act) · new awards · gamification · the Clairvoyant/Oracle art rulings (§7, founder) · personal media / logo / ambient (other briefs) · no engine changes.

---
## Cross-reference (appended 2026-07-05, append-only)
The parent Trophy Room Illustrated Display brief's exclusion of "The Oracle" (crystal-ball / prediction grounds) is FORMALLY REVERSED per _observations/OBSERVATIONS_2026_07_05_ORACLE_EXCLUSION_REVERSAL.md. That memo confirms the correction this amendment already reflects: the crystal ball is Clairvoyant (award_id 7); Oracle (award_id 9) is a sundial; both facts are GENERATED and retrospective (no prediction). The §7 open rulings are unchanged and remain founder calls — (a) the Clairvoyant crystal-ball imagery aesthetic, (b) Oracle sundial art + the I03/I04/I34 Cavallini re-check. The constitutional/exclusion question is CLOSED; only the aesthetic/art questions stay open.
