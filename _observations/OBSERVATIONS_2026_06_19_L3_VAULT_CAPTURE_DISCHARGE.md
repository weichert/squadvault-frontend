# L.3 The Vault - capture slice build + DISCHARGE (2026-06-19)

EXECUTE session (Opus 4.8), frontend repo. Docket item 2 (L.3) capture slice, built
against the ratified spec (engine `fee0725`, acceptance sections 5 + 6) and the build
brief. Outcome: **capture slice DISCHARGED**; reveal half deferred (season-end successor).

Merge `4835c26` (PR #24); build commit `f0d2b04` on `main`.

## What shipped

- **Migration 017 `sealed_testimony_consent`** (founder-applied, charter section 7
  consent-infra escalation): widened the `member_consent_events` category CHECK to add
  `sealed_testimony`. Biconditional class-iff-synth CHECK untouched; no column/policy
  change; `member_consent_current` picks the category up free.
- **Migration 018 `vault_sealed_letters`** (founder-applied): the two-table seal
  (founder-ratified mechanism 2026-06-19). `vault_sealed_letters` = readable metadata
  (existence + `sealed_at`, author/admin SELECT, author-only INSERT, no UPDATE/DELETE).
  `vault_sealed_letter_bodies` = the body behind **NO SELECT policy** (the seal: default-
  deny, no role reads it pre-reveal), author-only INSERT, no UPDATE/DELETE. Plus
  `vault_seal_probe()`, a SECURITY DEFINER read-only helper returning booleans about the
  body table's existence + policy shape (no body access) so G22 can prove the seal.
- **`POST /api/vault/seal`**: member-only (member_user_id from `auth.uid()`, never the
  body; no commissioner/admin proxy). Order is constitutional: consent GRANT, then
  metadata, then body.
- **`/league/[id]/vault`** compose/seal surface (franchise-linked member only; client-side
  draft autosave; inline consent affirmation; confirmed irreversible seal) + the
  `vault-compose-panel` client component.
- **G22** seal-fails-closed probe; consent-panel history label for `sealed_testimony`.

## Acceptance (all five met)

1. G22 green on prod-shaped RLS; full governance suite **135/0**.
2. `017` + `018` confirmed LIVE on prod `qcaxemuydxlzpzgnnnoa` (object + `vault_seal_probe`
   probe: `body_has_read_policy=false`, `body_has_insert_policy=true`, both tables present).
3. A real franchise-linked member (`swickywick@yahoo.com`, "Weichert's Warmongers")
   composed -> granted `sealed_testimony` -> sealed a 2026 letter end-to-end. The consent
   GRANT (`context=vault_seal`) recorded at `05:38:49.83`, the seal at `05:38:50.08` -
   consent precedes seal (spec 5.4) by construction and in the live timestamps.
4. No path reads a sealed body: G22 structural (no SELECT/ALL policy -> author, commissioner,
   admin all denied) + anon behavioral on the real seeded row (0 rows). The body is readable
   only via the service role, which bypasses RLS and is the verification channel, not an app
   path.
5. `type-check` clean; `test:governance` green.

The first real Vault entry (letter `a024f516`, swickywick, season 2026) was left in place -
a genuine sealed letter, not test scaffolding. Remove via service role only if the founder
wants the slate clean.

## W.6 section-7.2-style consent declaration (this build)

- **Category touched:** `sealed_testimony` (new, migration 017).
- **Gate that GRANTS it:** the seal surface / `POST /api/vault/seal`, member-authored only,
  at the moment of sealing (consent-at-writing). No commissioner/admin proxy.
- **Gate that READS/consumes it:** NONE in this slice. Capture-only; the reveal unit
  (season-end) is the future consumer. The grant is inert-but-real until then.
- **Scope of the grant:** in-ceremony reveal ONLY (D-SEQ-6, held in-ceremony-only). The
  narrowing is definitional (route copy + this declaration), not a schema column.
  Republication beyond the ceremony is a distinct future consent act, adjudicated at the
  reveal/republication build, never inherited from this capture grant.
- **Revocability:** member-authored REVOKE before reveal withholds the letter from reveal;
  it never deletes or rewrites the sealed record (invariant 6). Append-only throughout.

## Lessons / hazards surfaced (for the next sessions)

- **Paste fragmentation is real on long SQL.** The first 018 apply failed because the SQL
  arrived mangled in the editor (words concatenated, chunks dropped). Fix that worked:
  `cat <abs-path-to-migration> | pbcopy` then paste - copy the verified on-disk file, never
  hand-copy long SQL through chat. (The brief flagged this hazard; confirmed live.)
- **Canonical-id vs UUID in `/league/[id]/*` URLs.** The route `[id]` param is the league's
  `canonical_id` (PFL Buddies = `70985`), NOT the UUID `00000000-...-001`. `getLeague`
  matches `canonical_id`; using the UUID 404s. The brief/spec "League UUID ...001" is the
  internal `id`; URLs use the slug. (Cost a 404 detour this session.)
- **`franchises` is RLS-gated; resolve linkage via the admin client.** The vault page first
  used the SSR (RLS-scoped) client to read `franchises` and showed "not linked" even for the
  real member. Fixed to use the admin client for the linkage read (the seal route already did
  this). Pattern: franchises reads to ANSWER a question go through admin.
- **`pg_policies` is NOT reachable via PostgREST** (PGRST205). G3's policy query therefore
  passes vacuously today (a latent false-pass in the existing suite, like the G11 class). G22
  routes its structural proof through the `vault_seal_probe()` SECURITY DEFINER helper to
  avoid inheriting that. A migration-parity / policy-introspection gate is a Track-E candidate
  (already parked in the brief).
- **Prod-parity standing check PASSED** before building: `member_consent_events`,
  `member_consent_current`, `franchise_member_links` all live; the two new objects correctly
  absent. (Use `.select().limit(1)`, not `head:true` count - the head form swallows PGRST205
  and false-reports "live".)

## Out of scope / deferred (registered, not built)

- The L.3 **reveal unit**: reveal ceremony page, letter-vs-ledger juxtaposition artifact
  (engine, via the W.4 reveal-artifact docket), the scheduled-reveal job / readability flip,
  and any republication-scope consent beyond the in-ceremony grant. Season-end, pairs with L.5.
- Bug B (`/auth/callback` PKCE-vs-implicit) - still a separate flagged unit; did not block
  member browsing here (session established client-side; the SSR vault page read it fine).

## Next session input

Docket: E2.3 DISCHARGED -> L.3 capture DISCHARGED (this) -> L.1 first wave (Aug sweep, D-N)
-> W.1 Inc 2. Docket item 2 (L.3) stays in-flight only for its reveal successor (season-end);
the capture obligation for the 08-15 draft is met. Founder call at close: advance to item 3
(L.1), or hold.
