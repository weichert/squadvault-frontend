// scripts/proof_w5_inc3_waveb1.ts
// W.5 Inc 3 Wave B1 acceptance proof. INDEPENDENTLY recomputes the 3 weekly-score-derived awards
// from season_award_winners (service role, separate code path) and asserts the rendered Trophy Room
// page shows them: #4 The Cannon (all-time max single-week score), #12 The Black Rose (all-time max
// losing score), #33 The One-Point Club (winners of championships decided by margin < 2). Read-only.
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsT = ws as any;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.PROOF_BASE ?? 'http://localhost:3945';
const LEAGUE_ID = '00000000-0000-0000-0000-000000000001';
const SLUG = '70985';
const svc = createClient(URL, SERVICE, { realtime: { transport: wsT } });
let failures = 0;
const ok = (m: string) => console.log(`  OK   ${m}`);
const bad = (m: string) => { console.log(`  FAIL ${m}`); failures++; };

type Saw = { award_id: string; season: number; franchise_id: string; value: number | null };

async function main() {
  console.log('\n=== W.5 Inc 3 Wave B1 acceptance proof (league', SLUG + ') ===');
  const { data: saw, error } = (await svc.from('season_award_winners').select('award_id, season, franchise_id, value').eq('league_id', LEAGUE_ID)) as { data: Saw[] | null; error: unknown };
  if (error || !saw || saw.length === 0) { bad(`season_award_winners empty/absent (apply migration 028 + seed 004 first): ${JSON.stringify(error)}`); process.exit(1); }

  // era-name resolution keyed by canonical code
  const { data: sn } = (await svc.from('franchise_season_names').select('canonical_franchise_id, season, team_name').eq('league_id', LEAGUE_ID)) as { data: { canonical_franchise_id: string; season: number; team_name: string }[] | null };
  const eraK = new Map((sn ?? []).map((r) => [`${r.canonical_franchise_id}:${r.season}`, r.team_name]));
  const { data: fr } = (await svc.from('franchises').select('canonical_franchise_id, owner_display_name').eq('league_id', LEAGUE_ID)) as { data: { canonical_franchise_id: string; owner_display_name: string }[] | null };
  const curByCanon = new Map((fr ?? []).map((f) => [f.canonical_franchise_id, f.owner_display_name]));
  const era = (canon: string, s: number) => eraK.get(`${canon}:${s}`) ?? curByCanon.get(canon) ?? '';

  const maxAward = (a: string) => { const aw = saw.filter((r) => r.award_id === a && r.value != null); const best = Math.max(...aw.map((r) => r.value as number)); return { best, rows: aw.filter((r) => r.value === best) }; };
  const cannon = maxAward('4'), rose = maxAward('12');
  const opc = saw.filter((r) => r.award_id === '33').sort((a, b) => b.season - a.season);

  console.log('  recompute (from season_award_winners):');
  console.log('   #4 Cannon ->', cannon.rows.map((r) => `${era(r.franchise_id, r.season)} ${r.season}`).join(' & '), `(${cannon.best})`);
  console.log('   #12 Black Rose ->', rose.rows.map((r) => `${era(r.franchise_id, r.season)} ${r.season}`).join(' & '), `(${rose.best})`);
  console.log('   #33 One-Point Club ->', opc.map((r) => `${era(r.franchise_id, r.season)} ${r.season} (by ${r.value})`).join(', '));

  const html = await (await fetch(`${BASE}/league/${SLUG}/trophy-room`)).text();
  console.log('\n  page assertions:');
  const checks: [string, boolean][] = [
    ['#4 The Cannon card + holder', html.includes('The Cannon') && cannon.rows.every((r) => html.includes(era(r.franchise_id, r.season)))],
    ['#4 Cannon value rendered', html.includes(`${cannon.best} points`)],
    ['#12 The Black Rose card + holder', html.includes('The Black Rose') && rose.rows.every((r) => html.includes(era(r.franchise_id, r.season)))],
    ['#33 The One-Point Club card', html.includes('The One-Point Club')],
    ['#33 each member season rendered', opc.every((r) => html.includes(`(${r.season})`))],
    ['Docket IDs TR-LRC-4/12/33', ['TR-LRC-4', 'TR-LRC-12', 'TR-LRC-33'].every((d) => html.includes(d))],
    ['CANONICAL trust label present', html.includes('ENTERED INTO THE RECORD')],
    ['Wave A intact (The Climb still present)', html.includes('The Climb')],
  ];
  // Cross-check against the engine generator's verified facts.
  checks.push(['Cannon = 0002 (Paradis 2024) = 198.8', cannon.best === 198.8 && cannon.rows.length === 1 && cannon.rows[0].franchise_id === '0002' && cannon.rows[0].season === 2024]);
  checks.push(['Black Rose = 0009 (2019) = 174.5', rose.best === 174.5 && rose.rows.some((r) => r.franchise_id === '0009' && r.season === 2019)]);
  checks.push(['One-Point Club = {2013:0009, 2019:0002}', opc.length === 2 && opc.some((r) => r.season === 2013 && r.franchise_id === '0009') && opc.some((r) => r.season === 2019 && r.franchise_id === '0002')]);
  checks.forEach(([label, passed]) => passed ? ok(label) : bad(label));

  console.log('\n=== Result:', failures === 0 ? 'ALL ACCEPTANCE CRITERIA MET' : `${failures} FAILURE(S)`, '===');
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error('proof error:', e); process.exit(1); });
