# Observation - Middleware Honesty + metadataBase Fix

Dated 2026-07-04 (Claude Code, Opus 4.8). Executes the ratified fix for the CO.3
middleware finding under rulings R1 (public ceremonial surfaces are intended design)
and R2 (layered fix). Brief:
`_observations/session_brief_2026_07_04_middleware_honesty_metadatabase.md`.
Predecessors: findings memo `OBSERVATIONS_2026_07_04_MIDDLEWARE_ANON_GATE_FINDINGS.md`
(the diagnosis, `2af142d`) and the CO.3 seam memo
`OBSERVATIONS_2026_07_01_COACH_OFFICE_PHASE3_VIEWER_CONTEXT.md`.

## What shipped

- **Registered middleware, honest scope.** New `src/middleware.ts` (under `src/`, so it
  is actually picked up - the root file never was). It gates ONLY the working /
  consent-scoped surfaces, as a SECOND layer behind the page-level self-gates (which stay
  PRIMARY and were not touched). The Supabase `@supabase/ssr` client + cookie
  `getAll/setAll` session-refresh pattern is reused verbatim from the prior dead file.
  Matched anonymous requests bounce to `/auth/login?redirect=<pathname>` - the identical
  shape the page gates emit. `/admin/*` additionally requires the admin role (authed
  non-admins get a plain 403).
- **Dead file deleted.** Root-level `middleware.ts` removed entirely.
- **metadataBase off the parked domain.** `src/app/layout.tsx` metadataBase now falls back
  to `https://squadvault.vercel.app` (never `squadvault.com`, which is a parked
  domain-sale page), resolving from `NEXT_PUBLIC_APP_URL` when set.

## The matcher (the gated set, verbatim)

```
matcher: [
  '/league/:id/office/:path*',
  '/league/:id/vault/:path*',
  '/league/:id/history/:path*',
  '/league/:id/consent/:path*',
  '/league/:id/av-room/:path*',
  '/league/:id/approve/:path*',
  '/admin/:path*',
]
```

## Registration proof

`next build` output (the exact evidence whose ABSENCE proved the original bug):

```
ƒ Middleware                                     82.8 kB
```

## Layered model - honest description

The page gates are PRIMARY (each gated page runs its own `if (!viewer.userId) redirect`);
this middleware is a second, defense-in-depth layer scoped to the same set. The
R1-public routes (league home, coach-office, members, trophy-room, archive) are NOT in
the matcher, so this middleware does not run on them at all - including no session
refresh; an unmatched public route refreshes no session (the first matched route, or the
page's own server client on a self-gated route, does that work). This is intended: public
ceremonial surfaces need no gate and no per-request auth cost.

## Inheritance rule (standing)

Any future phase that adds consent-scoped or personal member content to a currently-public
route (league home, coach-office, members, trophy-room, archive) MUST add BOTH (1) that
page's own `if (!viewer.userId) redirect(...)` gate (primary) AND (2) a matcher entry in
`src/middleware.ts` (second layer). Neither layer alone is the contract - the page gate is
the enforcement, the matcher keeps the two layers in agreement. This is the CO.3 seam
(`OBSERVATIONS_2026_07_01_COACH_OFFICE_PHASE3_VIEWER_CONTEXT.md`) made operational; the
`viewer-context.ts` capability booleans remain the per-viewer content seam above it.

## Owed founder step (non-code, reported at Gate 2)

Set `NEXT_PUBLIC_APP_URL=https://squadvault.vercel.app` in the Vercel project env. Until
then the `vercel.app` fallback keeps OpenGraph/canonical URLs off the parked domain; the
env var makes the source of truth explicit (and lets a future custom domain be set in one
place).

## Checks

- type-check: green.
- production build: green; `ƒ Middleware` line present (quoted above).
- route trace (Next's own `path-to-regexp` against the literal matcher): all R1-public
  routes UNMATCHED (incl. `coach-office`, distinct from the `office` literal); all gated
  routes MATCHED. Redirect parity with the page gates confirmed. No page gate touched.

## Out of scope (unchanged from the brief)

Gating any R1-public surface; removing/weakening page gates; auth flow changes; the
`/auth/login` prerender env finding (registered, separate); purchasing `squadvault.com`
(founder decision, non-code); any engine-repo changes.
