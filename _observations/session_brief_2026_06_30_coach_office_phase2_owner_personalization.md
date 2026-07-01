# Session Brief - Coach Office Phase 2: owner personalization

Authored 2026-06-30 (Claude Code, Opus 4.8). Phase 2 of the Coach Office Product
Surface. Spec package: `docs/coach_office/final_spec_package_v1/`. Builds on Phase 1
(CO.1, PR #46).

## Verified HEAD at authoring

Branch `feat/coach-office-phase1-static-shell` tip `126ad2e`; CO.1 code is `f44717e`.
**Phase 2 branches from `main` once PR #46 merges** - verify `git log` shows `f44717e`
in main's history before starting; if #46 is not merged, branch off it instead and
flag to the founder.

## Decisions locked (founder, 2026-06-30)

- D-2: **Derive, no new table.** The office profile is COMPUTED from the existing
      `franchises` row + constants. NO migration, NO `coach_office_profiles` table in
      Phase 2. Trophy/Ring content derives off the existing `lib/trophy-room.ts`
      read-models. The table + its schema (and reconciliation with the existing
      `voice_profiles`) are deferred until per-coach customization needs storing (P3+).
- D-5: **First target = Weichert's Warmongers.** For acceptance verification.

## Test fixtures (data, NOT to be hard-coded in components)

- League "PFL Buddies": canonical_id `70985` (uuid `00000000-0000-0000-0000-000000000001`).
- Weichert's Warmongers: canonical_franchise_id `0005` (uuid `d43b1199-1c1a-4ffa-a8dc-3c6abcd26ede`).
- Acceptance URL: `/league/70985/coach-office/0005`.
- Expected: exactly **1 championship ring (2024)** (`trophy_room_entries` CHAMPIONSHIP,
  franchise = 0005). A zero-title coach must show the empty state.
- coachId in the URL = `canonical_franchise_id`. Resolve it to the franchise row from
  data; NEVER hard-code `0005` (or `70985`) in code - it is a test fixture only.

## Unit of work (one topic; may split Trophy Case to Phase 2b if it balloons)

Make the office owner-personalized from data: render the coach's real nameplate + team
name, and wire the Trophy Case and Ring Box hotspots to real derived content. Board,
photos, and cutout hotspots stay placeholders (Phases 3-7). Deterministic reads only.

## Verified reuse (present at CO.1 / trophy-room; read this session)

- `lib/trophy-room.ts` `loadChampionshipPackage(admin, leagueUuid)` returns
  `{ belt, champions }`; `champions[]` = `{season, franchiseId, eraName, title}`
  (newest-first). Filter to the coach by mapping `franchiseId` (uuid) ->
  `canonical_franchise_id` == coachId. The uuid->canonical + era-name resolution idiom
  is in that file (lines ~91-138) and on the trophy-room page.
- `lib/league.ts` `getLeague` / `getViewer`; `franchises` row carries
  `canonical_franchise_id` + `owner_display_name`; `franchise_season_names` carries
  era-correct names.
- CO.1 shell: `app/league/[id]/coach-office/[coachId]/page.tsx`,
  `components/coach-office/office-shell.tsx`, `hotspot-modal.tsx`,
  `lib/coach-office/hotspots.ts` + `types.ts`.

## Exact file paths

Create:
- `src/lib/coach-office/profile.ts` - `resolveCoachOfficeProfile(admin, league, coachId)`:
  resolves the `franchises` row by `canonical_franchise_id` == coachId within the league;
  returns `{ coachId, displayName, teamName, hotspotMapId }` (teamName era-correct current
  name; hotspotMapId = the v1 manifest constant; base scene stays the D-4 placeholder).
  Returns null when no franchise matches (honest gap).
- `src/lib/coach-office/resolvers.ts` - `resolveRingBox(admin, league, coachId)` (the coach's
  championships -> rings, one per title season; derived off `loadChampionshipPackage`
  champions filtered to the coach; never invents) and `resolveTrophyCase(admin, league,
  coachId)` (Phase 2 scope = the coach's CHAMPIONSHIP trophies as the achievement archive;
  same source, rendered as trophies). Both return typed lists + an explicit empty flag.
- `src/components/coach-office/ring-box-view.tsx` - renders the ring list (or empty state).
- `src/components/coach-office/trophy-case-view.tsx` - renders the trophy list (or empty state).

Edit:
- `src/app/league/[id]/coach-office/[coachId]/page.tsx` - resolve profile + ring/trophy
  data server-side; render the real nameplate/team in the header; pass a per-hotspot
  content map to the shell. notFound (or honest empty) when the profile is null.
- `src/components/coach-office/office-shell.tsx` - accept an optional content map keyed by
  `click_action` (or hotspot_id) and forward the matching node to the modal.
- `src/components/coach-office/hotspot-modal.tsx` - render the provided content node when
  present; fall back to the "coming soon" placeholder otherwise (board/photos/cutout).

## Binary acceptance criteria

1. `/league/70985/coach-office/0005` renders "Weichert's Warmongers" as the nameplate/team
   from data (not the raw coachId).
2. The Ring Box modal shows exactly **1 ring (2024)** for `0005`; the count equals that
   coach's CHAMPIONSHIP entry count, never invented.
3. The Trophy Case modal shows exactly that coach's championship trophy/trophies; a coach
   with zero titles shows the empty state (no fabricated awards).
4. A coachId with no matching franchise renders an honest empty/notFound state (no crash).
5. Two different coachIds render different offices from data only (spec Phase 2 exit).
6. Board, Framed Photos, and Cardboard Cutout hotspots still open the placeholder modal
   (unchanged from CO.1).
7. Reads only - no new table/migration, no writes. Determinism: identical inputs ->
   identical output.
8. Gates: `npm run type-check` green; production build green at CI parity (Node 24,
   NODE_ENV=production - see the local-build note); banned-literal grep over new/edited
   coach-office files clean (no `0005`/`70985`/league/coach/team literals in code).

## Gates to run

`npm run type-check` -> production build at CI parity. Keep gates and commit separate.
Update `ROADMAP.md` (CO.2 row) in the same commit series. Do NOT run `npm run build` with
`NODE_ENV=development` in the environment (`.env.local` sets it; it trips the Next 14
`<Html>` prerender bug - build with NODE_ENV unset/production).

## OUT OF SCOPE (deferred)

- `coach_office_profiles` table / any migration / any write (D-2: derive-only in P2).
- **Phase 2b** - the richer Trophy Case aggregation: the coach's held Live Records
  (`loadLiveRecords`) + Season Awards (`loadSeasonAwards`) filtered to the coach. Deferred
  because holder->coach filtering across derived read-models (and `season_award_winners`
  read-time canonical resolution) is non-trivial; Phase 2 Trophy Case = championships only.
- visitor_id threading / relationship-aware rendering (Phase 3).
- board messaging / voice profile (Phase 4); photos/media (Phase 5); easter eggs (Phase 6);
  cutouts (Phase 7); QA/no-hard-coding gate (Phase 8).
- Real Lake Tahoe artwork (still D-4 placeholder scene); nav-tab integration.
- Era-turnover slots (a canonical slot whose owner changed): Phase 2 keys the office to the
  current occupant; multi-era office identity is a later concern.

## Definition of done (charter section 3.9-3.12)

Gates green; observation memo / close-out filed; `ROADMAP.md` CO.2 row with commit hash;
close-out to founder (shipped hashes, discharged, opened, next session = Phase 2b or Phase 3).
