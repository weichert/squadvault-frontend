# SquadVault Frontend — Setup

Current-state setup for The Clubhouse (the SquadVault frontend). Replaces the
old Milestone 0+1 guide. For milestone state see `ROADMAP.md`; for the deploy
incident history see `_observations/`.

---

## 1. Two-repo orientation

You will be working across two checkouts that **both prompt as `squadvault %`**:

- **Frontend (this repo):** `~/squadvault` -> `weichert/squadvault-frontend`.
- **Engine:** `~/projects/squadvault` -> `weichert/squadvault`.

Always confirm which one you are in before running anything:

```
grep '"dev"' package.json
```

The frontend shows `"dev": "next dev"`. The engine has no root `package.json`.

---

## 2. Prerequisites

- Node — version pinned in `.nvmrc` (currently 24). With nvm: `nvm use`.
- npm.
- A Supabase project (staging is `qcaxemuydxlzpzgnnnoa`).
- An Anthropic API key (for the founding session).

---

## 3. Install

```
npm ci
```

---

## 4. Environment

Create `.env.local` at the repo root with:

```
NEXT_PUBLIC_SUPABASE_URL=...        # staging project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # anon/public key (ships to browser by design)
SUPABASE_SERVICE_ROLE_KEY=...       # server-only secret
ANTHROPIC_API_KEY=...               # founding session
```

`.env.local` is gitignored. The two `NEXT_PUBLIC_` values are also required at
**build time** (the login page prerenders a Supabase client).

> **Gotcha — do NOT put `NODE_ENV=development` in `.env.local`.** It is harmless
> for `next dev`, but it poisons `next build` (forces the dev React runtime into
> a production build -> `Cannot read properties of null (reading 'useContext')`
> across all pages). If a local build fails that way, run
> `unset NODE_ENV && npm run build`. Vercel is unaffected (clean env; never
> reads `.env.local`).

---

## 5. Database (Supabase)

Migrations are **committed records**, applied by hand via the Supabase SQL
Editor (there is no runner). Apply in order:

```
supabase/migrations/001_core_schema.sql
supabase/migrations/002_constraints_and_triggers.sql
supabase/migrations/003_rls_policies.sql
supabase/migrations/004_commissioner_email.sql
supabase/migrations/005_office_brief.sql
supabase/migrations/006_oral_history_eligible.sql
supabase/migrations/007_founding_session_active_unique.sql
```

Seeds:

```
supabase/seed/001_pfl_buddies_demo.sql      # real league: PFL Buddies (70985)
supabase/seed/002_founding_test_league.sql  # FOUNDING-TEST walkthrough fixture
```

Storage buckets (`league-media`, `league-seals`) must be **Private** — Supabase
defaults to public.

---

## 6. Run locally

```
nvm use
npm run dev
```

Open http://localhost:3000. After pulling changes that touch config or the
build, clear the cache first: `rm -rf .next`.

---

## 7. Gates

Run before pushing.

**Type-check** (always):

```
npm run type-check
```

**Governance tests** — required for any schema / RLS / write-path change. They
hit a live Supabase project and mutate it, so they are a **local** gate (not
CI). Load env first:

```
set -a; source .env.local; set +a
npm run test:governance
```

Current checks: G1 (member cannot read unapproved), G3 (no DELETE policies),
G4 (invalid state transition rejected at DB), G6 (anon cannot read private
league artifacts), G7 (demo trust-bar text), G9 (trust bar + docket on
approved), G10 (founding_sessions commissioner-scoped).

**Production build** locally (needs the two public env vars present):

```
set -a; source .env.local; set +a
unset NODE_ENV
npm run build
```

---

## 8. CI

`.github/workflows/ci.yml` runs **type-check + production build** on every push
to `main` and every PR, using `.nvmrc` for Node and placeholder public Supabase
values for the build. Governance tests are deliberately excluded (they mutate
live Supabase).

---

## 9. Deploy (Vercel)

The site auto-deploys from `main`. Wiring that must stay correct:

- **Connected Git repo:** Settings -> Git -> must be
  `weichert/squadvault-frontend` (NOT the engine `weichert/squadvault`).
- **Framework Preset:** Settings -> Build and Deployment -> **Next.js**. Also
  pinned in `vercel.json` (`framework: "nextjs"`) so it cannot silently
  regress to the Python builder.
- **Environment variables:** Settings -> Environment Variables -> all four keys
  from section 4, each scoped to **Production** (plus Preview/Development).

> **Gotcha — env vars do NOT survive a Git reconnect.** If you ever
> disconnect/reconnect the Git source, re-verify all four env vars afterward; a
> wiped env makes the build fail with "Supabase URL and API key are required."

---

## 10. Working conventions

- Run one-time apply scripts from **outside** the repo (e.g. `~/sv-apply/`,
  invoked by path) so `git add -A` cannot sweep them into a commit.
- Apply / gate / commit / push are separate steps, never `&&`-chained.
- One topic per commit.
