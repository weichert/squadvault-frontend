# E2.3-minimal - member onboarding (invite + ratified franchise linkage) - BUILD

Dated 2026-06-12. Type: build memo. Frontend repo `weichert/squadvault`.
Verified at authoring: main = `8cd2474` (PR #22 merge); built on branch
`feat/e2-3-minimal-member-onboarding`. Ruled scope: D-SEQ-2 (engine Fable DECIDE
2026-06-12, `OBSERVATIONS_2026_06_12_DSEQ_TAHOE_SEQUENCING_RULING.md`). Founder picked the
invite/link binding mechanism this session: **invite + ratify at issue** (Option A).

## What this unit is (ruled, not exceeded)

The first slice of E2.3: the ten members can be invited, and each member is bound to their
canonical franchise by a commissioner-ratified, append-only FACT. This is the forcing
function the rest of the pre-Tahoe docket (L.3, L.1, W.1 Inc 2) waits on, and it makes the
W.1 2a-silence / 2b-playback gates exercisable for the first time with a real member.

OUT OF SCOPE (deferred, untouched): captions/marginalia/self-tag (= Inc 2), notifications,
profile pages, password auth, L.3 compose UI, unlinking.

## The mechanism (Option A - invite + ratify at issue)

One commissioner action issues the invite AND records the linkage:

1. Commissioner-only control on the members directory: member email + franchise picker +
   `Invite + link`. (`src/components/members/member-invite-panel.tsx`; rendered only when
   `getViewer().isCommissioner` - the directory itself stays a public surface.)
2. `POST /api/members/invite`: authed + `isLeagueCommissioner` check; probe migration 016
   present (503 if not); `supabase.auth.admin.inviteUserByEmail(email)` -> Supabase sends
   the magic link, returns the new `user_id` (on `email_exists`, resolves the existing user
   via `listUsers` and still records the link, no new email); INSERT
   `franchise_member_links` via the AUTHED commissioner client (RLS commissioner-only INSERT
   is the hard boundary); UPDATE the derived `franchises.member_user_id` pointer via the
   authed client (under the existing `franchises_update` RLS).
3. The member clicks the emailed link only to AUTHENTICATE. Linkage was ratified by the
   commissioner at issue; the member never self-asserts it.

## Why a new table when franchises.member_user_id already existed

`franchises.member_user_id` has existed since migration 001, but nothing in the app ever
wrote it - linkage was an unprovenance out-of-band column edit. Migration 016
`franchise_member_links` makes the linkage a GOVERNED append-only event (sibling of
012/014/015: `league_id` NOT NULL, RLS select league-authed, insert commissioner-only, no
UPDATE/DELETE). The column survives as the DERIVED current pointer that existing readers
already consume - the 2a identification gate (`av-room.ts loadRoomState`),
`member_consent_events` scoping, and `get_user_league_id()` - so nothing downstream changed.
Latest event per franchise = current linkage (the voice-attestation supersession idiom);
a correction is a new event.

## Gate semantics: CONSUMED, not touched

Per the brief, this unit does not modify any gate. The 2a identification gate
(`loadRoomState`, av-room.ts:223-256) renders an identified member's name only against a
current `media_appearance` (2a) GRANT in `member_consent_current`, else the identification
stands in the record but display is silent (fail-closed). The D-W1-A playback gate keys on
2b `recorded_voice` grants. Both were structurally unexercisable until a franchise carried a
real linked `member_user_id`; this unit supplies exactly that.

## Files

- `supabase/migrations/016_franchise_member_links.sql` - new table + RLS.
- `src/lib/supabase/types.ts` - `FranchiseMemberLink` + Database block entry.
- `scripts/test-governance.ts` - G21 (probe-skip until 016 applied; anon INSERT denied 42501).
- `src/app/api/members/invite/route.ts` - invite + ratify route.
- `src/components/members/member-invite-panel.tsx` - commissioner-only control.
- `src/app/league/[id]/members/page.tsx` - commissioner-gated render of the panel.

## Verification at authoring (local)

- `npm run type-check` - clean.
- `npm run test:governance` - **116 passed, 0 failed**; G21 probe-skips ("apply migration
  016"). Once 016 is live, G21 activates AND the G11-G15 seeded sub-tests (currently skipping
  on "no franchise with a member_user_id") begin running against the first real linked member
  - so the suite jumps past 117, matching the brief's "117+/0".
- `npm run build`: fails LOCALLY on `/404 /500 / /auth/login` with the Next 14
  "`<Html>` should not be imported outside of pages/_document" prerender error. CONFIRMED
  PRE-EXISTING + ENVIRONMENTAL: the identical failure reproduces on a clean stash of `main`
  (`8cd2474`), which is the deployed HEAD whose CI build is green. Not introduced by this
  unit. Flagged for a separate look at local node/`.nvmrc` parity; CI (type-check + build on
  Vercel) is the authority and builds main clean.

## PENDING founder click-through (house venue: dev against prod Supabase)

Acceptance items below require the founder to (1) apply migration 016 via the Supabase SQL
Editor (the no-runner convention, SETUP.md), then (2) exercise one real invite end-to-end.
The verbatim 2a-silence observations are recorded here after that pass, before merge:

- [ ] Migration 016 applied; `npm run test:governance` = 117+/0 (G21 active).
- [ ] One real member invited end-to-end; magic link received; member authenticates;
      `franchises.member_user_id` set; `franchise_member_links` row present.
- [ ] 2a-silence: member identified in a photo with NO 2a grant -> name silent (record
      holds the identification, display withholds the name). [verbatim observation TBD]
- [ ] 2a-grant: member records a `media_appearance` GRANT in their consent panel -> name
      renders. [verbatim observation TBD]
- [ ] Commissioner identification continues to work. [verbatim observation TBD]

Until those are filled and gov reads 117+/0, this unit is BUILT, not DISCHARGED.

## Click-through 404 finding + auth-flow ledger (2026-06-12)

Founder-verified during the first click-through: the magic link landed on
`localhost:3000/league#access_token=...` and 404'd. Two-part finding.

**Fixed in-scope (this branch).** `src/app/api/members/invite/route.ts` set
`const leagueRedirect = '/league'`, a bare non-route. The redirect comment already names
the consent surface as the intended target, so it now reads
`/league/${franchise.league_id}/consent` (`franchise.league_id` was already in scope). The
member now lands on their consent surface to record 2a/2b grants, as designed.

**Auth-flow ledger (NOT fixed here - flagged for a separate look).** The 404 surfaced that
the project is on Supabase **implicit flow**: the magic link returns the session in a URL
**fragment** (`#access_token=...`), not a `?code` query param. Consequences recorded:

- `src/app/auth/callback/route.ts` reads only `?code` (PKCE) and no-ops under implicit flow
  - the fragment never reaches the server (browsers don't send `#...` to the server). Session
  establishment is therefore CLIENT-side via `detectSessionInUrl` at the landing route, not
  in the callback handler.
- Because the callback handler never runs under implicit flow, its **commissioner-claim
  block** (auth/callback/route.ts:41-62, which writes `leagues.commissioner_user_id` on first
  matching-email login) **may never fire**. This is a latent gap for commissioner onboarding,
  independent of the member-invite path fixed above.
- OUT OF SCOPE for E2.3-minimal: choosing PKCE vs implicit, and where the commissioner claim
  should run under the live flow, are a separate auth-flow unit. Flagged here, not decided.
