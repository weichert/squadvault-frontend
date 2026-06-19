# L.1 Historian Interviews - capture-only first wave build + DISCHARGE (2026-06-19)

EXECUTE session (Opus 4.8), frontend repo. Docket item 3 (L.1) first-wave capture slice,
built against the ratified spec (engine `c9d32d5` = `597103d` L.1 SCOPE RULED + the
SPECIFICATION commit; acceptance sections 5 + 6) and the build brief. Outcome: **capture
slice DISCHARGED**; the "as remembered by" DISPLAY successor deferred.

Merge `50741bf` (PR #25); build commits `e216bce` / `63a71ad` / `761fcf1` / `7a1894b` on `main`.

## What shipped (four units, one topic per commit)

- **Migration 019 `oral_history_testimony_consent`** (founder-applied, charter section 7
  consent-infra escalation): widened the `member_consent_events` category CHECK to add
  `oral_history_testimony` (the 010/017 idiom). Member-only INSERT already holds; no
  rendering_class; biconditional class-iff-synth CHECK untouched; `member_consent_current`
  picks it up free. A dedicated category (not `attributed_quotes`) for revocation granularity,
  per the L.3 precedent.
- **Migration 020 `member_history`** (founder-applied): the two-table append-only split.
  `member_history_sessions` = interview metadata, insert-once, member-identity-keyed via the
  `franchises.member_user_id` pointer (NOT flat franchise_id), franchise_id era-correct at
  capture; author/admin SELECT, member-only INSERT (own league + own franchise), no
  UPDATE/DELETE. `member_history_exchanges` = append-only child, one row per turn
  (HISTORIAN/MEMBER), `provenance` NOT NULL fixed `MEMBER_TESTIMONY` (the S1 non-strippable
  stamp via a fixed-value CHECK); author-only SELECT/INSERT (owns parent session), no
  UPDATE/DELETE. NO commissioner read this slice (display-deferred, not sealed).
- **Migration 021 `testimony_separation_probe`** (founder-applied) + **G23**: a SECURITY
  DEFINER read-only helper returning five booleans (both tables exist; provenance present +
  NOT NULL; NO FK from either testimony table to a fact/event-ledger table; NO trigger on
  either table; fails-closed on a missing object). G23 calls it + anon-insert-denied on both
  tables + a real-row seed proving anon cannot read a seeded exchange. The L.1 analogue of
  `vault_seal_probe` / G22.
- **The capture surface**: `lib/history/*` reuses the founding INTENT_CLASSES + turn-engine
  SHAPE (one model call, repair retry, strict JSON parse, safe fallback) but diverges on
  PERSISTENCE - each turn is an INSERTed row, not an in-place jsonb UPDATE. `POST
  /api/history/start` records the `oral_history_testimony` GRANT, then creates the session,
  then seeds the opening HISTORIAN turn (GRANT precedes capture). `POST
  /api/history/[sessionId]/turn` re-asserts the grant (defense-in-depth) and appends the
  member answer + historian reply. `/league/[id]/history` surface + `historian-conversation`
  client (consent-grant gate, then the interview). Consent-panel history label added.

## Acceptance (the payload bar - all met, end-to-end on prod)

Driven against the DEPLOYED routes on `squadvault.vercel.app` as a real franchise-linked
member (`swickywick@yahoo.com`, "Weichert's Warmongers", member `279af3cd`, league PFL
Buddies), via a minted member session (admin magic-link OTP -> SSR cookie):

1. **G23 green** + full governance **141/0** (no G1-G22 regression). 019/020/021 confirmed
   LIVE on prod `qcaxemuydxlzpzgnnnoa`; `testimony_separation_probe()` returns all five
   booleans true.
2. **NEGATIVE - capture refused with no prior GRANT:** `start` without `grantConsent` -> 400;
   `start` with `grantConsent:false` -> 400; no `member_history_sessions` row created; no
   GRANT recorded. The interview cannot begin without the affirmed grant (route-enforced,
   mirroring L.3's grant-precedes-seal).
3. **POSITIVE - GRANT precedes the first exchange:** `start` with `grantConsent:true` -> 200;
   the GRANT recorded at `08:06:05.482`, the first (opening HISTORIAN) exchange at
   `08:06:05.569` - GRANT precedes capture in the live timestamps.
4. **Testimony stored attributed + unmerged:** a member turn captured the member's verbatim
   words in their own turn (speaker=MEMBER) + the historian reply (speaker=HISTORIAN); every
   row carries `provenance=MEMBER_TESTIMONY`; the session is keyed to the member
   (`member_user_id=279af3cd`), never merged into a consensus.
5. **The separation (THE PAYLOAD):** `testimony_separation_probe` all true against the live
   testimony - no FK/trigger/write path from the testimony tables to the canonical events
   ledger. A remembered account provably cannot be read as / merged into an event fact.
6. **Defense-in-depth:** after a member REVOKE, the turn route refuses the next exchange
   (403) - the grant guard fires beyond session start.
7. `type-check` clean; production build green.

The acceptance interview was then **scrubbed** via service role (see below); the discharge
basis is the OBSERVED end-to-end pass, not persisted synthetic data.

## W.6 section-7.2-style consent declaration (this build)

- **Category touched:** `oral_history_testimony` (new, migration 019).
- **Gate that GRANTS it:** the capture surface / `POST /api/history/start`, member-authored
  only, at the moment the interview begins (consent-at-interview). No commissioner/admin proxy
  (W.6 1.3). Re-asserted by the turn route (no exchange without a current grant).
- **Gate that READS/consumes it:** NONE in this slice. Capture-only; the DISPLAY successor
  ("as remembered by" panels) is the future consumer. The grant authorizes capture now and
  display later.
- **Scope of the grant:** captured testimony kept as attributed, append-only record.
- **Revocability:** member-authored REVOKE withholds FUTURE display and stops further capture;
  it never deletes or rewrites the captured exchanges (invariant 6.1). Append-only throughout.

## Lessons / hazards (for the next sessions)

- **GRANT-precedes-capture is route-enforced, not RLS-enforced** (mirrors L.3's
  grant-precedes-seal). The RLS on the testimony tables gates ownership, not the consent grant;
  the `start` route records the grant as step 1 and the `turn` route re-checks it. This is the
  ratified pattern, but note: a determined member with direct PostgREST access could insert an
  exchange into their own session without going through the route. If grant-at-RLS is ever
  wanted, it would need a trigger/policy reading `member_consent_current` - deferred, not in
  the ratified scope.
- **Fresh prod object-existence probe PASSED before building** (the 010-false-pass hazard):
  both testimony tables correctly ABSENT; `oral_history_testimony` correctly rejected (23514)
  by the CHECK. Used `.select().limit(1)` (PGRST205 on absence), not `head:true` count.
- **Headless end-to-end as a real member is achievable** without a browser: admin
  `generateLink({type:'magiclink'})` -> anon `verifyOtp({token_hash})` mints a real session;
  feeding the access/refresh tokens through `@supabase/ssr`'s `setSession` produces the exact
  SSR cookies the deployed routes expect. This made the negative + positive cases provable
  against the live deployment, not just replicated.
- **`@supabase/supabase-js` + `@supabase/ssr` need the `ws` transport** under Node 20 (the
  governance harness already does this); pass `realtime: { transport: ws }` to BOTH clients.

## Out of scope / deferred (registered, not built)

- The L.1 **DISPLAY successor**: the "as remembered by" rendering in archive surfaces +
  Member Offices, where the two-layer RENDERING (verified fact vs remembered account, visibly
  distinct) is exercised and commissioner read-at-display is adjudicated. (Spec 3.4 / 9.1.)
- **L.4 audio testimony** (the `recorded_voice` path / Answering Machine); **L.2** Ask the
  Historian (Phase 12); **L.5** (pairs with the L.3 reveal half).
- **W.8 Memorabilia Pipeline** - REGISTER-only per spec section 9.2; no build authority.
- **Topic-pool ratification:** the spec-named seeds (how-they-joined, a championship, the
  0-14 season, the disputed trade, plus rivalry/draft/tradition/departed-member) ship as the
  pool. Because there is NO hard required-coverage gate, nothing structural depends on the
  exact list (it only seeds the historian's prompt). Founder may re-author the seeds anytime.
- **Discoverability:** like the L.3 vault capture slice, the surface ships at its route with
  no nav entry point yet; a Member-Office link is a small display-adjacent follow-up.
- The ten-member SWEEP (target, not a gate): one member end-to-end is the admissibility floor
  and is met; the pre-draft sweep is operational, not a code obligation.

## Test-data scrub (2026-06-19)

The L.1 acceptance interview (session `e9c93eab`, member `279af3cd`, three exchanges) and its
`oral_history_testimony` GRANT/REVOKE consent events were removed via service role after the
end-to-end proof, before any genuine member interview exists. Verified clean: 0
`member_history_sessions`, 0 `member_history_exchanges`, 0 `oral_history_testimony` consent
events remain. Recorded as an explicit one-time test-hygiene exception (the L.3 `d298a2a`
precedent) - NOT a precedent for deleting captured testimony. The append-only invariant stands
unbroken for all real testimony; the first genuine member interview will be the inaugural fact.

## Next session input

Docket: E2.3 DISCHARGED -> L.3 capture DISCHARGED -> **L.1 capture DISCHARGED (this)** ->
W.1 Inc 2. Docket item 3 (L.1) stays in-flight only for its DISPLAY successor; the capture
obligation for the pre-draft sweep is met. Founder call at close: advance to W.1 Inc 2, the
L.1 display successor, or hold.
