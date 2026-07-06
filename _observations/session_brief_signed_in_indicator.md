Session Brief — Signed-In Toolbar Indicator
Date: 2026-07-05 (DECIDE-authored). Gates: ⛔ G1 design · ⛔ G2 tests · ⛔ G3 diff + eyeball. Repo: frontend.

## Kickoff

> You are the EXECUTE session for the signed-in toolbar indicator — a small global element that makes authentication state visible on every page. Read this brief, then the shipped nav/toolbar component (the top nav the rooms share), the viewer/auth resolution (getViewer / the session-resolution helper — you CONSUME it, never change auth logic), and the franchise-name resolution the rooms already use (CO.3-adjacent). Two-lane discipline; three ⛔ gates. Hard rules: this is a status DISPLAY element — it shows who the viewer is signed in as, or an anonymous/sign-in affordance; it changes NO auth logic, adds NO analytics (it displays state, never tracks it), creates NO engagement mechanic; it reads the existing session/viewer resolution; no engine changes; halt-don't-guess. Nothing pushed before G3.

## 1. Objective
A persistent element in the global toolbar/nav showing the viewer's authentication state: when signed in, the viewer's franchise/team name (or a clear "signed in as [name]"); when anonymous, a clear "Sign in" affordance. Present on every page so the viewer always knows which view they are seeing — foundational to evaluating viewer-relative personalization (the "your hardware" highlight, the office/hall personalization) which all depends on auth state.

## 2. What exists (verify at HEAD)
The shipped top nav; the session/viewer resolution (getViewer returns {userId, isCommissioner} — note it does NOT carry franchise identity, so the franchise-name lookup is an additive read, mirroring the room pattern that resolves the viewer's franchise); the franchise directory. Consume all unchanged.

## 3. The indicator

Signed in: show the viewer's franchise/team display name (resolved via the additive franchise lookup the rooms use), or "Signed in as [name]". A commissioner without a franchise shows "Signed in (commissioner)" or equivalent honest state.
Anonymous: show a "Sign in" affordance routing to the existing sign-in flow.
Placement: the global toolbar/nav, present on all pages, unobtrusive (a corner element, not a banner). Keyboard-accessible, aria-labeled.
Honest states only: never guess a name; if franchise resolution returns nothing for a signed-in user, show the honest fallback ("Signed in") not a fabricated name.

## 4. Constitutional constraints
Status display only (no auth-logic change) · no analytics/tracking (displays state, never records it) · no engagement mechanic · honest fallback, never a fabricated name · reads existing session/viewer resolution · no engine changes.

## 5. Procedure
Step 0 — Ritual + reading (identity FAIL engine test, HEAD, tsc; read nav, getViewer, franchise resolution). Step 1 — Design (no build): the indicator component, its placement in the shared nav, the signed-in/anonymous/commissioner states, the additive franchise-name read. ⛔ G1. Step 2 — Tests first: signed-in shows the resolved franchise name; franchise-absent signed-in shows honest fallback (not fabricated); anonymous shows sign-in affordance; no auth-logic change (the session resolver is consumed unchanged); no-analytics source scan. ⛔ G2. Step 3 — Build + prove: indicator in the nav; tsc/build/vitest green; every existing page + room regression intact; zero engine changes. ⛔ G3: founder eyeball on prod preview — signed in shows your team; signed out shows Sign in; the state is unmistakable on every page.

## 6. Successor gate notes
G1: confirm the auth/session resolution is consumed unchanged — this displays state, never computes it. G2: the honest-fallback test matters most — a signed-in user with no resolvable franchise must never see a fabricated name. G3 eyeball: the indicator makes "which view am I seeing" instantly legible — the whole point is that the founder can now tell, on any room, whether personalization is active.

## 7. Acceptance
Indicator present in the global toolbar on all pages; signed-in shows resolved franchise name (honest fallback when unresolvable); anonymous shows sign-in affordance; keyboard/aria accessible; no auth-logic change; no analytics; every page/room regression intact; zero engine changes; tsc/build/vitest/CI green.

## 8. Out of scope
Any auth-logic / session change · analytics or presence tracking · a full account/profile menu (v2) · the Trophy Hall interaction v2 (separate brief) · engine changes — no engine changes.
