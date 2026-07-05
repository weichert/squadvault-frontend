# Session Brief — W.2 Clubhouse Cluster 1: The Room

Date: 2026-07-05 (DECIDE-authored; keystone unit per Completion Plan B2; guards A7/B1 discharged). Gates: ⛔ G1 scene architecture · ⛔ G2 wiring + states · ⛔ G3 built room vs master. Repo: frontend.

## Kickoff

You are the EXECUTE session for W.2 Cluster 1: the shared Clubhouse room. Read this brief, then docs/coach_office/RATIFICATION_MEMO_2026_07_04.md (CO-R1..R4 apply to any shared asset) and the W.2 canonical MANIFEST in the assets folder. Hard rules: the room is a door, not a replacement — every existing typographic surface remains the destination; no analytics; no baked text ships (the banner's text is a runtime layer); consent gates are law on any future personal content; assets land via git add of specific files only; halt-don't-guess.

## 1. Objective

A navigable illustrated Clubhouse at route /league/[id]/clubhouse: the locked Tahoe master as the room, manifest-driven hotspots over its objects routing to existing surfaces, input-driven parallax on plate-backed objects (graceful static fallback where plates are pending or motion-reduced), the banner rendering "PFL Buddies · Est. 1984" as a runtime text layer from getLeague data (never hardcoded), and a nav entry ("CLUBHOUSE") added without removing anything.

## 2. Scene architecture

Master as base layer, full-bleed, art-directed focal cropping at breakpoints (the fireplace stays central; mobile shows a vertical crop with all hotspots reachable by scroll/pan). Plates as absolutely-positioned layers above the master at their in-scene positions, translating subtly on pointer/gyro (parallax ≤ a few px per depth band; prefers-reduced-motion → static). Objects without landed plates get hotspot zones drawn directly on the master — identical interaction, no parallax, upgraded per-plate later with zero API change. Hotspot affordance: warm glow on hover/focus (the pack's own right-side-legibility note), visible focus states, full keyboard navigation, aria-labels naming each destination. Hotspot geometry lives in a manifest JSON (public/clubhouse/hotspots.json), not in components.

## 3. Hotspot wiring map

1. Trophy case → /league/[id]/trophy-room.
2. Mantel photos → /league/[id]/av-room (page-gated; anon → its existing bounce).
3. Corkboard → dignified pending state: modal, ceremonial register, "The corkboard hangs waiting. Notes arrive with the season." (W.3's slot — no dead end, no 404).
4. Boombox → inert character object v1 (subtle hover acknowledgment only; ambient-radio is a registered future ruling).
5. Safe → /league/[id]/vault (page-gated).
6. Guitar → inert character object.
7. Desk + lamp → /league/[id]/office (gated).
8. Cordless phone → inert character object.
9. Answering machine → pending state modal, unlit: "No messages yet. The machine is patient." (L.1 voicemail future).
10. Hearth → inert ambient (ember still; animated fire is the ratified future layer).

Pending-state copy above is founder-editable at G2.

## 4. Procedure

Step 0 — Assets. Copy the canonical set from the founder's Squadvault Images2 folder into public/clubhouse/ (master + every plate whose MANIFEST transparency status is clean; EXCLUDE the checkerboard-defect plates until their re-renders land), plus hotspots.json skeleton and a repo copy of MANIFEST.md. git add each file by name. Report total payload size; if the master needs a web-optimized derivative (target ≤ ~1.5MB via lossless-first optimization), produce it alongside the pristine original and note both.

Step 1 — Architecture spike (no full build): the layered scene component rendering master + one plate (corkboard) with parallax + one wired hotspot (trophy case) + reduced-motion fallback. ⛔ G1: demo state, breakpoint strategy, payload numbers.

Step 2 — Full wiring: all ten hotspots per §3, banner text layer, nav entry, keyboard/aria pass. ⛔ G2: wiring walkthrough per object (traced), pending-state copy for founder wording, mobile crop screenshots via founder.

Step 3 — Prove: tsc clean, build clean, vitest green (add hotspot-manifest schema test), all routes trace to existing gates unchanged. ⛔ G3: founder views the room on prod preview vs the master — the room must feel like the master. Then commit series (brief already first; assets; components; ROADMAP row W.2 | Clubhouse Cluster 1 — the room | Done | (hash post-merge)), PR, CI, squash-merge, follow-on hash PR.

## 5. Acceptance

Room live at the route; every hotspot either routes to a real surface or presents its dignified pending state — zero dead ends; banner text from data; existing nav and surfaces untouched; reduced-motion honored; keyboard navigable; no baked text in shipped layers; consent/gating behavior of destination pages unchanged; tsc/build/tests/CI green.

## 6. Out of scope

Coach Office room build (own brief) · ambient audio/fire animation (ratified future layers) · W.3 corkboard content · L.1 voicemail · replacing existing nav · any engine changes.

## Amendment Log

- 2026-07-04 — G3 failed on plate registration 2026-07-04; remediated to master-only v1 per founder ruling; registered-cutout parallax deferred to a follow-on unit (plates must derive from master pixels via alpha mattes, not independent renders).
