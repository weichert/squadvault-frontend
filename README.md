# SquadVault — Frontend (The Clubhouse)

This is the frontend for **SquadVault**, a deterministic recap engine with
governed expressive output. SquadVault turns a fantasy league's immutable
factual history into narrative artifacts — weekly recaps, rivalry chronicles,
hall-of-fame records — under a strict governance model where a human always
approves before anything is published.

This repo is **The Clubhouse**: the Next.js application where commissioners
review and approve artifacts, run a league's founding session, and where
members read the league's permanent record.

## Two-repo model

SquadVault spans two repositories:

- **Engine** — `weichert/squadvault` (Python / SQLite). The append-only fact
  ledger, recap generation pipeline, verifier, and the sync scripts that push
  approved artifacts to Supabase.
- **Frontend** — `weichert/squadvault-frontend` (this repo). The Clubhouse UI.

The two are coupled through **Supabase**, not a synchronous API: the engine
pushes artifacts as `DRAFT`; the commissioner approves them here; the frontend
renders live Supabase state. The schema contract lives in
`src/lib/supabase/types.ts`.

## Governance posture (non-negotiable)

- Facts are immutable and append-only.
- Narratives are derived, never fact-creating.
- AI assists; humans approve publication.
- Silence is preferred over speculation.
- No analytics, optimization, engagement loops, or prediction — ever.

## Stack

Next.js 14 (App Router) · TypeScript · Supabase (Auth + Postgres + Storage) ·
Tailwind CSS · Vercel. Node version pinned in `.nvmrc`.

## Getting started

See **[SETUP.md](./SETUP.md)** for local development, environment, database
migrations, gates, and deploy wiring.

## Where things are

- **[ROADMAP.md](./ROADMAP.md)** — milestone state, what's built, what's next.
- **`_observations/`** — running session memos and decision records.
- **`SquadVault_Clubhouse_Design_Brief_v1_0.docx`** — authoritative design source.
