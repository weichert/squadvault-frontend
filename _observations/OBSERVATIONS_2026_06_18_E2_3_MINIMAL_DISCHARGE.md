# E2.3-minimal acceptance + merge + discharge (2026-06-18)

EXECUTE session (Opus 4.8). Docket item 1 of the ratified sequence
(E2.3-minimal -> L.3 -> L.1 -> W.1 Inc 2). Acceptance + merge of docket item 1
only. Outcome: **DISCHARGED**. Merge commit `5521637` (PR #23) on `main`.

## What shipped to main

- `0a72b16` feat(members): E2.3-minimal - magic-link invite + ratified franchise
  linkage (migration 016 `franchise_member_links`, append-only commissioner-write,
  no UPDATE/DELETE; `POST /api/members/invite`; commissioner-only invite panel; G21
  governance test).
- `6e49c26` fix(members): invite redirect to consent surface, not bare `/league`
  (Bug A one-liner: `leagueRedirect` -> `/league/{league_id}/consent`). Was local +
  unpushed at session start; pushed onto the branch before acceptance.
- Merge `5521637` (gh pr merge --merge via CLI; the browser button is banned here -
  3 prior silent failures).

## Discharge gate (the three legs, from the 0a72b16 commit body)

1. **Migration 016 live.** CONFIRMED live on prod `qcaxemuydxlzpzgnnnoa`, with the
   surprise that it was **already applied 2026-06-13** during build-session
   click-throughs - `franchise_member_links` already held 3 append-only rows
   (commissioner self-test, then swickywick@yahoo.com twice). The brief's framing
   ("BUILT but NOT MERGED", implying the migration was not yet applied) was stale on
   the migration: the CODE was unmerged, the MIGRATION was already on prod. Today's
   "apply 016" was therefore a no-op on an existing table (the SQL editor's "syntax
   error" was a parse failure on the pasted block; nothing ran; no harm). Schema
   re-verified exact against the migration source (RLS on, two policies, no
   UPDATE/DELETE, correct columns + index).
2. **Governance 129/0 with G21 active.** G21 (`franchise_member_links` append-only)
   runs and passes - the migration-live proof. See the G11 finding below for why the
   count is 129, not the brief's expected 117.
3. **Real linked member + 2a-silence.** The franchise pointer
   (`franchises.member_user_id`) resolves to a real, **confirmed** auth user
   (`279af3cd...` = swickywick@yahoo.com). The read-model 2a gate (`loadRoomState`,
   av-room.ts:236, reading `member_consent_current` for `media_appearance`) now
   resolves cleanly and returns **no grant -> SILENCE, name withheld, fail-closed**
   for that member. Founder accepted the read-model 2a-silence as the discharge proof
   in lieu of an in-browser landing (the in-browser landing is gated by Bug B, below).

## Headline finding: W.6 migration 010 was never applied to prod

The blocker that nearly held discharge. The governance suite came back **126 passed,
1 failed** - G11 (`member_consent_events` is member-scoped + append-only, W.6). Not
an RLS/append-only violation: the seed step failed with
`PGRST205: Could not find the table 'public.member_consent_events' in the schema
cache`. A read-only enumeration confirmed `member_consent_events` AND its
`member_consent_current` view were the **only** two repo objects absent from prod -
migration 010 (W.6 Consent Governance, ratified 2026-06-10) had been committed to the
repo but never applied to the live project.

Two compounding hazards recorded:

- **G11 false-pass.** G11's first sub-test ("Anon cannot insert ... RLS enforced")
  treats ANY insert error as an RLS denial, so a missing-table error read as a PASS.
  G11's seeded sub-tests (b-d) only run when a franchise carries a `member_user_id`;
  at build time none did, so the seed was SKIPPED and the missing table was never
  exercised. The build-session 116/0 was clean only because the gap was invisible.
  It became visible this session precisely because the 2026-06-13 invites had since
  set a franchise pointer, flipping G11 from skip to seed.
- **Repo "Done" != prod applied.** ROADMAP marked W.6 "Done" on the strength of the
  committed migration. The charter's recurring stale-brief hazard, inverted: "code
  committed is not the same as the migration being live on prod" (cf. the 2026-06-09
  lesson, "data correct on prod is not the same as the code path being guarded in the
  repo"). Verify at the layer the claim is about.

**Resolution (founder-approved scope expansion, charter section 7 escalation).**
Applying 010 is consent/W.6 infra on live prod, so it was escalated rather than done
silently. Founder ruled: apply 010 now, this session. Migration 010 applied via the
Supabase SQL editor (table + `member_consent_current` view, member-only INSERT,
append-only, three CHECK constraints incl. the synth-class biconditional). Verified
exact. Governance re-ran **129/0, 0 failed** - the +3 over 126 are the G11 seeded
sub-tests now running for real instead of failing at the seed.

## Residuals (not blocking; logged for the next sessions)

- **`renders-with-grant` leg not live-exercised.** Discharge accepted on the
  silent-without-grant (2a-silence) leg via the read-model. The renders-with-grant
  path is correct by construction (same gate: `current_state == 'GRANT'` -> show
  name) but no GRANT was recorded and no in-browser render was observed.
- **Bug B (separate unit, OUT OF SCOPE here, flagged at build in `6e49c26`).** The
  project runs Supabase **implicit flow** (`#access_token` fragment). `/auth/callback`
  reads only `?code` (PKCE) and no-ops; session establishment is client-side via
  `detectSessionInUrl` at the landing route. Consequence: the callback
  commissioner-claim block (auth/callback/route.ts) may never fire under implicit
  flow. This also means the in-browser magic-link landing on the consent surface may
  not complete cleanly - which is why the discharge leaned on the read-model proof.
  Needs its own auth-flow look (PKCE-vs-implicit + where the commissioner claim runs).
- The commissioner IS established on prod (`leagues.commissioner_user_id = 030ee119` =
  steven.weichert@gmail.com, confirmed) - so the commissioner-id path works today
  despite the latent Bug B gap.

## Next session input

Docket item 2 = **L.3**. E2.3-minimal is discharged; A/V Room Increment 2
(member-testimony, build-gated on E2.3 linkage) is now structurally unblocked - a
franchise carries a real linked `member_user_id` and the 2a/2b gates read live
consent state.
