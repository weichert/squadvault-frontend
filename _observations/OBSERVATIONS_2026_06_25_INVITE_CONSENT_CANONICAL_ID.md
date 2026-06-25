# OBSERVATIONS 2026-06-25 - invite consent-redirect uses canonical_id, not the leagues UUID

**Lane:** EXECUTE. **Frontend:** from `ac56326`. **Repo:** frontend ONLY. **Pairs with Bug B**
(#43/#44): without this, an invited member authenticates via the new callback, then 404s at the
consent landing - looks like a login failure, isn't. Pre-Draft-Weekend.

## The defect (code-certain)
`src/app/api/members/invite/route.ts:102` built the post-auth destination from the UUID:
`const leagueRedirect = ` + "`/league/${franchise.league_id}/consent`" + `. `franchise.league_id`
is `uuid REFERENCES leagues(id)` (001_core_schema). But every `/league/[id]/...` route resolves
`[id]` through `getLeague`, which keys on **canonical_id** (`src/lib/league.ts:43`,
`.eq("canonical_id", canonicalId)`). The consent page authenticates FIRST
(`consent/page.tsx:44`) then `getLeague(id)` -> `notFound()` on null (46-47). So the invited
member verified successfully, got redirected to `/league/<UUID>/consent`, which resolved no league
-> 404. Confirmed against live data: league 70985's UUID is
`00000000-0000-0000-0000-000000000001`, so the old redirect produced
`/league/00000000-0000-0000-0000-000000000001/consent`.

## The fix
After the franchise fetch, resolve canonical_id from the UUID FK via the `admin` client and build
the redirect from it:
```
const { data: leagueRow } = (await admin.from('leagues').select('canonical_id')
  .eq('id', franchise.league_id).maybeSingle()) as { data: { canonical_id: string } | null };
if (!leagueRow?.canonical_id) return NextResponse.json({ error: 'League not found.' }, { status: 404 });
const leagueRedirect = `/league/${leagueRow.canonical_id}/consent`;
```
Everything downstream is unchanged: the `redirectTo` wrapper still encodes `leagueRedirect`,
`safeRedirectPath` unwraps it, and the consent route now resolves `70985`. **Only the URL needed
the canonical id** - every DB write in the route (the commissioner check, the
`franchise_member_links` insert, the `franchises.member_user_id` pointer) correctly KEEPS using
`franchise.league_id` (the UUID FK). UUID for FKs, canonical_id for URLs.

## Scope check (single isolated defect, not a class)
`grep -rn '/league/\$' src/` - line 102 was the ONLY `/league/${...}` construction sourcing a UUID.
Every other site uses the route param `id`, an explicit `canonicalId`, `league.canonical_id`, or a
`leagueId` already threaded down as canonical (top-nav, office, archive, members, manifest, founding
flows, consent's own login-redirect). No sibling fixes needed.

## Proof
- `scripts/proof_invite_consent_canonical_id.ts` (read-only against live data, `npx tsx`) **9/9**:
  leagues.id is a UUID distinct from canonical_id; franchise.league_id IS that UUID (what the bug
  leaked); the new lookup maps it back to `70985`; the constructed redirect is
  `/league/70985/consent` (not the UUID) and its path segment is not a UUID.
- `npm run type-check` clean (scripts/ included); `npm run build` green.
- Governance NOT in scope (no data model / RLS / write-path change - a read + a URL string).

## End-to-end (founder-run, the real confirmation)
The Bug B cross-device test (invited member, different device) now lands on the consent page rather
than a 404 - once the founder applies the token_hash templates with `&redirect={{ .RedirectTo }}`
(the #44 carry-through). This fix and that template change together complete the invite flow.

## Guardrails
Correctness fix to one URL construction. No data-model / RLS / linkage change. UUID FKs untouched.
Engine repo untouched.
