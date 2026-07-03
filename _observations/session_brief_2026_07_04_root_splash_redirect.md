# Session Brief — Root "/" Splash: Authed Redirect + Anonymous Landing

Date authored: 2026-07-04 (DECIDE session; behaviors ratified in-brief)
Session type: EXECUTE (Claude Code), two founder gates (⛔ Gate 1: code-reading findings + implementation plan; ⛔ Gate 2: diff review + merge)
Repo: frontend (weichert/squadvault-frontend) — the engine identity test must FAIL here
Plan reference: flagged gap on the standing board ("root splash has no nav links and no authed-user redirect"); follows Test B pass (invite chain verified on prod) and the Coach Office stack landing (0feb832)
Why now: members onboard via invite and will next type the bare URL; the root page is currently a dead end — the front door immediately behind the invite chain.

## Kickoff

You are an EXECUTE session for the SquadVault frontend root-splash unit. Read _observations/session_brief_2026_07_04_root_splash_redirect.md in full. Two-lane discipline: you execute; the founder adjudicates at the two ⛔ gates. Hard rules: frontend repo only; single branch off main; no schema, RLS, or Supabase config changes; no new dependencies; no analytics or tracking of any kind (constitutional); canonical league id "70985" in URLs, never a UUID; do NOT push or open a PR before Gate 2 approval.

## 1. Objective

Replace the current dead-end root page with two ratified behaviors:

Authed viewer at /: server-side redirect to /league/70985. No interstitial, no flash of splash content.
Anonymous viewer at /: a minimal, on-brand landing — the SquadVault name/mark, one quiet line of identity (e.g., the league's name and founding year; exact copy proposed at Gate 1 for founder wording), and a single sign-in path (link to the existing auth entry point — locate it in code, do not invent a new one). No feature tour, no marketing, no imagery beyond what the design system already provides. The page must feel like the outside of a private clubhouse, not a product homepage.

## 2. Design constraints

Reuse existing helpers: viewer resolution via the existing getViewer() (or the current equivalent — read the code; do not duplicate auth logic), league resolution via getLeague keyed on canonical id. Cite file:line at Gate 1.
Server-side: the authed redirect happens in the server component/route (Next.js App Router redirect()), not client-side after hydration.
URL discipline: /league/70985 literal or resolved from the canonical constant already in the codebase — never the leagues UUID (the documented 404 trap).
Styling: existing design tokens/components only; match the Trophy Room / consent-page register (the dark, quiet aesthetic visible in prod).
No new surface area: no new routes beyond / itself, no nav changes, no middleware unless the codebase already routes / through one (report at Gate 1 if so).

## 3. Procedure

Step 0 — Ritual. Fresh pull, HEAD recorded, identity confirmed, npx tsc --noEmit clean at base.
Step 1 — Code reading (no implementation). Read the current root page and report: what / renders today and why it dead-ends; where getViewer/auth resolution lives; where the auth entry point (sign-in route) is; whether / passes through middleware; how /league/[id] resolves canonical ids. Then present the implementation plan: files to be touched (expect: the root page.tsx, possibly one small component), the proposed anonymous-landing copy for founder wording, and the redirect mechanics.
⛔ Gate 1 — Founder ratifies plan + copy. Frozen after ratification; copy is founder-worded.
Step 2 — Implement. Surgical diff per the ratified plan.
Step 3 — Prove. npx tsc --noEmit clean; next build succeeds locally; manual behavior walk-through described in the report (what an authed vs anon request to / does, traced through the code).
⛔ Gate 2 — Founder reviews diff; merge. On approval: feature commit (separate from the brief commit, founder-written message via /tmp/msg.txt, no Co-Authored-By), push, one PR, CI green, gh pr merge --squash via CLI (pre-authorized at this gate), verify on fresh main, confirm the main-branch deploy workflow succeeds. Founder then verifies on prod: authed browser → / lands on league home; private/incognito → / shows the landing with a working sign-in path.

## 4. Verification honesty

The frontend has no automated test harness (open decision D-Q). This unit's verification is therefore: type-check, local build, code-traced behavior at Gate 1/2, and founder visual verification on prod post-deploy. The memo trail is the brief + PR; no test-coverage claim is made.

## 5. Acceptance criteria

Authed / → server-side redirect to /league/70985; anon / → the ratified landing with a working sign-in path.
Diff confined to the root route (+ at most one small component); no new deps; no schema/config/nav changes; canonical id in all URLs.
tsc clean, build clean, CI green, deploy workflow success; founder prod verification passes both states.

## 6. Hazards

Wrong repo — identity test first (engine test must FAIL).
The UUID-in-URL 404 trap — canonical "70985" only.
Redirect loops: if the auth entry point itself redirects authed users to /, trace the full loop at Gate 1 before implementing.
This is a single fresh branch off main — the stacked-PR hazards from the Coach Office landing do not apply here; do not import that complexity.

## 7. Out of scope

Nav changes · consent/members/office surfaces · #48/Phase 3 (CO.3 is its own unit with its recorded destack prerequisite) · auth flow changes · D-Q (test harness) · any engine-repo changes.
