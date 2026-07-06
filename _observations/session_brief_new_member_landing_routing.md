Session Brief — New-Member Landing Routing: Arrive in the Clubhouse
Date: 2026-07-05 (DECIDE-authored, founder-ratified). Auth/consent-critical — highest care. Gates: ⛔ G1 design · ⛔ G2 tests · ⛔ G3 diff + eyeball. Repo: frontend.

## Kickoff

> You are the EXECUTE session for the new-member landing routing change. This touches auth and consent flows — the highest-care area. Read this brief, then RE-VERIFY the landing trace against HEAD yourself (the design below is from a trace at 6b100fa; confirm it still holds on current main): the post-login destination (page.tsx authed-root redirect + splash link), the callback redirect mechanism (auth/callback executing the ?redirect= param, safeRedirectPath-validated), the consent panel (member-consent-panel.tsx — currently router.refresh() on grant, no onward nav), and the invite flow (api/members/invite/route.ts — intentionally sends first-login to /consent). Two-lane discipline; three ⛔ gates. Hard rules: consent MUST still fire first for a brand-new member (the invite→consent step is preserved, never bypassed — the Clubhouse landing happens AFTER consent, not instead of it); every redirect stays safeRedirectPath-validated (no open-redirect, same-origin only); no auth-logic change beyond the destination literal(s) and the one added post-consent navigation; no engine changes; halt-don't-guess. Nothing pushed before G3.

## 1. Objective
A member's journey ends in the illustrated Clubhouse, not the data ledger: (A) post-login (cold/returning) lands on /league/[id]/clubhouse; (B) after a brand-new member records consent, they navigate onward to /league/[id]/clubhouse. The consent gate is preserved ahead of the Clubhouse for new members (Decision 3). The data home remains reachable (nav, "read the full record") — it's just no longer the default landing.

## 2. What the trace established (verify at HEAD)
Per the read-only trace (sv_landing_trace.txt, at 6b100fa — re-verify on current main): post-login default resolves via / → /league/[id] (data home) at page.tsx (authed-root redirect ~line 21 + splash link ~line 48). Post-consent: the member STAYS on /consent — the panel calls router.refresh() with no onward navigation. The invite flow intentionally routes first-login to /consent. Two changes, different subsystems (root routing vs. consent panel); confirm the line numbers on HEAD before editing.

## 3. The two changes

Change A (post-login): redirect the authed-root and splash-sign-in destinations from /league/[id] to /league/[id]/clubhouse. One file, the two literals identified in the trace (re-confirm on HEAD). The ?redirect= param mechanism and safeRedirectPath validation are unchanged — only the default destination moves.
Change B (post-consent): in the consent panel, after a grant is successfully recorded, navigate onward to /league/[id]/clubhouse (replace/augment the router.refresh() with a router.push/replace to the clubhouse) — so a new member who consents lands in the room instead of being stranded on the consent page. Preserve consent recording; the navigation happens only after the grant succeeds. Note: consent/page.tsx already flags its placement as provisional pending W.2 navigation — this change is consistent with that.
Preserved (Decision 3): the invite→first-login→consent step is untouched. New member: email → login → consent (required, first) → Clubhouse.

## 4. Constitutional + safety constraints
Consent fires first for new members (never bypassed) · every redirect safeRedirectPath-validated (no open-redirect, same-origin) · no auth-logic change beyond the destination literals + the one post-consent navigation · the data home stays reachable via nav/links (not orphaned) · no analytics · no engine changes.

## 5. Procedure
Step 0 — Ritual + RE-VERIFY the trace (identity FAIL engine test, HEAD, tsc; confirm the post-login literals and the consent-panel refresh() on current main; if the code has moved from the trace, report and halt rather than edit blind). Step 1 — Design (no build): the exact literal changes for A, the post-consent navigation for B, confirming consent-first is preserved and redirects stay validated. ⛔ G1. Step 2 — Tests first: post-login lands on clubhouse (not data home); post-consent navigates to clubhouse after a recorded grant (and NOT before the grant succeeds); a brand-new member still hits consent before the clubhouse (consent-first preserved); redirect validation intact (no open-redirect smuggle through the changed paths); the data home still reachable. ⛔ G2. Step 3 — Build + prove: the two changes; tsc/build/vitest green; auth/consent regressions intact; zero engine changes. ⛔ G3: founder eyeball on prod preview — sign in fresh and confirm you land in the Clubhouse (with the chip showing your team); as a new member, consent then land in the Clubhouse; the data home still reachable from the nav.

## 6. Successor gate notes
G0/G1: the trace re-verification is load-bearing — if the landing code has moved since 6b100fa, halt and report, do not edit from the brief's line numbers blind. G2's key tests: consent-first-preserved (a new member cannot reach the clubhouse without consenting) and no-open-redirect through the changed paths. G3 eyeball: the whole new-member journey — email → login → consent → Clubhouse, team name in the chip.

## 7. Acceptance
Post-login lands on the Clubhouse; post-consent lands on the Clubhouse after a recorded grant; consent-first preserved for new members; all redirects safeRedirectPath-validated; data home reachable via nav; no auth-logic change beyond scope; zero engine changes; tsc/build/vitest/CI green.

## 8. Out of scope
Any auth/session/consent-recording logic change (beyond the post-consent onward navigation) · relocating the consent surface into the scene (a larger future W.2 item the code flags) · the signed-in indicator (shipped) · engine changes — no engine changes.
