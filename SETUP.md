# SquadVault — Milestone 0 + 1 Setup Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- A Supabase account (free tier works)
- Supabase CLI (`npm install -g supabase`)

---

## Step 1 — Create the Next.js project

```bash
npx create-next-app@14.2.15 squadvault \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --no-eslint \
  --import-alias "@/*"
```

Then copy all scaffold files into the project:

```bash
# Copy scaffold files into your new project
cp -r /path/to/sv-scaffold/* squadvault/
cd squadvault
```

---

## Step 2 — Install dependencies

```bash
npm install
```

---

## Step 3 — Create two Supabase projects

Create at https://supabase.com/dashboard:
- `squadvault-staging` — for all development work
- `squadvault-prod` — for production (leave empty until Milestone 7)

For now, only the staging project is used.

---

## Step 4 — Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your staging Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL` — from Project Settings > API > Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Project Settings > API > anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — from Project Settings > API > service_role key
- `ANTHROPIC_API_KEY` — from console.anthropic.com

---

## Step 5 — Apply schema migrations

Link the Supabase CLI to your staging project:

```bash
supabase login
supabase link --project-ref your-staging-project-ref
```

Apply all migrations in order:

```bash
supabase db push
```

Or apply manually via the Supabase SQL Editor:
1. Open `supabase/migrations/001_core_schema.sql` → run
2. Open `supabase/migrations/002_constraints_and_triggers.sql` → run
3. Open `supabase/migrations/003_rls_policies.sql` → run

---

## Step 6 — Seed the PFL Buddies demo data

Via Supabase SQL Editor, run:
```
supabase/seed/001_pfl_buddies_demo.sql
```

Expected output at the end:
```
NOTICE: Seed complete: 1 league, 10 franchises, 1 artifacts
```

---

## Step 7 — Configure Supabase Storage buckets

In Supabase Dashboard > Storage:

1. Create bucket: `league-media`
   - Set to **Private** (NOT public)
   - Apply RLS policies (see Migration 003)

2. Create bucket: `league-seals`
   - Set to **Private** (NOT public)
   - Apply RLS policies

**CRITICAL:** Supabase Storage defaults to public. You must explicitly set buckets to private.

---

## Step 8 — Run locally

```bash
npm run dev
```

Open http://localhost:3000.

You should see the SquadVault landing page. Navigate to:
- http://localhost:3000/league/70985 — should show the PFL Buddies founding plaque

---

## Step 9 — Verify Milestone 0 exit criteria

Run the governance tests:

```bash
# Set env vars for the test runner
set -a && source .env.local && set +a

npm run test:governance
```

All tests must pass:
- G1: Anon cannot retrieve unapproved artifacts ✓
- G3: No DELETE policies on any table ✓
- G4: Invalid state transition rejected at DB layer ✓
- G6: Anon cannot read private league artifacts ✓
- G7: Demo artifact has correct trust bar text ✓
- G9: Trust bar and docket ID on approved artifacts ✓

---

## Step 10 — Verify the service role key is client-side safe

```bash
npm run build
grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/
```

This should return **no results**. If the service role key appears in the build output, stop immediately — it is a critical security failure.

---

## Milestone 0 exit criteria checklist

- [ ] App runs locally (`npm run dev`)
- [ ] App deploys to Vercel successfully
- [ ] Commissioner can create an account via Supabase Auth (magic link)
- [ ] Navigate to `/league/70985` — founding plaque renders correctly
- [ ] Navigate to `/league/nonexistent` — 404 renders (not an error)
- [ ] Navigate to `/league/70985` as anon — middleware redirects to /auth/login
- [ ] `npm run test:governance` — all tests pass
- [ ] `grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/` — returns no results
- [ ] CSP headers present on all routes (check browser DevTools > Network > Response Headers)

## Milestone 1 exit criteria checklist

- [ ] All tables exist in staging Supabase project
- [ ] Governance tests G1–G4 pass
- [ ] Demo league, 10 franchises, 1 approved artifact seeded
- [ ] Invalid state transition (e.g. DRAFT → APPROVED) rejected by DB trigger
- [ ] Member-role query returns only APPROVED artifacts
- [ ] `npm run type-check` passes with zero errors

---

## What's next (Milestone 2)

The approval UX — the trust foundation for everything that follows.
- Approval queue in Commissioner Office
- Single artifact review with scroll-to-unlock
- Approval stamp animation (the First Approval Ceremony for the first artifact)
- Trust bar upgrade animation
- Docket ID generation
- Haptic feedback on mobile

---

## File reference

```
src/
├── app/
│   ├── layout.tsx              Root layout + font loading
│   ├── globals.css             Design tokens + Tailwind base
│   ├── auth/
│   │   ├── login/page.tsx      Magic link sign-in
│   │   └── callback/route.ts   Supabase OAuth callback
│   ├── league/[id]/
│   │   └── page.tsx            Locked Room → Community Page
│   └── api/
│       ├── manifest/route.ts   PWA manifest (per-league)
│       └── og/route.tsx        OG image generation
├── lib/supabase/
│   ├── client.ts               Browser Supabase client
│   ├── server.ts               Server Supabase clients (incl. admin)
│   └── types.ts                TypeScript types for all tables
├── components/ui/
│   ├── trust-bar.tsx           All 4 trust bar variants
│   ├── docket-id.tsx           Docket ID display
│   └── locked-room.tsx         Pre-activation vault door
middleware.ts                   Edge auth guard
next.config.js                  CSP security headers
tailwind.config.ts              Full design token system
supabase/migrations/
├── 001_core_schema.sql
├── 002_constraints_and_triggers.sql
└── 003_rls_policies.sql
supabase/seed/
└── 001_pfl_buddies_demo.sql
scripts/
└── test-governance.ts          Governance test runner
```
