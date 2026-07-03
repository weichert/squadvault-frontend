# Observation - Middleware Anon-Gate Investigation (Findings)

Dated 2026-07-04 (Claude Code, Opus 4.8). Diagnosis-only unit per
`_observations/session_brief_2026_07_04_middleware_anon_gate_investigation.md`
(brief landed `9d20a2c`). Discharges the CO.3 close-out finding: `middleware.ts:30`
is coded to redirect anonymous users on all `/league/*`, yet prod serves
`/league/70985` in full to a session-less browser. No source/config/middleware
change was made; the repo diff for this unit is this memo only. The intended-
visibility ruling and any fix are the founder's, in the DECIDE lane.

## 1. Mechanism - the middleware file is never registered (wrong location for a src/ app)

**Finding:** `middleware.ts` lives at the PROJECT ROOT, but this project uses the
`src/` directory convention (the app is `src/app`, path alias `@/* -> ./src/*` in
`tsconfig.json:21`). Next.js only registers middleware from `middleware.ts` at the
**same level as `app`** - i.e. `src/middleware.ts` when `src/` is used. A root-level
`middleware.ts` beside `src/` is silently ignored. So the file is never compiled or
run, in ANY environment - the `/league/*` and `/admin/*` redirects in it are dead
code. This is not a matcher nuance, a Supabase-session-shape issue, a misplaced
return, or a deploy difference; the handler simply never loads.

**Evidence:**
- Location: `middleware.ts` at repo root; `src/app/` present; **no `src/middleware.ts`**
  (verified: `ls src/middleware.ts` -> absent). Path alias confirms the src/ convention (`tsconfig.json:21`).
- Build output: `npx next build` prints the full App route table but **zero** occurrences
  of "Middleware" (case-insensitive grep count = 0). A registered middleware prints a
  `ƒ Middleware` line in the build summary; its absence proves non-registration.
- Coded-but-dead logic: the redirect that would fire is `middleware.ts:30`
  (`if (pathname.startsWith('/league/') && !user) ... NextResponse.redirect('/auth/login')`)
  with matcher `middleware.ts:46` (`['/league/:path*', '/admin/:path*']`). Correct logic,
  never invoked.
- Prod confirmation: an anonymous GET of the base `/league/70985` returns **200** (below).
  If the middleware were live, its `startsWith('/league/')` rule would 307 that path to
  `/auth/login` exactly as the page-gated routes do. It does not.

## 2. Reachability census - page-level self-gates are the ONLY gate in effect

Because the middleware is dead, the sole anon control is each page's own
`if (!viewer.userId) redirect('/auth/login?redirect=...')`. Routes with that line
bounce anon (HTTP 307); routes without it render to anon (HTTP 200). Classification is
by code reading; a minimal set of unauthenticated read-only GET probes against prod
(`squadvault.vercel.app`; status + redirect target only, no bodies stored) confirms it.

| Route (`/league/70985/...`) | Gate mechanism | Anon result | Basis |
|---|---|---|---|
| `` (league home) | none | 200 render | no gate in `page.tsx`; probe 200 |
| `coach-office/[coachId]` | none | 200 render | no gate in page; probe 200 (`.../coach-office/0005`) |
| `members` | none | 200 render | no gate in `members/page.tsx`; probe 200 |
| `members/[franchiseId]` | none | 200 render | no gate in page; probe 200 (`.../members/0005`) |
| `trophy-room` | none | 200 render | no gate in page; probe 200 |
| `archive` | none | 200 render | no gate in page; probe 200 |
| `archive/recaps` | none | 200 render (inferred) | no gate in page; probe not run (code) |
| `archive/recaps/[artifactId]` | none | 200 render (inferred) | no gate in page; probe not run (code) |
| `archive/records` | none | 200 render (inferred) | no gate in page; probe not run (code) |
| `archive/records/[artifactId]` | none | 200 render (inferred) | no gate in page; probe not run (code) |
| `archive/rivalries` | none | 200 render (inferred) | no gate in page; probe not run (code) |
| `archive/rivalries/[artifactId]` | none | 200 render (inferred) | no gate in page; probe not run (code) |
| `office` | page-level | 307 -> /auth/login | `office/page.tsx:61`; probe 307 |
| `vault` | page-level | 307 -> /auth/login | `vault/page.tsx:36`; probe 307 |
| `history` | page-level | 307 -> /auth/login | `history/page.tsx:35`; probe 307 |
| `consent` | page-level | 307 -> /auth/login | `consent/page.tsx:44`; probe 307 |
| `av-room` | page-level | 307 -> /auth/login | `av-room/page.tsx:136`; probe 307 |
| `av-room/ingest` | page-level | 307 -> /auth/login (inferred) | `av-room/ingest/page.tsx:37`; probe not run (code) |
| `approve/[artifactId]` | page-level | 307 -> /auth/login (inferred) | `approve/[artifactId]/page.tsx:31`; probe not run (code) |

