# Session Brief — Middleware Honesty + metadataBase Fix

Date authored: 2026-07-04 (DECIDE session; rulings R1/R2 ratified 2026-07-04)
Session type: EXECUTE (Claude Code), two founder gates (⛔ Gate 1: implementation plan; ⛔ Gate 2: diff review + merge)
Repo: frontend (weichert/squadvault-frontend), canonical clone /Users/steve/projects/squadvault-frontend
Plan reference: middleware anon-gate findings memo (landed 2af142d): root-level middleware.ts never registered (src/ convention), page-level self-gates are the only live control, no consent exposure today, metadataBase defaults to the parked squadvault.com
Scope in one line: make the access-control code match the ratified design — a registered middleware gating only working surfaces as a second layer behind the page gates, the dead file removed, and shared links no longer resolving against a parked domain.

## Kickoff

You are an EXECUTE session for the SquadVault middleware honesty + metadataBase fix. Read _observations/session_brief_2026_07_04_middleware_honesty_metadatabase.md in full. Two-lane discipline: you execute; the founder adjudicates at the two ⛔ gates. Hard rules: frontend only; no schema/RLS/Supabase dashboard changes; no new deps; page-level self-gates are PRIMARY and must not be removed or weakened — the middleware is defense-in-depth behind them; the publicly reachable surfaces ratified in R1 must remain anon-reachable (a regression that bounces the trophy room to sign-in is a failure); canonical id "70985" in URLs; do NOT push or merge before Gate 2 approval.

## 1. Objective

Four parts, one unit:

- (a) Registered middleware, honest scope. Create src/middleware.ts gating ONLY the working-surface route groups — per the findings memo's gated set: office, vault, history, consent, av-room (including ingest), approve — plus /admin/*, as defense-in-depth behind the existing page gates. Anonymous requests to those paths redirect to /auth/login with the originating path in the redirect param (matching the page gates' existing pattern). The R1-public surfaces — league home, coach-office, members, trophy-room, archive — are NOT in the matcher.
- (b) Delete the dead file. Remove root-level middleware.ts entirely, so no future reader trusts unregistered code.
- (c) metadataBase off the parked domain. Make layout.tsx's metadataBase resolve from NEXT_PUBLIC_APP_URL with a sane fallback to https://squadvault.vercel.app — never squadvault.com. (Setting the env var in Vercel is a founder dashboard step, reported at Gate 2 as owed.)
- (d) The inheritance rule, recorded. The unit's memo states the standing rule: any future phase adding consent-scoped content to a currently-public route must add its page gate AND extend the middleware matcher — cross-referencing the CO.3 seam memo and the findings memo.

## 2. The ratified rulings

- R1 (intended visibility): current prod behavior is the design. Public ceremonial surfaces (league home, trophy room, members directory, coach offices, archive) are world-visible; working and consent-scoped surfaces (office, vault, history, consent, av-room, approve, future admin) are gated. The vault is a monument, not a bunker.
- R2 (fix shape): layered — page gates primary, registered middleware as second layer scoped to the gated set only; dead file deleted; metadataBase fixed; inheritance rule recorded.

## 3. Design constraints

1. Matcher-driven: the gated set is expressed in the middleware config.matcher, not by pattern-matching inside the handler — so the gated surface is readable at a glance and greppable.
2. Session handling per Supabase SSR convention: the middleware must refresh the session cookie correctly for matched routes (the standard @supabase/ssr middleware pattern already implied by the codebase's server-client usage — read the existing auth utilities and reuse; do not hand-roll token logic).
3. No behavior change for public routes: they are not matched, so zero middleware cost and zero regression risk for R1 surfaces.
4. Redirect parity: the middleware's bounce must produce the same destination shape as the page gates (/auth/login?redirect=<path>), passing safeRedirectPath-compatible values.
5. Registration proof required: next build output must show the ƒ Middleware entry — the exact evidence whose absence proved the bug.

## 4. Procedure

Step 0 — Ritual. Pre-flight per landing instruction; HEAD recorded; re-read the findings memo's route table and the existing page-gate implementations.
Step 1 — Implementation plan (no code). Present: the exact matcher list; the middleware handler sketch (session refresh + anon redirect, citing the auth utilities reused); the metadataBase diff sketch; which page gates remain untouched (all of them); and the planned memo text for the inheritance rule.
⛔ Gate 1 — Founder ratifies the plan.
Step 2 — Implement. Surgical: src/middleware.ts (new), root middleware.ts (deleted), layout.tsx (metadataBase only), the unit memo (new). Nothing else.
Step 3 — Prove. tsc clean; next build clean AND shows the ƒ Middleware registration line (quote it); trace all thirteen-plus routes against the new matcher — every R1-public route unmatched, every gated route matched; confirm redirect parity with the page-gate pattern; confirm no page gate was touched.
⛔ Gate 2 — Founder reviews diff; merge. Commit series (feature, memo, ROADMAP row with the placeholder-hash pattern; founder-written messages via /tmp/msg.txt, no Co-Authored-By), push, one PR, CI green, gh pr merge --squash, verify fresh main + deploy workflow, branch cleanup, follow-on doc PR to set the real squash hash. Report the owed founder step: set NEXT_PUBLIC_APP_URL=https://squadvault.vercel.app in Vercel. Founder then prod-verifies: trophy room still loads in incognito (R1 regression check), a gated route still bounces, and — after the env var is set — a shared link's OG URL resolves to the vercel.app host.

## 5. Verification honesty

No frontend test harness (open D-Q). Verification is tsc, build output (including the registration line), route-by-route matcher traces at the gates, and founder prod verification of both the public and gated behavior post-deploy.

## 6. Acceptance criteria

- src/middleware.ts registered (build line quoted); root middleware.ts gone; matcher = the gated set exactly; all R1-public routes unmatched and verified still anon-reachable post-deploy.
- Page gates untouched; redirect parity held; metadataBase never resolves to squadvault.com; inheritance rule in the landed memo; ROADMAP row per the placeholder pattern.
- tsc/build/CI/deploy green; no new deps; no Supabase dashboard changes by the session (the env var is the founder's step, reported as owed).

## 7. Out of scope

Gating any R1-public surface · removing or weakening page gates · auth flow changes · the /auth/login prerender env finding (registered, separate) · purchasing squadvault.com (founder decision, non-code) · D-Q · any engine-repo changes.
