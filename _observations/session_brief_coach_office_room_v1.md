Session Brief — Coach Office Room v1: Shell + Resolvers

Date: 2026-07-05 (DECIDE-authored). Execution: fresh session, likely post-07-07; gates held via the continuity memo. Gates: ⛔ G1 architecture + resolver design · ⛔ G2 tests · ⛔ G3 built room vs spec + founder eyeball. Repo: frontend.

## Kickoff

> You are the EXECUTE session for Coach Office Room v1 (shell + resolvers). Read this brief in full, then in order: `docs/coach_office/final_spec_package_v1/` (the ratified spec — schemas, hotspot map, QA checklist), `docs/coach_office/RATIFICATION_MEMO_2026_07_04.md` (CO-R1..R4, governing law), the CO.3 viewer-context resolver (spec item 6, shipped — you consume it, never rebuild it), the W.2 room-agnostic RoomScene/RoomModal/room-types components (shipped b63e8da — you instantiate them, never fork), and the A/V Room consent code (the fail-closed `media_appearance` pattern you mirror for CO-R1). Two-lane discipline: you execute; the founder (or successor adjudicator, with the DECIDE-lane continuity memo in hand) holds the three ⛔ gates. Hard rules: CO-R1 consent supremacy is fail-closed — absent or false consent means not shown, regardless of any approved flag; CO-R2 narrowing law — rendering only ever narrows from the owner-approved set per viewer; no invention — resolvers read the canonical record, never re-derive or fabricate; no baked text — all text is runtime data overlay (founding year 1984); no hard-coding of any league/coach/team/joke; personal media, easter eggs, and cutouts are v2 and out of scope; no engine changes; tests are founder-ratified before implementation; halt-don't-guess on any brief-vs-spec-vs-git contradiction — git wins. Nothing pushed before Gate 3.

## 1. Objective

A per-member Coach Office at /league/[id]/coach-office/[coachId] (route already exists from CO.1–CO.3): the Tahoe office room with manifest-driven hotspots, plus four owner-personalization resolvers — trophy display, ring box, board message, nameplate. Reuses the W.2 room-agnostic RoomScene/RoomModal/room/types components (shipped b63e8da). Personal media (photo frame/gallery, easter eggs, cutouts) is explicitly v2 — this unit ships a complete, walkable, personalized office without them.

## 2. What already exists (read before building)

Route /league/[id]/coach-office/[coachId] and CO.1–CO.2b surfaces (trophy case, held records) — landed.
CO.3 viewer-context resolver (owner/commissioner/league-mate/public) — this is spec item 6, shipped. The four resolvers consume its viewer classification; do not rebuild it.
W.2 room-agnostic components — instantiate them for the office; do not fork.
The ratified spec at docs/coach_office/final_spec_package_v1/ (schemas, hotspot map, QA checklist) and CO-R1..R4 in the ratification memo — governing law.
The A/V Room fail-closed consent pattern (media_appearance read before any identified render) — the reference implementation for CO-R1; study it, mirror its fail-closed shape.

## 3. The four resolvers (each: owner data in → display out, deterministic, no invention)

Trophy display — the office owner's championships/records from the canonical record only; empty case if none (silence, not filler). Reuses trophy-room derivations; never re-derives.
Ring box — owner's championship rings, closed if none, open+populated if some, from the canonical record.
Board message — the owner's current board note (member speech per CO-R3; commissioner_review_required: false acceptable); blank board if none. Text overlaid at runtime, never baked.
Nameplate — owner display name + team, runtime text layer on the blank nameplate surface (CO-R4).

## 4. Constitutional constraints (hard law)

CO-R1 consent supremacy: any surface that would show a member's likeness, voice, or attributed words checks the depicted member's consent toggle first, fail-closed (absent/false consent → not shown), regardless of any approved flag. v1's resolvers are mostly owner-self-data (lower exposure), but the board-message attribution and nameplate still honor it. Mirror the A/V Room's fail-closed shape.
CO-R2 narrowing law: relationship-aware rendering (via CO.3) selects subsets of the owner-approved set per viewer; nothing renders to a visitor the owner hasn't approved. Rendering only ever narrows.
CO-R3: board notes/captions are member speech; AI-generated content (none in v1) would inherit unconditional human approval.
CO-R4: zero baked text in base art; all text is runtime data overlay; founding year 1984, records from canonical only.
No hard-coding (the spec's non-negotiable): no PFL/Steve/KP/team/joke logic in any reusable path — data-driven for any league.

## 5. Procedure

Step 0 — Ritual + reading: identity, HEAD, tsc green; read the spec package, CO-R memo, CO.3 resolver, W.2 components, A/V Room consent code, and (read-only) a real office's current render.
Step 1 — Architecture + resolver design (no build): the office RoomScene instantiation; the hotspot manifest for the office (interim hero asset per the CO asset gate, or master-drawn zones); each resolver's data-in/display-out contract citing the canonical source; the CO-R1 fail-closed check location. ⛔ G1.
Step 2 — Tests first: per resolver (populated + empty states), the CO-R1 fail-closed assertion (consent absent → not rendered), the CO-R2 narrowing assertion (visitor sees ≤ owner-approved), no-invention guards, no-baked-text guard. ⛔ G2.
Step 3 — Build + prove: resolvers + office scene; tsc/build/vitest green; all four viewer classes traced (owner/commissioner/league-mate/public) with the consent gate cited per surface; zero engine changes. ⛔ G3: diff review + founder eyeball on prod preview (does the office feel like the owner's room?). Commit series, PR, squash-merge, ROADMAP row, follow-on hash.

## 6. Successor gate notes

G1: prove the resolver contracts read the canonical record, not a reimplementation (drift source). G2: every CO-R constraint needs a firing test; the fail-closed consent test is the one that matters most — an office must never leak a member's data to a visitor. G3: the eyeball question is "does this feel like this coach's office" — personalization is the point; a generic room is a fail. Halt-don't-guess throughout.

## 7. Acceptance

Four resolvers ship, populated + empty states correct; CO-R1 fail-closed proven; CO-R2 narrowing proven; no invention, no baked text; W.2 components reused not forked; all four viewer classes traced; tsc/build/vitest/CI green; zero engine changes. Personal media absent by design (v2).

## 8. Out of scope

Personal media / photo frame / gallery (v2) · easter eggs · cardboard cutouts (v2) · the A/V Room (W.1, shipped, untouched) · rebuilding CO.3 · new consent categories · no engine changes.
