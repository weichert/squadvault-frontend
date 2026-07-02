# Observation - Coach Office Phase 3: relationship-aware viewer context foundation

Dated 2026-07-01 (Claude Code, Opus 4.8). Discharges the Phase 3 unit of work.
Feat commit `b28b4cc` on branch `feat/coach-office-phase3-viewer-context`
(stacked on `72acad4`, the Phase 2b discharge).

## Stale-brief note (surfaced this session)

Two successive briefs arrived mislabeled and were returned before any code was
written (charter section 3.4 - git wins over a brief):
- A "Phase 1" green-light whose whole unit was already shipped (`f44717e`).
- A "Stage 3" brief whose content was owner personalization - already shipped as
  Phase 2 (`4830640`) + Phase 2b (`84664f0`); implementing it literally would have
  REGRESSED the derived Trophy Case / Ring Box back to placeholders.
The founder retargeted to the genuine next unit (relationship-aware context) and
authored a corrected brief against verified HEAD `72acad4`. Phase numbering,
grounded in git: P1 shell `f44717e`; P2 owner personalization `4830640`; P2b held
records `84664f0`; **P3 viewer context `b28b4cc` (this).**

## What shipped

A presentation-context foundation that answers "who is viewing this office, and
what is their relationship to the owner?" - and deliberately NOT "what
relationship-specific content should we show?" (later phases).

- `src/lib/coach-office/viewer-context.ts` (new). Taxonomy
  `OWNER | COMMISSIONER | LEAGUE_MATE | PUBLIC_OR_UNKNOWN`. Pure deterministic
  `classifyCoachOfficeViewerContext(facts)`; precedence OWNER -> COMMISSIONER ->
  LEAGUE_MATE -> PUBLIC_OR_UNKNOWN (first match wins; owner-viewing-own-office wins
  over the commissioner role). Thin async
  `resolveCoachOfficeViewerContext(admin, league, viewer, officeProfile)` whose only
  I/O is ONE read-only `franchises` lookup (`member_user_id` ->
  `canonical_franchise_id`); anonymous viewers skip it. All cross-module imports are
  `import type` (erased at runtime) so the classifier is provable with no DB / no
  Next context. Capability booleans are conservative and ADVISORY only:
  `canViewPublicOffice=true`, `canViewOwnerOnlySurface = OWNER`,
  `canViewRelationshipSurface = relationship !== PUBLIC_OR_UNKNOWN`.
- `page.tsx`: `getViewer(id)` + `resolveCoachOfficeViewerContext(...)`, passed to
  `OfficeShell`. Nothing below branches on it.
- `office-shell.tsx`: optional `viewerContext` prop, threaded to the modal. No
  visual change; no hotspot shown/hidden/altered.
- `hotspot-modal.tsx`: optional `viewerContext`; surfaced only as a neutral
  debug-safe `data-viewer-relationship` attribute on the dialog root.
- `scripts/proof_coach_office_viewer_context.ts` (new): self-contained determinism
  proof (project `scripts/proof_*.ts` convention; relative import; no env needed).

## Relationship truth table (proved 40/40)

| viewer.userId | viewerCoachId | isCommissioner | relationship |
|---|---|---|---|
| null | - | (any) | PUBLIC_OR_UNKNOWN |
| set | == office | false | OWNER |
| set | == office | true | OWNER (precedence over commissioner) |
| set | != office | true | COMMISSIONER |
| set | null | true | COMMISSIONER |
| set | != office | false | LEAGUE_MATE |
| set | null | false | PUBLIC_OR_UNKNOWN |

## Invariants held

- No content filtered: no consumer reads the capability booleans to gate anything.
- Trophy Case / Ring Box behavior preserved (page still derives and passes the
  same `content` map; those components untouched).
- No new table, no migration, no consent workflow; no board/media/eggs/cutouts.
- Platform-general: no league/coach/team/joke literals (grep clean, 5/5 files).

## Checks run

- type-check: green.
- production build: green at CI parity (Node 24, NODE_ENV=production; local
  `.env.local` NODE_ENV override applied per the known `<Html>` prerender note).
- governance (`npm run test:governance`): 154/0 - no regression (no new DB object,
  no new G-test).
- `proof_coach_office_viewer_context.ts`: 40/40.
- lint: NOT run. The repo carries no ESLint config (`next lint` only offers to
  scaffold one) and CI (`.github/workflows/ci.yml`) runs type-check + build only.
  Consistent with how CO.1/CO.2/CO.2b were discharged. Not scaffolding a config
  (unapproved scope). Flagged as the one brief deviation.

## Deviations from the brief

1. `lint` skipped - no ESLint config in the repo; not a CI gate (see above).
2. `src/lib/coach-office/types.ts` left untouched - per the confirmed file-set
   decision, viewer-context types co-locate with their resolver (the `profile.ts`
   convention); `types.ts` stays manifest-only. This was pre-approved.

## Recommended next phase

Phase 4 (Board Messaging) is the natural next surface and is the first CONSUMER of
this context - board copy that varies by relationship. It will need a brief against
the new HEAD, the D-x picks for board content/visibility, and (unlike P3) touches
consent-adjacent write paths, so section 7 escalation should be re-checked at
authoring even though W.6 is Done.
