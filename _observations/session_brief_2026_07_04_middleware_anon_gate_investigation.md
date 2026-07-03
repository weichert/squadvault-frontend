# Session Brief — Middleware Anon-Gate Investigation (Diagnosis-Only)

Date authored: 2026-07-04 (DECIDE session)
Session type: EXECUTE (Claude Code), one founder gate (⛔ Gate 1: findings memo approval)
Repo: frontend (weichert/squadvault-frontend), canonical clone /Users/steve/projects/squadvault-frontend
Plan reference: CO.3 close-out finding (memo landed with fce58d2): middleware.ts:30 is coded to redirect anonymous users on all /league/*, yet prod serves /league/70985 in full to a session-less browser; /office's anon bounce is page-level, not middleware.
Scope in one line: establish deterministically why the coded middleware block does not manifest in prod, and enumerate exactly which /league/* surfaces are anon-reachable — diagnosis only; the intended-behavior ruling is the founder's, on these findings.

## Kickoff

You are an EXECUTE session for the SquadVault middleware anon-gate investigation. Read _observations/session_brief_2026_07_04_middleware_anon_gate_investigation.md in full. Two-lane discipline: you execute; the founder adjudicates at ⛔ Gate 1. Hard rules: diagnosis-only — no source, config, or middleware changes; no Supabase config changes; prod is probed read-only via plain HTTP requests (no auth tokens minted, no writes, no form submissions); nothing published; do NOT propose or implement a fix — the finding memo names mechanisms and reachability only.

## 1. Objective
Answer three questions with cited evidence:

Mechanism: why does the middleware.ts anon redirect not manifest for /league/70985 in prod? Candidates to test against the code and build output, not assume: matcher config vs. the file's runtime logic (does the matcher include the path but the handler's redirect condition never trigger — e.g., the Supabase session check returning a non-null shape for anon?); middleware running but its response being ignored (misplaced return); the middleware file not being picked up at build (location/naming — it must sit at the project root or src/ root per Next.js convention; verify where it actually lives and what next build reports); or an environment/deploy difference. Identify the actual mechanism with file:line and build-output evidence.
Reachability census: enumerate every /league/70985/* route in the codebase and classify each as anon-reachable or anon-blocked in prod behavior — determined by code reading (which pages self-gate like office/page.tsx:61-62, which don't) plus a minimal set of anonymous HTTP probes against prod (status code and whether content or a redirect came back; do not scrape or store page bodies). Present as a table: route · gate mechanism (middleware / page-level / none) · anon result.
Consent exposure check: for every anon-reachable route, confirm from code whether any consent-scoped or personal member content could render there today (expected: no — all public/derived — but verify per route, citing the components).

## 2. Constraints

No changes: repo diff at session end = the findings memo only.
Probes are read-only GETs against prod, unauthenticated, minimal in number; record URL, status, and redirect target only.
Evidence discipline: every mechanism claim cites file:line or build output; every reachability claim cites the probe result or the self-gate code.
No fix design: the memo's closing states the mechanism, the reachability table, and the consent-exposure result — then stops. The ruling (fix middleware vs. remove/narrow it to match intended visibility, and what the intended visibility is) is the founder's, in the DECIDE lane.

## 3. Procedure
Step 0 — Ritual. Pre-flight; HEAD recorded; read middleware.ts in full and locate it in the tree; read next build output for middleware registration.
Step 1 — Diagnose + census. Answer the three §1 questions. Write the findings memo: _observations/OBSERVATIONS_2026_07_04_MIDDLEWARE_ANON_GATE_FINDINGS.md — mechanism with evidence, the route table, the consent-exposure result, and any incidental findings in a labeled appendix.
⛔ Gate 1 — Founder approves the memo; commit (memo alone, founder-written message via /tmp/msg.txt, no Co-Authored-By, PR, gh pr merge --squash, verify fresh main, delete branch).
Step 2 — none. The unit ends at the landed memo; the ruling and any fix are separate.

## 4. Acceptance criteria

Mechanism identified with file:line/build evidence — not hypothesized.
Every /league/* route classified with cited basis; probe log included (URL/status/redirect only).
Consent-exposure verified per anon-reachable route.
Repo diff = memo only; no logic, config, or Supabase changes; tsc still clean.

## 5. Out of scope
Any fix (middleware, pages, config) · the intended-visibility ruling · auth flow changes · the /auth/login prerender env finding · consent-page changes · any engine-repo changes.
