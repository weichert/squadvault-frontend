// scripts/proof_invite_consent_canonical_id.ts
// Proof for the invite consent-redirect fix: /api/members/invite must land an invited member
// on /league/<canonical_id>/consent, NOT /league/<UUID>/consent. The /league/[id] routes
// resolve [id] via getLeague -> leagues.canonical_id, but franchise.league_id is the UUID FK,
// so the redirect needs the canonical id or the member 404s after authenticating.
// Read-only against live data (no mutation). Run: npx tsx scripts/proof_invite_consent_canonical_id.ts
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsT = ws as any;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CANONICAL = '70985'; // PFL Buddies - the real league
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const svc = createClient(URL, SERVICE, { realtime: { transport: wsT } });
let fail = 0;
const ok = (c: boolean, m: string) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) fail++; };

async function main() {
  console.log('\n=== invite consent-redirect uses canonical_id, not UUID ===');

  // The league's UUID (what franchise.league_id holds) vs its canonical_id (what routes key on).
  const { data: league } = await svc
    .from('leagues').select('id, canonical_id').eq('canonical_id', CANONICAL).maybeSingle() as
    { data: { id: string; canonical_id: string } | null };
  ok(!!league, `league ${CANONICAL} resolves`);
  if (!league) { console.log(`\n${fail} FAILED`); process.exit(1); }
  ok(UUID_RE.test(league.id), `leagues.id is a UUID (${league.id})`);
  ok(league.id !== league.canonical_id, 'UUID and canonical_id are distinct (the whole point)');

  // A franchise in that league: its league_id is the UUID FK (the value the buggy code used).
  const { data: franchise } = await svc
    .from('franchises').select('id, league_id').eq('league_id', league.id).limit(1).maybeSingle() as
    { data: { id: string; league_id: string } | null };
  ok(!!franchise, 'a franchise exists in the league');
  if (!franchise) { console.log(`\n${fail} FAILED`); process.exit(1); }
  ok(franchise.league_id === league.id && UUID_RE.test(franchise.league_id),
    'franchise.league_id IS the UUID (what the old redirect leaked into the URL)');

  // The route's new lookup: resolve canonical_id from the UUID FK.
  const { data: leagueRow } = await svc
    .from('leagues').select('canonical_id').eq('id', franchise.league_id).maybeSingle() as
    { data: { canonical_id: string } | null };
  ok(leagueRow?.canonical_id === CANONICAL, `lookup maps the UUID FK back to canonical_id ${CANONICAL}`);

  // The constructed redirect: canonical (routes resolve it) vs the old UUID form (404s).
  const fixed = `/league/${leagueRow?.canonical_id}/consent`;
  const buggy = `/league/${franchise.league_id}/consent`;
  ok(fixed === `/league/${CANONICAL}/consent`, `redirect is ${fixed}`);
  ok(fixed !== buggy, 'fixed redirect differs from the old UUID redirect');
  ok(!UUID_RE.test(fixed.split('/')[2]), 'redirect path segment is NOT a UUID');

  console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('proof error:', e); process.exit(1); });
