Session Brief — CO v2: Ambient State (Window Light by Real Date)

Date: 2026-07-05 (DECIDE-authored). Foundation: Coach Office Room v1 shipped 936a8ee; room-agnostic RoomScene shipped in W.2/CO. Scope: BOTH the Coach Office window and the Clubhouse/Community great-room windows. Gates: ⛔ G1 architecture + selector · ⛔ G2 tests · ⛔ G3 diff + eyeball. Repo: frontend.

## Kickoff

> You are the EXECUTE session for CO v2 Ambient State. Read this brief IN FULL, especially §2 (the constitutional line), then: the shipped RoomScene/room components (W.2 clubhouse + CO office instantiations), both rooms' manifests and master assets, and _observations/DECIDE_LANE_CONTINUITY_MEMO_v1_0.md (the no-engagement-loops principle). Two-lane discipline; three ⛔ gates. Hard rules: this feature is CONSTITUTIONAL ONLY in its static form — the window renders reflect the REAL current date/season as discrete static images selected at load; there is NO animation, NO transition, NO day/night cycle, NO live sun-tracking, and explicitly NO fireplace/fire/smoke motion — any of those is an engagement loop and is FORBIDDEN by the core principles (see §2, which records the ruling and its reasoning so no future session re-litigates it); the selector is a pure deterministic function of the real date; no invention; no engine changes; halt-don't-guess. Nothing pushed before G3.

## 1. Objective
Both rooms' windows reflect the real world at load time: the Coach Office Tahoe window and the Clubhouse great-room windows render a static image matching the current SEASON and TIME-OF-DAY (e.g. winter dusk, summer day). Implemented room-agnostically — one date→variant selector, one composite pattern, applied to both rooms via the shared RoomScene family. The room is "alive" by reflecting real state (like the trophy case reflects the record), never by motion.

## 2. The constitutional line (read first)
Static window light reflecting the REAL date is permitted: it is responsiveness to real state, ambient not attention-seeking, the same category as the trophy case reflecting the record and the ruled hearth-ember still-state. The following are FORBIDDEN as engagement loops under the core principle "no engagement loops, ever": animated light transitions, day/night cycles that play, live sun-position tracking, and any fireplace fire/smoke/ember MOTION. The founder proposed animated fire "to suggest time passing"; it was ruled OFF-constitution because it manufactures ambiance rather than reflecting a fact — recorded here append-only so it is not re-proposed. If a future founder wishes to revisit, that is a constitutional amendment, not an implementation choice.

## 3. What exists

The room-agnostic RoomScene family (shipped) — the window is a layer over the master; this unit swaps the window layer by date.
Both room masters (clubhouse w2_master, office co_master_web) with their window regions.
The window-variant renders — on the render queue (CO-R4-clean prompts authored: 4 office states + 4 clubhouse states, viewpoint-consistent). Step 0 lands whatever variants exist; the unit degrades gracefully (a missing variant falls back to the base master's default window — never a broken surface).

## 4. The date→variant selector + composite

selectWindowVariant(now: Date): { season, timeOfDay } — pure, deterministic, testable; maps real date → one of the discrete variant states. No clock ticking on screen; evaluated once at load.
Composite: the selected window-region render layers over the room master (the same layer pattern the RoomScene already supports), room-agnostically (office and clubhouse pass their own variant sets).
Graceful fallback: variant absent → base master's built-in window (never broken, never blank).

## 5. Constitutional constraints
Static only, selected by real date (§2) · NO animation/cycle/tracking/fire-motion · pure deterministic selector · no invention · graceful fallback to base master · room-agnostic (no room-specific logic in the selector) · CO-R4 (renders carry no baked text) · no engine changes.

## 6. Procedure
Step 0 — Ritual + reading + assets (identity, HEAD, tsc; read RoomScene, both masters/manifests, §2; land whatever window variants exist, note which are pending). Step 1 — Architecture (no build): the pure selector, the composite/layer approach for both rooms, the fallback, the variant-asset mapping. ⛔ G1. Step 2 — Tests first: selector is pure/deterministic (fixed date → fixed variant, all seasons/times covered); fallback when a variant is absent (never broken); NO animation/timer/interval in the code (assert no setInterval/requestAnimationFrame in the window layer — the anti-engagement-loop guard as a literal test); room-agnostic (both rooms drive from the same selector). ⛔ G2. Step 3 — Build + prove: selector + composite for both rooms; tsc/build/vitest green; both rooms' existing regressions intact; zero engine changes. ⛔ G3: diff + founder eyeball on prod preview (the window matches the real season/time; no motion anywhere; both rooms).

## 7. Successor gate notes
G2's most important test is the NEGATIVE one: assert the window layer contains no animation primitive (setInterval/setTimeout-loop/requestAnimationFrame) — this is the mechanical guard that keeps the feature static and constitutional. G1: confirm the selector is a pure function of the passed date with no side effects. G3 eyeball: the window reflects the actual current season/time, and there is zero motion in either room.

## 8. Acceptance
Both rooms' windows reflect the real date/season as static renders; pure deterministic selector proven; graceful fallback proven (never broken); NO animation primitive present (asserted by test); room-agnostic; no baked text; no engine changes; tsc/build/vitest/CI green.

## 9. Out of scope
Any animation, transition, day/night cycle, or live tracking · fireplace fire/smoke/ember MOTION (forbidden, §2) · weather beyond season (a v3 note, still-static-only) · non-window ambient effects · personal media / team logo (separate briefs) · engine changes — no engine changes.
