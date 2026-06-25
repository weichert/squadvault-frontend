# OBSERVATIONS 2026-06-24 - Bug B follow-up: redirect carry-through (same-origin guard)

**Lane:** EXECUTE. **Frontend:** from `42677be` (the Bug B fix). **Repo:** frontend ONLY.
**Supersedes** the "v1 omit the nested redirect" limitation recorded in
`_observations/OBSERVATIONS_2026_06_24_BUG_B_AUTH_CALLBACK_VERIFYOTP.md` (memos are append-only;
this is the dated follow-up, not an edit). The Bug B fix made login COMPLETE; this makes an
invited member land on their league **consent page** instead of `/`.

## The limitation this closes
The Bug B fix kept the open-redirect guard exactly as-is (`redirect.startsWith("/")`). The email
templates carry the post-auth destination via `{{ .RedirectTo }}`, which expands to the FULL
absolute URL we pass as Supabase's `redirectTo` - and the old guard rejected any absolute URL,
collapsing it to `/`. So v1 had to omit `&redirect={{ .RedirectTo }}` from the templates and land
every member on home.

## What shipped (code)
- **`src/lib/auth/callback.ts`** - new `safeRedirectPath(redirect, origin, depth=0)`. Resolves the
  destination to a safe **same-origin RELATIVE path**. Accepts: a relative path; a same-origin
  ABSOLUTE URL (the `{{ .RedirectTo }}` carry-through); and a same-origin `/auth/callback` URL that
  NESTS the real destination in its own `?redirect=` (the callers pass the callback URL as
  `redirectTo`, so `{{ .RedirectTo }}` is that callback URL - it is unwrapped to the inner
  destination, one clean bounce). Everything cross-origin / protocol-relative / malformed collapses
  to `/`. Implemented with `new URL(redirect, origin)` + a strict `url.origin === origin` check;
  each unwrap layer is **re-validated** against the origin (a nested cross-origin target cannot
  smuggle through) and depth-capped at 3 against a crafted chain.
- **`src/app/auth/callback/route.ts`** - replaces the inline `startsWith("/")` guard with
  `safeRedirectPath(redirect, origin)`. The return always starts with `/`, so `${origin}${path}`
  stays well-formed.

**No caller changes.** `/api/members/invite` and `auth/login/page.tsx` already pass
`redirectTo = ${appUrl}/auth/callback?redirect=<relative-dest>`; the unwrap handles that shape
directly, so no change to either caller and **no dependency on the Supabase Redirect URLs
allowlist** (we keep passing the already-allowlisted `/auth/callback` URL). This was the deciding
factor over "pass the final destination as redirectTo", which would have risked the invite call
failing if the project's allowlist is strict.

## Security note (open-redirect surface)
The new guard is **stricter** than the one it replaces, not looser. The old
`redirect.startsWith("/")` admitted `//evil.example` (protocol-relative) - safe only because the
route prepended `${origin}`. The new guard parses against the origin and requires
`url.origin === origin`, so `//evil.example` resolves to `https://evil.example` and is rejected.
Proven vectors (all -> `/`): cross-origin absolute, protocol-relative, nested cross-origin inside a
callback URL, nested protocol-relative. A non-URL string resolves as a same-origin relative path
(safe). Every accepted result is a same-origin relative path.

## Proof
- `scripts/proof_auth_callback_verifyotp.ts` extended (now **24/24**, `npx tsx`): the 6 same-origin
  acceptances + 5 open-redirect rejections + the well-formed/same-origin invariant, alongside the
  original 12 verifyOtp branch-selection assertions.
- `npm run type-check` clean; `npm run build` green.
- Governance NOT in scope (no data model / RLS / write-path change).

## FOUNDER dashboard action - now the redirect param is SAFE to include
The template guidance from the Bug B memo stands, with the caveat **removed**: append
`&redirect={{ .RedirectTo }}` to each token_hash link so the consent destination carries through.
Target form (confirm variable names against the live project):
`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&redirect={{ .RedirectTo }}`
- Magic Link `type=email`, Invite `type=invite`, Confirm signup `type=signup`.
- With this, an invited member (different device) verifies via `verifyOtp` and lands directly on
  `/league/<id>/consent`; a commissioner magic-link lands on whatever `redirect` the login page
  carried (default `/`).

## Guardrails
Correctness/security hardening of authentication only - no feature, no analytics, no new surface.
Guard is same-origin-only (no open redirect), strictly tighter than before. Engine repo untouched.
