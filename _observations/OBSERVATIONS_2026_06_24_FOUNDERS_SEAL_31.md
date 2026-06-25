# OBSERVATIONS 2026-06-24 - Trophy #31 The Founder's Seal (seat + render)

**Lane:** EXECUTE. **Frontend:** from `ff855ad`. **Repo:** frontend ONLY (no engine - a pure attestation,
not generated from MFL events). Seats trophy #31 from the founder's attestation. ATTESTED (human testimony),
never CANONICAL.

## What shipped
- **Migration `031_founders_seal.sql`** (idempotent, league 70985, paste-safe, founder hand-applies):
  (1) `UPDATE leagues SET founding_year = 1984` (was **1983** on prod - the ingest generator's guess);
  (2) extends the `chk_trophy_entry_type` CHECK to register `FOUNDERS_SEAL` (additive, DROP IF EXISTS then
  ADD); (3) idempotent DELETE-then-INSERT of the single league-level Seal row (season/franchise NULL).
- **Frontend**: `TrophyEntryType` gains `FOUNDERS_SEAL`; `loadFoundersSeal` (single row -> {title,
  description, basis} or null); `founders-seal.tsx` renders a band near the top (origin statement) with the
  title, the engraving, an **ATTESTED - Not Canonical Data** trust label (teal attested axis, visibly
  distinct from the CANONICAL gold bar) and the **basis** line. Wired into `page.tsx` above the Championship
  Package. Absent entry -> renders nothing (silence before the migration lands).

## Two schema adaptations vs the brief (both forced; flagged)
1. **`entry_type`** has a CHECK enum (`CHAMPIONSHIP, PHYSICAL_TROPHY, COMMISSIONER_ATTESTED, SHAME_RECORD`).
   The brief's `'FOUNDERS_SEAL'` is new -> migration 031 extends the constraint (the brief invited this:
   "confirm no conflicting registered type").
2. **`provenance`** has a CHECK enum (`CANONICAL, COMMISSIONER_ATTESTED, DEMO`) - **no bare `ATTESTED`**, so
   the brief's `provenance = 'ATTESTED'` would FAIL the INSERT. Resolution: store the valid attested-branch
   value **`COMMISSIONER_ATTESTED`**, and render the Seal with a CUSTOM **"ATTESTED - Not Canonical Data"**
   label + the basis - so the card reads exactly as ratified, without inventing a new enum value or showing
   the generic "Commissioner Attested" wording. (If a distinct `ATTESTED` provenance value is wanted, that is
   a larger change - CHECK + TrophyProvenance type + the label/style maps - flag for a follow-up.)

## The attested facts engraved (nothing beyond these)
Founding year 1984 (the LEAGUE's, attested by David Stuart and Kent Paradis 2026-06-21 - not every member's
join date). Members came together across the late 1980s/early 1990s; not all are founders. All ten have been
present every season of the digital age (2010+) - the taxonomy's actual #31 definition. Newest = Brandon
Carmichael (Brandon Knows Ball, 0010), son of Eddie Carmichael (Eddie & the Cruisers, 0004). No other owner
names, no founding-day, no claim the nine are founders. Blank-never-guessed.

## Proof
- Migration paste-safe (no in-comment semicolons), idempotent, apostrophe-escaped (`Founder''s`).
- `scripts/proof_founders_seal.tsx` (render, `npx tsx --tsconfig scripts/tsconfig.proof.json`) 6/6: silence
  when absent; renders title + engraving + the ATTESTED/Not-Canonical label + the basis; does NOT claim
  canonical.
- typecheck + production build green.

## Prod-apply (FOUNDER-gated; NO prod write)
Founder hand-applies migration 031 (`pbcopy < ...031...sql`, clear the tab, paste, Run). The render deploys on
merge (Vercel) - the Seal appears once the migration is applied; nothing renders before. Post-apply verify:
founding_year = 1984, one FOUNDERS_SEAL row, the band shows ATTESTED + the basis.

## Guardrails
ATTESTED, not CANONICAL - the trust model's other branch, rendered with the basis. Append-only / silence (no
placeholder before seating). No engine, no generator, no MFL data (the founding predates the digital era). No
new owner facts beyond the four named. No 029/030 or championship-entry interaction.
