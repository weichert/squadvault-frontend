# OBSERVATIONS 2026-06-24 - Bug B: auth callback no-op (token_hash + verifyOtp)

**Lane:** EXECUTE. **Frontend:** from `aed513a`. **Repo:** frontend ONLY. First formal diagnosis +
fix of Bug B. **Priority:** pre-Draft-Weekend (~2026-08-15 Tahoe) - this gates the whole league
logging in. **Pairs with a FOUNDER dashboard action** (email templates) that must land for the flow
to work end-to-end.

## Diagnosis (code-certain)
`src/app/auth/callback/route.ts` only acted inside `if (code)` and called `exchangeCodeForSession`
(the PKCE path). Two structural reasons that path no-ops for SquadVault:
1. **Invites are minted server-side** (`/api/members/invite` -> `admin.auth.admin.inviteUserByEmail`).
   The clicking member never ran `signInWithOtp` in their browser, so there is **no PKCE code-verifier**
   to exchange - `exchangeCodeForSession` cannot work for invited members, ever.
2. **The default email templates deliver the session in a URL fragment** (`#access_token=...`), which a
   server route physically cannot read (fragments never reach the server). So even the commissioner
   magic-link path no-ops unless the link happens to carry `?code=` and is clicked same-browser.

Confirmed against Supabase docs (server-side/nextjs; auth-email-templates): the SSR-correct delivery is
`token_hash` + `verifyOtp`, not the fragment link.

## What shipped (code)
- **`src/lib/auth/callback.ts`** (new): pure `resolveAuthSession(supabase, {token_hash, type, code})`
  -> `{userId?, userEmail?}`. Lives OUTSIDE the route module because Next App Router route files may only
  export HTTP handlers + config (a non-handler export breaks the route type contract - learned the hard
  way: the first cut exported the helper from `route.ts` and `tsc` rejected it via the generated
  `.next/types/.../route.ts`). Branch order: `token_hash + type` -> `verifyOtp` (SSR-correct, invite-
  capable, cross-device, no PKCE verifier); else `code` -> `exchangeCodeForSession` (legacy fallback,
  kept harmless); else empty.
- **`src/app/auth/callback/route.ts`**: reads `token_hash` / `type` / `code`; builds the SSR client ALWAYS
  (was only inside `if (code)`) so `verifyOtp` can write the session into the cookie store via the
  existing `setAll` wiring; calls `resolveAuthSession`; the **commissioner-claim block is unchanged**
  (runs after a session is obtained by either path). The open-redirect guard (`redirect.startsWith("/")`)
  is unchanged.

The code change is strictly **additive and safe**: it keeps the `?code=` branch, so it cannot make the
(already broken) current behavior worse; it only ADDS the working `token_hash` path.

## Proof
- `scripts/proof_auth_callback_verifyotp.ts` (pure branch-selection over a fake client, no DB/no server;
  `npx tsx scripts/proof_auth_callback_verifyotp.ts`) **14/14**: token_hash+type -> verifyOtp called once
  with `{type, token_hash}` verbatim, exchange NOT called, identity returned; type-missing -> no auth call,
  empty (route falls through to safe redirect, no throw); no credential -> empty (the old fragment case);
  legacy code-only -> exchange called, identity returned; verifyOtp error -> empty (bad/expired link does
  not 500); open-redirect guard keeps relative, drops absolute.
- `npm run type-check` clean; `npm run build` green (`/auth/callback` compiles as a dynamic route).
- Governance NOT run: SETUP scopes it to schema/RLS/write-path changes; this touches only the auth branch
  (no data model, no RLS, no write-path change - the linkage logic in `/api/members/invite` is untouched).

## FOUNDER dashboard action (REQUIRED for end-to-end; not yet done)
Authentication -> Email Templates. Replace `{{ .ConfirmationURL }}` with a server-readable token_hash link
for EVERY template a member can hit, so none falls back to a fragment:
- **Magic Link** (commissioner `signInWithOtp`) -> `type=email`
- **Invite user** (`inviteUserByEmail`) -> `type=invite`
- **Confirm signup** (first-ever login) -> `type=signup`

Target form (confirm exact variable names against the live project):
`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite`

**Redirect carry-through caveat (the one fiddly bit).** Today the code passes `redirectTo =
${appUrl}/auth/callback?redirect=/league/<id>/consent`, so the template's `{{ .RedirectTo }}` is a FULL
absolute URL. Appending `&redirect={{ .RedirectTo }}` would feed an absolute URL to the guard, which drops
it to `/`. So for **v1, OMIT the nested `redirect` param** - the member lands on `/` (home) and reaches
their league/consent from there; the destination is recoverable from the link records. Carrying the
consent destination cleanly is a small **follow-up** (relax the guard to accept same-origin-absolute, and
pass the FINAL destination as `redirectTo` instead of a callback URL); deliberately OUT OF SCOPE here to
keep the guard exactly as-is per the brief.

## Test plan (confirmation, founder-run, after templates change)
1. Magic link on the live app + an invite to a test address; click each. After: links land on
   `/auth/callback?token_hash=...&type=...`; `verifyOtp` creates the session; login completes for BOTH the
   commissioner and an invited member - the member tested **on a different device/browser** than where the
   invite was issued (the case PKCE never handled).

## Guardrails
Correctness/security fix to authentication only - no feature, no analytics, no new surface. No data-model /
RLS / linkage change. Open-redirect guard preserved. Engine repo untouched.
