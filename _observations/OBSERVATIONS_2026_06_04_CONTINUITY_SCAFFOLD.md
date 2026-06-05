# OBSERVATIONS — Continuity scaffold + production deploy recovery

**Date:** 2026-06-04
**Author:** Steve, with Claude
**Repo position at session end:** frontend `main` (this commit and its sibling
CI/deploy-guard commit); production deploy green on Vercel.
**Status:** Observation memo. First resident of the frontend `_observations/`
directory.

---

## 1. Why this memo exists

This is the inaugural frontend continuity memo. Until now the frontend had no
`_observations/` surface, no milestone roadmap, and a stale `SETUP.md` — all
flagged in the engine-side cross-repo gap analysis
(`OBSERVATIONS_2026_05_29_FRONTEND_INCLUSIVE_GAP_ANALYSIS.md`, sections 5 and
11). This session stood up that missing apparatus and, in the process,
recovered a fully-broken production deploy. Both are recorded here so the next
cold session resumes from state rather than re-deriving it.

## 2. What this session shipped

**Continuity scaffold (the "B" work stream):**
- This `_observations/` directory + its `README.md` convention note.
- `ROADMAP.md` at repo root — the single ordered milestone list (M0–M5 +
  current position), which previously existed only across commits, chat, and
  the Design Brief.
- Rewritten `README.md` (product-naming, two-repo model) and `SETUP.md`
  (current cross-repo state, deploy wiring, captured gotchas).

**CI + deploy hardening:**
- `.github/workflows/ci.yml` — type-check + production build on push/PR.
  Governance tests stay local (they mutate a live Supabase project).
- `.nvmrc` pinned to Node 24, matching Vercel's runtime; ends local/CI/prod
  version drift.
- `vercel.json` with `framework: "nextjs"` — a version-controlled guard so the
  framework can never silently regress to the Python builder again (see §3).

**Build fix (shipped earlier in the session, commits `b4219a0`, `397c215`):**
- Wrapped `/auth/login` (a client component using `useSearchParams`) in a
  `<Suspense>` boundary; without it `next build` failed prerender.
- Removed the empty duplicate `next.config.mjs` (`next.config.js` is the real
  config).

## 3. The production deploy incident (root-cause record)

Production had been failing. The investigation found a chain of independent
faults, fixed in order:

1. **Wrong repo connected.** The Vercel project's Git source was pointed at
   `weichert/squadvault` (the Python engine), not `weichert/squadvault-frontend`.
   Vercel correctly detected Python on the engine and failed: "No python
   entrypoint found." Fixed by reconnecting Git to the frontend repo.
2. **Framework preset stuck on Python.** Reconnecting Git does not reset the
   framework preset. The project still ran the Python builder. Fixed by setting
   Framework Preset = Next.js in project settings. (`vercel.json` now guards
   this permanently.)
3. **Build-blocking code bug.** Once building Next, `next build` failed on the
   `/auth/login` Suspense error — fixed by `b4219a0`.
4. **Missing build env.** The Git reconnect left the project with zero
   environment variables. `next build` prerenders `/auth/login`, which needs
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` at build time.
   Re-added all four project env vars (the two public, plus
   `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY`), scoped to
   Production/Preview/Development.

After all four, the deploy went green ("The Clubhouse" renders in production).

## 4. Gotchas captured (now also documented in SETUP.md)

- **`.env.local` carries `NODE_ENV=development`** (line ~33). Harmless for
  `next dev`, but it poisons a local `next build` (forces the dev React runtime
  into a prod build -> `Cannot read properties of null (reading 'useContext')`
  across all pages). Workaround today: `unset NODE_ENV && npm run build`.
  Vercel is unaffected (clean env, never reads `.env.local`). Flagged for
  deliberate removal.
- **Local `next build` needs the two public Supabase vars present** (the login
  page prerenders a client). `set -a; source .env.local; set +a` provides them.
- **Vercel env vars do not survive a Git reconnect** — re-verify them after any
  reconnect.
- **Run one-time apply scripts from outside the repo** (e.g. `~/sv-apply/`) so
  `git add -A` cannot sweep them into a commit (it happened once this session;
  cleaned up in `397c215`).

## 5. Open follow-ons (tracked, none blocking)

1. **Voice bridge** ("A" work stream, next): founding Voice Profile
   (Supabase `voice_profiles` / `leagues.voice_profile_id`) -> engine recap
   voice (SQLite `league_voice_profiles`, read by `creative_layer_v1`). Engine
   never reads `voice_profile_id` today; no Supabase->engine bridge. Build only
   when deliberately designed.
2. `leagues.docket_code` governed column — build when a second real league
   onboards.
3. Mid-session "skip" agent-prompt path — deferred from founding B1.
4. Deferred polish: full Member Office (stub today), archive search, "This Week
   in History" (needs historical calibration first), print stylesheet, light
   mode.
5. Remove `NODE_ENV=development` from `.env.local` (see §4).
6. **PFL-specific live auction app** (sibling to core, not part of governed
   engine): live layer = immutable-fact callbacks only (factual retrieval,
   e.g. prior auction prices on nomination); the spicy commentary lives in a
   human-approved post-draft Writer's Room recap, never live/unreviewed.
   Feeds MFL post-draft. Captured, not scoped. Feasibility linchpin: whether
   MFL accepts a programmatic draft-results write.

## 6. Reading order for a cold next session

1. `../ROADMAP.md` (where the frontend is).
2. This memo (most recent state + the deploy wiring that bit us).
3. Engine `_observations/OBSERVATIONS_2026_05_29_FRONTEND_INCLUSIVE_GAP_ANALYSIS.md`
   (the fuller cross-repo picture).
4. `SquadVault_Clubhouse_Design_Brief_v1_0.docx` (authoritative design source).
