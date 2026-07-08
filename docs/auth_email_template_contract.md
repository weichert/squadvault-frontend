# Auth email template ↔ invite redirect contract

**Status:** in-repo record of a contract that spans two systems that cannot import each
other — the Supabase **dashboard** email template (Auth → Email Templates → *Invite user*)
and the **invite route** (`src/app/api/members/invite/route.ts`). They must agree; this
file is the single place that pins both shapes so a future dashboard edit or code edit that
breaks the pairing is caught by review rather than in production.

Ratified 2026-07-07 (Gate B of the invite-route hardening brief), on code evidence.

## The template line (dashboard)

The *Invite user* template's action URL is:

```
{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite
```

`{{ .RedirectTo }}` expands to the exact string the route passed to
`inviteUserByEmail(..., { redirectTo })`. The template **appends** `&token_hash=…&type=invite`,
so `{{ .RedirectTo }}` **must already contain a `?`** (a query string) or the result is a
malformed URL (`…&token_hash` with no preceding `?`).

## The route's redirectTo shape (code)

`buildInviteRedirect(origin, canonicalId)` in `src/lib/members/invite.ts` produces:

```
${origin}/auth/callback?redirect=%2Fleague%2F<canonical_id>%2Fconsent
```

- `origin` is derived from the request (`new URL(req.url).origin`) — **not** a build-inlined
  `NEXT_PUBLIC_APP_URL` literal, which is baked at build time and silently wrong on previews.
- It carries a `?` (`?redirect=…`), satisfying the template's append requirement.

So the fully-composed link the member clicks is:

```
${origin}/auth/callback?redirect=%2Fleague%2F<canonical_id>%2Fconsent&token_hash=<hash>&type=invite
```

## Why callback-entry, not consent-direct

The invited member must land on **`/auth/callback`**, because that route is the **only**
place that runs `verifyOtp` on the emailed `token_hash` (via `resolveAuthSession`,
`src/lib/auth/callback.ts`). The callback verifies the token, writes the session cookie,
then forwards to the inner `redirect` target through `safeRedirectPath`, which unwraps the
`?redirect=` and re-validates it same-origin.

Redirecting **straight to the consent page** (`/league/<id>/consent`) would break the flow:
`src/app/league/[id]/consent/page.tsx` never reads `token_hash` — it calls `getViewer(id)`
and, finding no session, `redirect('/auth/login…')`. The member would bounce off the login
wall with an unconsumed token. (It would also violate the template's `?`-required rule, since
a bare `/league/<id>/consent` has no query string.)

## If you change either side

- **Changing the template** (dashboard): keep the `?`-bearing `{{ .RedirectTo }}` and the
  `&token_hash=…&type=invite` suffix. Update this file.
- **Changing `buildInviteRedirect`**: keep the `/auth/callback?redirect=…` entry shape (or
  move `verifyOtp` to wherever the new target is and update `safeRedirectPath`). Update this
  file and `src/lib/members/invite.test.ts` (the shape is asserted there).
