# OBSERVATIONS 2026-07-07 — Invite route hardening (logging, error classes, redirect contract, orphan cleanup)

**Lane:** EXECUTE (Claude Code). **Repo:** squadvault-frontend. **Branch:** `fix/invite-route-hardening` off `origin/main` `319568c`.
**Brief:** `EXECUTE Brief — Invite Route Fix (Logging, Error Classes, Redirect Un-nesting, Link Ordering)` (2026-07-07).
**Precondition verified:** invite route unmodified since `936a8ee` (empty diff); HEAD `46019ca` >= `319568c`.

## What shipped

Four changes to `src/app/api/members/invite/route.ts`, a new pure-helper module, a contract
doc, and the tests-first suite.

- **F1 — failure-branch logging (the masking fix).** Every non-2xx return path now
  `console.error`s a stable branch tag (`invite:bad-json`, `invite:bad-email`,
  `invite:bad-franchise-id`, `invite:auth`, `invite:franchise-missing`,
  `invite:not-commissioner`, `invite:migration-probe`, `invite:league-missing`,
  `invite:gotrue-refused`, `invite:resolve-failed`, `invite:gotrue-error`,
  `invite:invite-no-user`, `invite:migration-link`, `invite:link-insert`,
  `invite:pointer-update`, `invite:orphan-cleanup-failed`) with the upstream error
  code/status where one exists, plus franchise id + league canonical id. Emails are logged
  ONLY through `redactEmail` (`s***@gmail.com`); no tokens/keys are ever logged. Client
  bodies stay generic.

- **F2 — distinguish invite failure classes.** `classifyInviteError` branches the GoTrue
  error into `rate_limit` (429, distinct message "Email limit reached — wait and retry",
  tag `invite:gotrue-refused`), `already_registered` (continues to the existing
  `resolveExistingUserId` path), and `other` (502, tag `invite:gotrue-error`). The prior
  line-130 catch-all string is no longer reachable from three unrelated causes: rate-limit
  splits off to 429; an unresolvable already-registered logs `invite:resolve-failed`; a
  genuinely-other error logs `invite:gotrue-error`.

- **F3 — redirect contract (Gate B decision, founder-ratified 2026-07-07).** KEPT the
  callback-entry shape; did NOT switch to consent-direct. Code evidence: the consent page
  (`src/app/league/[id]/consent/page.tsx`) never reads `token_hash` — it calls `getViewer`
  and, with no session, redirects to `/auth/login`; `verifyOtp` runs in exactly ONE place,
  the `/auth/callback` route. Redirecting straight to consent would bounce the invitee off
  the login wall (and produce a malformed template URL, since `{{ .RedirectTo }}&token_hash=`
  requires `RedirectTo` to already carry a `?`). `buildInviteRedirect(origin, canonicalId)`
  now derives the origin from the request (`new URL(req.url).origin`), removing the
  build-inlined `NEXT_PUBLIC_APP_URL` failure mode. New `docs/auth_email_template_contract.md`
  pins the dashboard template line and the route's redirectTo shape so the two systems cannot
  silently disagree.

- **F4 — link-write ordering + orphan guard.** Pre-checks `franchise_member_links` for an
  existing (franchise, member) pair BEFORE inserting; a re-invite of an already-linked pair
  returns success with no second insert (idempotent). On a pointer-update failure AFTER a
  successful link insert, the just-inserted link row is DELETED so no link survives without a
  set pointer. Because migration 016 gives `franchise_member_links` NO DELETE policy
  (append-only, RLS default-deny), the compensating delete MUST use the admin (service-role)
  client, which bypasses RLS — the authed commissioner client physically cannot delete. A
  failed cleanup itself logs `invite:orphan-cleanup-failed` (no silent orphan). The
  append-only invariant is preserved for all COMPLETED facts: only a never-completed link
  (its companion pointer write failed within the same request) is removed.

## Gates run

- Ratified tests written BEFORE implementation (Gate A). New: `src/lib/members/invite.test.ts`
  (pure helpers, 13 cases) and `src/app/api/members/invite/route.test.ts` (handler-level via
  `vi.mock`, T1-T6). Watched RED (5 failing) then GREEN.
- Full `npx vitest run`: 170/170 green (updated one source-scan guard,
  `src/app/landing-routing.test.ts`, to track the consent-path literal into
  `buildInviteRedirect` — the "consent-first, not clubhouse" invariant is unchanged).
- `npm run type-check` (tsc --noEmit): clean.
- `npm run test:governance`: NOT runnable locally — it is a LIVE-DB RLS integration suite and
  local env carries placeholder Supabase creds (it hangs on the dead endpoint). CI runs it
  authoritatively. This diff changes no RLS policy, migration, or governance-probed table, so
  it is not logically at risk.

## Gate C (open)

PR opened for founder diff review before merge; NOT merged by this session.

## Hazards / notes

- The email template change is a Supabase DASHBOARD artifact the founder owns; the contract
  doc records the exact expected line. Code and dashboard must be kept in sync by hand.
- ESLint is not configured in this repo (interactive setup prompt); `next lint` is not a local
  gate here. vitest + tsc are the ratified local gates.