**Probe log (anonymous GET, `https://squadvault.vercel.app`, no bodies stored):**
```
/league/70985                     => 200
/league/70985/office              => 307 -> /auth/login?redirect=/league/70985/office
/league/70985/coach-office/0005   => 200
/league/70985/vault               => 307 -> /auth/login?redirect=/league/70985/vault
/league/70985/members             => 200
/league/70985/members/0005        => 200
/league/70985/trophy-room         => 200
/league/70985/history             => 307 -> /auth/login?redirect=/league/70985/history
/league/70985/consent             => 307 -> /auth/login?redirect=/league/70985/consent
/league/70985/av-room             => 307 -> /auth/login?redirect=/league/70985/av-room
/league/70985/archive             => 200
```
Every probe matches the code classification: ungated pages 200, self-gated pages 307.

## 3. Consent-exposure check - no consent-scoped or personal member content on any anon-reachable route

For each anon-reachable (ungated) route, the rendered content is public/derived only;
none reads a consent toggle or renders member-consent-scoped content. A grep across all
nine ungated route `page.tsx` files for `consent|sealed|testimony|oral_history|media_caption|member_consent`
returned no references.

| Anon-reachable route | What renders | Consent-scoped? |
|---|---|---|
| league home | nameplate + derived trophies/rings/charter (ratified/derived) | No |
| `coach-office/[coachId]` | nameplate + derived championships/held records (CANONICAL) | No |
| `members` | franchise roster: team names + owner display names + charter seal (roster facts); commissioner-only linkage data gated at `members/page.tsx:71` | No |
| `members/[franchiseId]` | franchise identity + season names/records + `trophy_room_entries` (derived) | No |
| `trophy-room` | derived CANONICAL records/awards | No |
| `archive` + recaps/records/rivalries (+ `[artifactId]`) | approved, published league artifacts | No |

The consent-scoped/personal surfaces - `vault` (sealed letters), `history` (oral testimony),
`consent`, `av-room` (captions) - are all in the page-gated (307) set. **Result: no consent
exposure today.** The exposure risk is latent, not live: it materializes only if a future
phase adds consent-scoped or owner-only content to a currently-ungated route while relying
on the (dead) middleware for protection - the exact seam CO.3 flagged.

## Appendix - incidental findings (no action taken; recorded for the founder)

A1. **`metadataBase` points at a parked domain.** `src/app/layout.tsx:11` defaults
`metadataBase` to `https://squadvault.com`, but that host is a domain-sale parking page
(anon GET of `https://squadvault.com/` -> 302 to `domains.atom.com`, `server: openresty`),
not the app. The live app is `https://squadvault.vercel.app`. OpenGraph/canonical URLs
built from `metadataBase` therefore resolve against a dead domain unless
`NEXT_PUBLIC_APP_URL` is set in the prod environment. Out of this unit's scope.

A2. **The `/admin/*` gate is also dead.** `middleware.ts:36-40` intends an admin
role-gate; it is non-functional for the same location reason. No current exposure - a repo
route scan finds no `/admin` routes - but any future `/admin` surface would ship unguarded
if it relied on this middleware.

## Boundary

This memo names the mechanism, the reachability table, and the consent result, and stops.
It proposes no fix. The ruling - repair by moving the file to `src/middleware.ts`, or
delete/narrow it to match the intended public-vs-private visibility, and what that intended
visibility is - is the founder's, in the DECIDE lane.
