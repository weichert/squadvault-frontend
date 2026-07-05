Session Brief — Trophy Room Illustrated Display

Date: 2026-07-05 (DECIDE-authored). Foundation: W.5 Trophy Room data COMPLETE and live (verify at HEAD — 31 awards + Founder's Seal at /league/70985/trophy-room). Gates: ⛔ G1 architecture + highlight design · ⛔ G2 tests · ⛔ G3 diff + eyeball. Repo: frontend.

## Kickoff

> You are the EXECUTE session for the Trophy Room Illustrated Display. Read this brief, then: the shipped trophy-room page and its data resolver (lib/trophy-room.ts — the source of the 31 awards you will render, UNCHANGED), the CO.3 viewer-context resolver (resolveCoachOfficeViewerContext — you consume it for Option A highlighting), the room-agnostic RoomScene/RoomModal family (reuse where it fits the gallery), the trophy title-overlay package in Trophy Images/ (PFL_Award_Title_Overlay_Manifest_v2_1.json + CSS — the CO-R4 runtime-text mechanism), and the trophy asset audit. Two-lane discipline; three ⛔ gates. Hard rules: this is DISPLAY-ONLY — you render existing shipped award data as illustrated trophies instead of text cards; you do NOT touch the trophy data, the resolver, the taxonomy, or any award fact; no invention (every trophy shown corresponds to a shipped award; no award gains or loses a trophy); CO-R4 (trophy art is text-free; award title, winner, year, and provenance overlay at runtime from data, never baked); viewer-aware highlight is REFLECTIVE not gamified (Option A — see §3); no progress meters, no "X of Y earned," no "next trophy" — those are engagement loops and are forbidden; no engine changes; halt-don't-guess. Nothing pushed before G3.

## 1. Objective
Replace the trophy room's text cards with the illustrated trophies the founder rendered: each of the 31 awards (+ Founder's Seal) displays its trophy image with title/winner/provenance overlaid at runtime (the existing two-tier provenance treatment preserved). Grouped by the shipped taxonomy (Championship Package, Live Records, Annual Awards, Positional Records, Auction & Acquisition, Permanent Records). Viewer-aware per Option A (§3). The expandable "HOW THE MARK MOVED" histories and the ATTESTED/Source-Facts-Verified provenance badges are PRESERVED — this is a visual upgrade of the same data, not a redesign of it.

## 2. What exists (verify at HEAD)

W.5 Trophy Room data + resolver + page — SHIPPED, live, 31 awards. This unit reskins the display; the data layer is untouched.
CO.3 viewer-context resolver (owner/commissioner/league-mate/public) — consumed for Option A.
The room-agnostic component family — reuse where the gallery benefits.
40 trophy renders (CO-R4 clean, 38 needing knockout — see §4) + the runtime title-overlay package.

## 3. The gallery + viewer-aware highlight (Option A)

Each award renders its trophy plate with runtime-overlaid title/winner/year/provenance (per the overlay manifest). Empty/not-yet-won awards (if any) show their trophy in an "unclaimed" treatment, honestly — never fabricated.
Option A highlight (reflective, constitutional): when a signed-in member views the room, awards they currently hold (their franchise is the derived holder) receive a subtle visual emphasis — a warm glow/accent marking "yours," via the CO.3 viewer context matched against each award's derived holder. This reflects real state per viewer (like the office trophy case), nothing more.
FORBIDDEN (record in the brief): no count of trophies earned, no progress toward unearned awards, no "next"/"X of Y"/collection meter, no leaderboard of who holds most. Highlighting shows what IS; it never gamifies what could be. A negative test asserts no such counter exists.

## 4. Asset dependency (Step 0 gate)
The 31 award→image mappings are founder-confirmed at Step 0 (the audit proposed them; the founder ratifies the final mapping and variant-cluster keepers). 38/40 plates need background knockout to true alpha (the knockout-proof result governs batch-vs-rerender); ~4 award slots may lack art (The Belt at minimum) and either await a render or show a dignified text-only fallback for that award until art lands. The I32 "Oracle/crystal-ball" image is EXCLUDED per founder ruling (prediction theme violates the no-prediction principle). Step 0 lands only knocked-out, mapping-confirmed plates into public/trophy-room/; awards without ready art use the current text card as graceful fallback — the room is never broken, mixed illustrated/text is acceptable during art rollout.

## 5. Constitutional constraints
Display-only (no data/resolver/taxonomy change) · no invention (trophy ⇔ shipped award, 1:1) · CO-R4 (text-free art, runtime overlay) · Option A reflective highlight only, no gamification (negative test) · provenance two-tier treatment preserved · graceful fallback (award without art → text card, never broken) · Oracle excluded · no engine changes.

## 6. Procedure
Step 0 — Ritual + mapping + assets: identity, HEAD, tsc; founder confirms the award→image mapping + variant keepers; land knocked-out mapping-confirmed plates into public/trophy-room/ (webp-optimized per the W.2 pattern, alpha verified); note which awards lack art (text fallback). Step 1 — Architecture (no build): the gallery layout per taxonomy group, the runtime overlay wiring (title/winner/provenance from the existing resolver + overlay manifest), the Option A highlight via CO.3, the fallback rule. ⛔ G1. Step 2 — Tests first: every shipped award renders (illustrated or text-fallback, never missing); overlay text is runtime-data not baked; Option A highlight fires for a viewer's held award and NOT for others; the NEGATIVE gamification test (no counter/progress/next primitive); provenance badges preserved; no data/resolver change. ⛔ G2. Step 3 — Build + prove: gallery + overlays + highlight; tsc/build/vitest green; the shipped trophy-data tests untouched and passing; zero engine changes. ⛔ G3: diff + founder eyeball on prod preview (the room reads as illustrated trophies; a member's own trophies glow; provenance and histories intact; text-fallback awards look intentional).

## 7. Successor gate notes
G1: confirm the resolver and taxonomy are consumed unchanged — this is a reskin, drift into "improving" the data is out of scope. G2's most important test is the NEGATIVE one: assert no gamification primitive (no earned-count, no progress, no "next"). G3 eyeball: illustrated trophies with runtime titles read true; own-trophy highlight is subtle and reflective; mixed illustrated/text (during art rollout) looks intentional, not broken.

## 8. Acceptance
All 31 awards render (illustrated or graceful text fallback); runtime title/winner/provenance overlay (no baked text); Option A highlight proven (fires for held, not for unheld); negative gamification test passes; provenance two-tier + histories preserved; Oracle excluded; data/resolver/taxonomy untouched; zero engine changes; tsc/build/vitest/CI green.

## 9. Out of scope
Any trophy-data/resolver/taxonomy change · new awards · gamification/progress/counters (forbidden) · the Oracle image · personal media / logo / ambient light (separate briefs) · engine changes — no engine changes.
