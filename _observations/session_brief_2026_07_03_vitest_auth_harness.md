# Session Brief — Vitest Harness: Auth Function Tests (D-Q)

Date authored: 2026-07-03 (DECIDE session; D-Q ratified (a) 2026-07-03)
Session type: EXECUTE, two founder gates (⛔ Gate 1: test plan; ⛔ Gate 2: diff + merge)
Repo: frontend, canonical clone /Users/steve/projects/squadvault-frontend
Scope in one line: adopt Vitest, test the two pure security-sensitive auth functions, wire into CI — ending the "no frontend harness" era.

## Kickoff

You are an EXECUTE session for the SquadVault Vitest auth harness (D-Q). Read the brief in full. Two-lane discipline; two ⛔ gates. Hard rules: the ONLY new dependency permitted is vitest (dev, plus its minimal required companions — justify each at Gate 1); no behavioral changes to any source file — this unit tests existing code as it stands; if a test reveals a genuine bug in either function, STOP and report — the fix is a separate adjudicated unit, never folded in silently; do NOT push before Gate 2.

## 1. Objective

Vitest installed and configured; comprehensive unit tests for the two pure functions: safeRedirectPath (accepts relative/same-origin-absolute/self-referential-callback-nesting; rejects protocol-relative //evil.example, external absolutes, depth over cap 3 — per its PR #44 contract) and resolveAuthSession (verifyOtp token_hash path, ?code= legacy fallback, error paths — mock the Supabase client; test the branching, not the network). A test script in package.json, wired into the existing CI verify workflow so PRs run it.

## 2. Constraints

- Tests assert the functions' ratified contracts (read the PR #43/#44 descriptions and the code); do not weaken an assertion to make a test pass.
- Adversarial cases mandatory for safeRedirectPath: //evil.example, https://evil.example, javascript: scheme, backslash variants, nesting past depth 3, empty/undefined input.
- No snapshot tests; explicit assertions only.
- CI wiring is additive — type-check and build remain; test joins them.

## 3. Procedure

Step 0 — Ritual. Pre-flight; read both functions and their PR contracts.
Step 1 — Test plan (no code). Enumerate every case per function with expected outcomes; the vitest config sketch; the CI diff sketch. ⛔ Gate 1 — founder ratifies; expected outcomes freeze.
Step 2 — Implement + prove. Install, write, run — all green (or STOP per the bug rule); tsc clean; next build clean; CI workflow updated. ⛔ Gate 2 — founder reviews diff; merge (commit series: brief already first, then config+tests, then ROADMAP row placeholder-pattern; founder messages via /tmp/msg.txt, no Co-Authored-By; PR, CI green including the new test job, gh pr merge --squash, follow-on hash PR).

## 4. Acceptance criteria

Vitest runs green in CI on the PR itself; every Gate-1 case implemented with outcomes unchanged; zero source-file behavioral changes; only dev-deps added; ROADMAP row landed.

## 5. Out of scope

Testing components/pages/middleware · fixing any bug found (separate unit) · the /auth/login prerender finding · E2E tooling · any engine-repo changes.
