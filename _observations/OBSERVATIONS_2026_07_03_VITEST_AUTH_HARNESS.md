# Observation - Vitest Auth Harness (QA.1, D-Q)

Dated 2026-07-03 (Claude Code, Opus 4.8). Executes the ratified D-Q decision (a):
adopt Vitest and unit-test the two pure security-sensitive auth functions, wiring the
suite into CI. First frontend test harness - ends the "no frontend harness" era.
Brief: `_observations/session_brief_2026_07_03_vitest_auth_harness.md`.

## What shipped

- **Vitest adopted, minimally.** `vitest` (dev) is the SOLE new dependency. No companions:
  the `@/` path alias is resolved inline in `vitest.config.ts` (no `vite-tsconfig-paths`),
  the suite runs in the `node` environment (both functions are pure - no jsdom), and there
  is no React/JSX in scope (no `@vitejs/plugin-react`).
- **35 tests, explicit assertions only (no snapshots)** in `src/lib/auth/callback.test.ts`:
  - `safeRedirectPath` - 21 table-driven cases (accept relative / same-origin absolute /
    nested-callback unwrap; the depth-cap boundary at 3; the full adversarial reject set:
    protocol-relative `//`, external absolute, `javascript:`/`data:` schemes, both
    protocol-relative-equivalent backslash variants, depth-past-3), the `/undefined`
    current-behavior wart (below), and one cross-cutting invariant asserting EVERY input
    yields a same-origin `/`-prefixed path (the no-open-redirect property).
  - `resolveAuthSession` - 12 branch tests over a `vi.fn()`-mocked Supabase client
    (verifyOtp / exchangeCodeForSession): the token_hash+type verifyOtp path, the `?code=`
    legacy fallback, null-email handling, error/empty paths, and the two precedence cases
    (token_hash wins over a co-present code; a verifyOtp error does NOT fall through to code).
- **CI wired additively.** `.github/workflows/ci.yml` gains a `Unit tests` step
  (`npm run test` -> `vitest run`) between Type-check and Production build. type-check and
  build steps are unchanged.
- **Zero source behavioral changes.** `callback.ts`, the callback route, and the middleware
  were not touched - this unit tests the code as it stands.

## Registered papercut - the `/undefined` wart

`safeRedirectPath(undefined, origin)` returns `"/undefined"` (not `"/"`): a non-string
`undefined` coerces to the string `"undefined"`, which resolves as a same-origin relative
path. This is a **papercut, registered here - not a contract endorsement.** The ratified
security invariant (no open redirect; every result stays same-origin) STILL HOLDS - it is
a same-origin path, not an escape. The test freezes this as documented current behavior and
carries the explicit note: **a future fix that normalizes this changes that test with it.**
Related same-origin-but-notable outcome, also frozen as safe: a single backslash
`\evil.example` -> `/evil.example` (the double/slash-backslash variants correctly reject to
`/`, normalizing to protocol-relative first).

## Frozen outcomes

All 34 case outcomes were founder-frozen at Gate 1 (2026-07-03) and verified against the
real function by a read-only ground-truth probe BEFORE implementation, so no assertion was
reverse-fitted to a passing run. The mandatory adversarial set (constraint 2) was confirmed
present verbatim - none had to be added post-freeze.

## Checks

- `npm run test`: 35 passed.
- `npm run type-check`: clean (now also covers the test file + `vitest.config.ts`).
- `npm run build`: green at CI parity (Node 24, NODE_ENV=production); `ƒ Middleware` intact.
- CI `Unit tests` job: green on the PR itself (first run of the new job).

## Out of scope (unchanged from the brief)

Testing components/pages/middleware; fixing the `/undefined` wart or any bug (separate
unit); the `/auth/login` prerender finding; E2E tooling; any engine-repo changes.
