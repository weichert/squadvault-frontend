// scripts/proof_w5_wave2_live_records.ts
// W.5 Inc 2 Wave 2 acceptance proof. INDEPENDENTLY recomputes the 2 Group-B Live Records from
// franchise_season_records (service role, not the app lib), then asserts the rendered Trophy Room
// page shows them. Read-only.
//   #27 The Executioner = max sum(blowout_wins_60), all games.
//   #28 The Iron Curtain = min sum(points_against)/sum(regular-season games), regular season.
//       regular-season games = (w+l+t) - (result in CHAMPION/RUNNER_UP ? 1 : 0).
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsT = ws as any;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.PROOF_BASE ?? 'http://localhost:3943';
const LEAGUE_ID = '00000000-0000-0000-0000-000000000001';
const SLUG = '70985';
const svc = createClient(URL, SERVICE, { realtime: { transport: wsT } });
let failures = 0;
const ok = (m: string) => console.log(`  OK   ${m}`);
const bad = (m: string) => { console.log(`  FAIL ${m}`); failures++; };

type Row = { franchise_id: string; season: number; wins: number; losses: number; ties: number; result: string; points_against: number | null; blowout_wins_60: number | null };

async function main() {
  console.log('\n=== W.5 Inc 2 Wave 2 - Iron Curtain + Executioner acceptance proof (league', SLUG + ') ===');
  const { data: rows } = (await svc.from('franchise_season_records')
    .select('franchise_id, season, wins, losses, ties, result, points_against, blowout_wins_60')
    .eq('league_id', LEAGUE_ID)) as { data: Row[] | null };
  if (!rows || rows.length === 0) { bad('no rows'); process.exit(1); }
  const fids = Array.from(new Set(rows.map((r) => r.franchise_id)));
  const { data: frs } = (await svc.from('franchises').select('id, owner_display_name').in('id', fids)) as { data: { id: string; owner_display_name: string }[] | null };
  const name = new Map((frs ?? []).map((f) => [f.id, f.owner_display_name]));

  // aggregate
  const bw = new Map<string, number>(); const pa = new Map<string, number>(); const reg = new Map<string, number>();
  for (const r of rows) {
    bw.set(r.franchise_id, (bw.get(r.franchise_id) ?? 0) + (r.blowout_wins_60 ?? 0));
    pa.set(r.franchise_id, (pa.get(r.franchise_id) ?? 0) + (r.points_against ?? 0));
    const g = r.wins + r.losses + r.ties - (r.result === 'CHAMPION' || r.result === 'RUNNER_UP' ? 1 : 0);
    reg.set(r.franchise_id, (reg.get(r.franchise_id) ?? 0) + g);
  }
  // Executioner = max bw
  let exBest = -1; for (const v of Array.from(bw.values())) if (v > exBest) exBest = v;
  const exFids = Array.from(bw).filter(([, v]) => v === exBest).map(([f]) => f);
  // Iron Curtain = min avg
  const avg = new Map<string, number>(); for (const f of Array.from(pa.keys())) if ((reg.get(f) ?? 0) > 0) avg.set(f, pa.get(f)! / reg.get(f)!);
  let icBest = Infinity; for (const v of Array.from(avg.values())) if (v < icBest) icBest = v;
  const icFids = Array.from(avg).filter(([, v]) => Math.abs(v - icBest) < 1e-9).map(([f]) => f);

  console.log('  independent recompute:');
  console.log('   #27 Executioner ->', exFids.map((f) => name.get(f)).join(' & '), `(${exBest} blowouts 60+)`);
  console.log('   #28 Iron Curtain ->', icFids.map((f) => name.get(f)).join(' & '), `(${icBest.toFixed(1)} pts allowed/game)`);

  const html = await (await fetch(`${BASE}/league/${SLUG}/trophy-room`)).text();
  console.log('\n  page assertions:');
  ([
    ['The Executioner card', html.includes('The Executioner')],
    ['The Iron Curtain card', html.includes('The Iron Curtain')],
    ['Executioner holder rendered', exFids.every((f) => html.includes(name.get(f)!))],
    ['Iron Curtain holder rendered', icFids.every((f) => html.includes(name.get(f)!))],
    ['Docket TR-LRC-27 + TR-LRC-28', html.includes('TR-LRC-27') && html.includes('TR-LRC-28')],
    ['Executioner value (blowouts) rendered', html.includes(`${exBest} blowout`)],
    ['CANONICAL trust label', html.includes('ENTERED INTO THE RECORD')],
    ['Wave 1 still present (The Floor)', html.includes('The Floor')],
  ] as [string, boolean][]).forEach(([label, passed]) => passed ? ok(label) : bad(label));

  // Sanity vs the engine generator / probe.
  exFids.length === 1 && name.get(exFids[0])?.includes('Paradis') ? ok('Executioner = Paradis (0002), matches the generator/probe') : console.log(`     (Executioner = ${exFids.map((f) => name.get(f)).join(',')})`);
  icFids.length === 1 && name.get(icFids[0])?.includes('Cavallini') ? ok('Iron Curtain = Italian Cavallini (0009), matches the generator') : console.log(`     (Iron Curtain = ${icFids.map((f) => name.get(f)).join(',')})`);

  console.log('\n=== Result:', failures === 0 ? 'ALL ACCEPTANCE CRITERIA MET' : `${failures} FAILURE(S)`, '===');
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error('proof error:', e); process.exit(1); });
