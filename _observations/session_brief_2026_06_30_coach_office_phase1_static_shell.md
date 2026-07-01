# Session Brief - Coach Office Phase 1: static interactive shell

Authored 2026-06-30 (Claude Code, Opus 4.8). Phase 0 scope-lock artifact for the
Coach Office Product Surface. Spec package: `docs/coach_office/final_spec_package_v1/`.

## Verified HEAD at authoring

`96eb2b3` - fix(members): invite consent-redirect uses canonical_id (#45).
Confirmed via `git log --oneline` and `git rev-parse HEAD` this session.

## Decisions locked (founder, 2026-06-30)

- D-1: route `/league/[id]/coach-office/[coachId]`; nav label "Coach Office".
      (coachId = `franchises.canonical_franchise_id`; the stable coach identity.)
- D-4: proceed on placeholders. No dependency on the Claude Design artwork track.

Still OPEN (NOT needed for Phase 1 - no DB, no real data, no artwork in this unit):
D-2 data-store reconciliation (media_record vs media_entries; structured voice
profile vs existing `voice_profiles`), D-3 visual language (Lake Tahoe register
vs vault tokens - Phase 1 uses existing vault tokens for the placeholder shell),
D-5 first target coach + seed.

## Unit of work (one topic, one commit)

Build the manifest-driven static shell of the Coach Office: a route that renders a
neutral placeholder base scene, overlays hotspots computed FROM the committed
hotspot manifest (coordinates in data, never in components), opens placeholder
modals per hotspot, and provides a mobile hotspot-list fallback plus a11y labels.
No real content, no personalization, no private data, no DB writes.

## Verified reuse (already-present at HEAD 96eb2b3 - read this session, not unverified)

- Route idiom: `src/app/league/[id]/trophy-room/page.tsx` - Server Component,
  `export const dynamic = "force-dynamic"`, admin reads, loader/component split.
- Identity/auth: `src/lib/league.ts` - `getLeague(canonicalId)`, `getViewer(...)`.
- Coach = franchise: `franchises` table, `canonical_franchise_id` /
  `owner_display_name` (migration `001_core_schema.sql`).
- Manifest source: `docs/coach_office/final_spec_package_v1/Coach_Office_Hotspot_Map_Template_v1.json`
  (image 1792x1024, 5 hotspots; 4 mvp_required + cardboard_cutout_slot optional).

## Exact file paths (create)

- `src/lib/coach-office/types.ts` - `Hotspot`, `HotspotMap` types (mirror the
  manifest schema fields).
- `src/lib/coach-office/hotspots.ts` - `COACH_OFFICE_HOTSPOTS_V1: HotspotMap`,
  transcribed verbatim from the manifest template above; the single runtime source
  of hotspot geometry. A header comment cites the template as source of truth.
- `src/app/league/[id]/coach-office/[coachId]/page.tsx` - Server Component;
  `dynamic = "force-dynamic"`; `getLeague` -> notFound on miss; renders the shell.
  coachId is passed through as a placeholder label only (NOT resolved to franchise
  data in this phase).
- `src/components/coach-office/office-shell.tsx` - Client Component; renders the
  placeholder base-scene box at the manifest aspect ratio, positions each hotspot
  as a percentage of image_width/image_height, holds hover/selected state, opens
  the modal, and renders the mobile hotspot-list fallback.
- `src/components/coach-office/hotspot-modal.tsx` - placeholder modal (title from
  hotspot label; body = "coming soon" empty state); focus-trapped, Escape closes.

## Binary acceptance criteria

1. `/league/<valid-canonical-id>/coach-office/<anything>` returns 200 and renders
   the shell; an unknown league id renders Next notFound.
2. All 5 hotspots render at positions COMPUTED from the manifest. Editing an x/y in
   `hotspots.ts` moves the hotspot; grep confirms no numeric coordinate literal in
   `office-shell.tsx` or the page.
3. Clicking/activating each hotspot opens a placeholder modal identified by that
   hotspot's label; Escape or close returns to the room with focus restored.
4. Below the md breakpoint, a hotspot-list fallback lists all 5 labels as tappable
   controls at >=44x44px; each opens the same placeholder modal.
5. Each hotspot control exposes an accessible name from the manifest `label`.
6. No trophy/ring/media/board/easter-egg/cutout data is read or rendered; no
   `visitor_id` filtering; no private content; the only DB call is `getLeague`.
7. Gates green: `npm run type-check`, `npm run lint`, `npm run build`, and
   `npm run test:governance` at its current passing count (no regression). Grep
   audit: no banned literal (PFL, Steve, KP, Robb, specific trophy/team/joke names)
   in any new file.

## Gates to run (frontend; engine gate apparatus does not apply here)

`npm run type-check` -> `npm run lint` -> `npm run build` -> `npm run test:governance`.
Run gates before commit; keep gates and commit as separate steps. Update `ROADMAP.md`
in the same commit series (frontend state ledger, charter section 4).

## OUT OF SCOPE (explicit - deferred to later phases)

- Any Supabase migration or table (coach_office_profiles, voice profiles, media,
  easter eggs, cutouts, board messages).
- Coach office profile loader; nameplate/team from real franchise data; resolving
  coachId to a franchise row.
- Trophy Display Resolver, Ring Box Resolver (Phase 2).
- visitor_id threading / relationship-aware filtering (Phase 3).
- Board messaging + voice profile + screenshot-safe/commissioner override (Phase 4).
- Photo frame / gallery / media visibility (Phase 5).
- Easter eggs (Phase 6); cardboard cutouts (Phase 7).
- Any consent surface or private content.
- Real Lake Tahoe artwork / hero scene image (Claude Design track; D-4 placeholders).
- Nav tab wiring in `top-nav.tsx` (the "Coach Office" label is locked for when it is
  wired, but the tab needs a viewer->franchise resolution that is Phase 2 data work;
  Phase 1 reaches the route by direct URL).

## Definition of done (charter section 3.9-3.12)

Gates green per above; observation memo filed in `_observations/`; `ROADMAP.md`
updated with the Coach Office Phase 1 milestone row + commit hash; close-out to
founder (what shipped, what discharged, what opened, next session).
