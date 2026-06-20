# OBSERVATIONS 2026-06-19 - W.1 Increment 2 member captions DISCHARGED (capture + two-layer display)

**Session type:** EXECUTE (Claude Code, Opus), FRONTEND repo. Built the unit specified at engine
`905cb1c` (spec `OBSERVATIONS_2026_06_19_PHASE_11_W1_INC2_SPECIFICATION.md` sections 5-7) under the
ratified scope ruling `OBSERVATIONS_2026_06_19_W1_INC2_SCOPE_RULING.md` (D-W1I2-1..6). Implementation
session; the architecture was not re-litigated.

**Anchors (git, verified this session):** frontend built from `73833bc`; engine spec read at `905cb1c`
(engine main was `8d030c0`, one doc commit ahead). Merged to frontend main at **`b653c9c`** (PR #26).
Feature commits `3f75597` (units 1-2), `dcbe2f5` (unit 3), `3c66c33` (unit 4), `699f0c6` (proof
harness), `a29fcd8` (build fix).

## What shipped
A consented, attributed, append-only member CAPTION on an A/V Room media item - "as remembered by
[member]" - captured and DISPLAYED beside, and visibly distinct from, the human-ratified provenance
facts. The two-layer RENDERING invariant deferred from L.1 is built here for the first time.

- **022** `media_caption` consent CHECK-widen (FOUNDER-APPLIED via the Supabase SQL editor, charter
  section 7 - I prepared + verified, did not self-apply). Dedicated category for revocation
  granularity over `attributed_quotes` (the 019 idiom); no `rendering_class`.
- **023** `media_captions` append-only table. `media_entry_id NOT NULL` is the ONLY permitted FK (the
  item attach point, D-W1I2-4); the FACT layer (`media_provenance_tag_events`) and the event ledger
  carry NO FK/trigger/write path. `provenance text NOT NULL DEFAULT 'MEMBER_CAPTION' CHECK (=
  'MEMBER_CAPTION')` is the non-strippable value-pinned stamp. RLS: SELECT league-authenticated through
  the parent `media_entries` row; INSERT member-only (`author_user_id = auth.uid()` AND the parent item
  in `get_user_league_id()`, no commissioner proxy); no UPDATE/DELETE (append-only).
- **024** `caption_separation_probe()` - the L.1 `testimony_separation_probe` (021) re-pointed at the
  media FACT layer; SECURITY DEFINER, booleans only, STABLE, `search_path = public, pg_catalog`; fails
  closed on a missing object (inverse-of-G11). **G24** in `scripts/test-governance.ts` mirrors G23.
- Capture: `POST /api/av-room/caption` - GRANT-precedes-capture, route-enforced (the L.1 precedent: RLS
  gates ownership + append-only, the route gates the grant). Records the `media_caption` GRANT (if not
  current) then inserts the caption; no `grantConsent` -> 400, nothing stored.
- Display: the A/V Room item view renders TWO visibly-distinct layers - the verified PROVENANCE panel
  and, structurally separate (`CaptionsPanel`: own heading, left rule, italic member voice), the "As
  remembered by" CAPTIONS panel. Never merged; no synthesized consensus; a caption is never styled or
  placed to read as a provenance tag. Member-only `CaptionComposer` with an explicit affirmative
  consent checkbox; no AI-authored captions, no reaction/engagement counts.

## Display-withdrawal shape (the recorded EXECUTE choice, spec 5.4)
Reused the existing `media_display_withdrawals` (No-New-Foundations) by adding a **nullable
`caption_id uuid REFERENCES media_captions(id)`** column - NOT by overloading the existing nullable
`media_entry_id` with a discriminator. Rationale: a separately-typed FK target keeps the two withdrawal
kinds unambiguous (an item withdrawal carries `media_entry_id`; a caption withdrawal carries
`caption_id`), preserves "honor latest withdrawal per target" with no discriminator branching, and adds
no UPDATE/DELETE policy (append-only intact). The existing commissioner-only INSERT serves the
commissioner "honor" path. Note: this FK points INTO `media_captions` (`conrelid =
media_display_withdrawals`), so it does NOT trip `caption_separation_probe` (which asserts the forbidden
`confrelid` set for FKs whose `conrelid = media_captions`). Caption withdrawal is withdrawal-only this
increment (no caption reinstatement path minted; a reinstatement is a later class decision).

## Prod probe results (qcaxemuydxlzpzgnnnoa)
- **FRESH pre-apply probe** (`scripts/probe_w1_inc2_preapply.ts`, before any 022 apply - the repo-Done
  != prod-applied hazard, the 010 G11 false-pass lesson): six-true substrate present (`media_entries`,
  `media_provenance_tag_events`, `media_display_withdrawals`, `member_consent_events`,
  `member_history_exchanges`, `testimony_separation_probe()`); `media_captions` ABSENT;
  `caption_separation_probe()` ABSENT; `media_caption` REJECTED (23514) by the consent CHECK. (Lesson:
  an absent table returns PostgREST `PGRST205` and `head:true` masks it - probe with
  `.select('id').limit(1)` and treat 42P01/PGRST205 as absent.)
- **Post-apply** (founder applied 022 -> 023 -> 024 in order): `media_captions` present;
  `caption_separation_probe` all-true (`captions_table_exists`, `provenance_not_null`,
  `no_fact_layer_fk`, `no_triggers`); a `media_caption` GRANT now ACCEPTED by the widened CHECK.

## Acceptance proof (the payload bar - all met)
Governance **147/0** (G24 green; no G1-G23 regression). End-to-end against the live caption route as a
real franchise-linked member (`swickywick@yahoo.com`, member `279af3cd`, "Weichert's Warmongers", PFL
Buddies / league canonical_id `70985`), via a headless-minted member session (admin magic-link OTP ->
SSR cookie; the L.1 pattern):

1. **NEGATIVE** - no grant: `caption` without `grantConsent` -> 400; with `grantConsent:false` -> 400;
   no `media_captions` row created; no `media_caption` GRANT recorded.
2. **POSITIVE** - GRANT precedes capture: the GRANT recorded at `02:22:49.905` precedes the caption row
   at `02:22:50.034`; body stored VERBATIM; `author_user_id` = the member (attributed); `provenance =
   MEMBER_CAPTION`.
3. **DISPLAY** - the caption body renders under the distinct "As remembered by" heading on the A/V Room
   page (slug `70985`), positioned after that heading and NOT merged into the provenance `<dl>`. The
   member-only composer renders for the franchise member.
4. **REVOCABLE-FORWARD** - a member-authored REVOKE (the member's own Bearer-authed client; RLS
   `member_user_id = auth.uid()` is the guarantee) sets the current state to REVOKE; the caption is then
   WITHHELD from display while the captured row stays intact (never rewritten/deleted).

Acceptance data scrubbed via service role; prod confirmed clean (0 residual proof captions, 0 residual
`media_caption` consent events). The discharge basis is the observed pass, not persisted synthetic rows.

## Lessons / hazards (for the next sessions)
- **The A/V Room page slug is `canonical_id` (70985), not the league UUID.** The first proof run 404'd
  because the page URL used the UUID; `getLeague([id])` keys on `canonical_id`. The caption ROUTE keys on
  the media UUID (resolves the league from the entry), so the data layer passed while the page 404'd -
  the same member-keyed hazard the brief flagged.
- **`next build` type-checks `scripts/`.** A `[...Map]` spread in the proof harness compiled locally
  (`tsc --noEmit`) but failed `next build` (downlevelIteration). Use `Array.from(map)`. Local
  `npm run build` only catches this if run AFTER the script is added.
- **GRANT-precedes-capture is route-enforced, not RLS-enforced** (mirrors L.1): the RLS gates ownership +
  append-only; the route records the grant as step 1. A determined member with direct PostgREST access
  could insert a caption into their own league's item without the grant. A grant-at-RLS trigger reading
  `member_consent_current` is deferred, not in ratified scope.
- **No member-facing REVOKE route for `media_caption` yet** (same as L.1's `oral_history_testimony`): the
  `consent/events` route's CATEGORIES list does not include it, so the grant is recorded by the capture
  route and a member revoke is a direct member-authored insert. A member revoke CONTROL (UI + a
  governed-testimony-category revoke path) is a thin display-adjacent follow-up.

## Out of scope / deferred (registered, not built)
- **MARGINALIA successor** (the W.1 successor increment): communal multi-author annotation, "annotate
  another member's item," all still no reaction/engagement counts (D-W1I2-2; spec 9.1).
- **Self-tag** (member_identification self-application - a FACT-layer act); the **L.1 display successor**
  (renders L.1 testimony, not media captions); **W.2/W.3/W.5-taxonomy** overflow.
- A member **revoke control** for `media_caption`; a caption **reinstatement** path; a member-requested
  caption-withdrawal INSERT path (the commissioner-honor path exists via the reused table).
- **Discoverability:** the composer ships in-room; no separate nav. Display read (5.3) is
  league-authenticated by ratified choice; the revision-point (spec 8) evaluates whether room-read proved
  too open.

## Engine STATE.md
Per the founder's instruction this session, the engine `docs/STATE.md` discharge line (docket item 4 ->
DISCHARGED) is drafted founder-side from the merge hash `b653c9c` + the probe results above; the engine
commit is NOT made by this frontend session.

**State at discharge:** frontend main `b653c9c` (W.1 Inc 2 DISCHARGED); prod `qcaxemuydxlzpzgnnnoa` at
024, `caption_separation_probe` all-true; governance 147/0.
