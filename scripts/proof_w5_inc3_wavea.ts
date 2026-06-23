// scripts/proof_w5_inc3_wavea.ts
// W.5 Inc 3 Wave A acceptance proof. INDEPENDENTLY recomputes the 8 reads from
// franchise_season_records (service role, not the app lib) and asserts the rendered Trophy Room page
// shows them: #2 Bridesmaid Bouquet, #5 The Sieve (graceful on points_against), #8 The Climb,
// #10 The Banner, #11 The Engine, #32 Inaugural Champion, #34 Back-to-Back (list), #35 The Perfect
// Storm (list). Read-only.
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsT = ws as any;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.PROOF_BASE ?? 'http://localhost:3944';
const LEAGUE_ID = '00000000-0000-0000-0000-000000000001';
const SLUG = '70985';
const svc = createClient(URL, SERVICE, { realtime: { transport: wsT } });
let failures = 0;
const ok = (m: string) => console.log(`  OK   ${m}`);
const bad = (m: string) => { console.log(`  FAIL ${m}`); failures++; };
const pct = (w: number, l: number, t: number) => (w + l + t > 0 ? w / (w + l + t) : null);

type Row = { franchise_id: string; season: number; wins: number; losses: number; ties: number; points_for: number; points_against: number | null; result: string };

async function main() {
  console.log('\n=== W.5 Inc 3 Wave A acceptance proof (league', SLUG + ') ===');
  const { data: rows } = (await svc.from('franchise_season_records')
    .select('franchise_id, season, wins, losses, ties, points_for, points_against, result')
    .eq('league_id', LEAGUE_ID)) as { data: Row[] | null };
  if (!rows || rows.length === 0) { bad('no rows'); process.exit(1); }
  const fids = Array.from(new Set(rows.map((r) => r.franchise_id)));
  const { data: frs } = (await svc.from('franchises').select('id, canonical_franchise_id, owner_display_name').in('id', fids)) as { data: { id: string; canonical_franchise_id: string; owner_display_name: string }[] | null };
  const canon = new Map((frs ?? []).map((f) => [f.id, f.canonical_franchise_id]));
  const cur = new Map((frs ?? []).map((f) => [f.id, f.owner_display_name]));
  const { data: sn } = (await svc.from('franchise_season_names').select('canonical_franchise_id, season, team_name').eq('league_id', LEAGUE_ID)) as { data: { canonical_franchise_id: string; season: number; team_name: string }[] | null };
  const eraK = new Map((sn ?? []).map((r) => [`${r.canonical_franchise_id}:${r.season}`, r.team_name]));
  const era = (fid: string, s: number) => eraK.get(`${canon.get(fid)}:${s}`) ?? cur.get(fid) ?? '';

  const seasons = Array.from(new Set(rows.map((r) => r.season))).sort((a, b) => a - b);
  const latest = seasons[seasons.length - 1], prior = seasons[seasons.length - 2];
  const sr = (s: number) => rows.filter((r) => r.season === s);
  const maxBy = (s: number, m: (r: Row) => number | null) => { let best = -Infinity, fids: string[] = []; for (const r of sr(s)) { const v = m(r); if (v == null) continue; if (v > best) { best = v; fids = [r.franchise_id]; } else if (v === best) fids.push(r.franchise_id); } return { best, fids }; };
  const hasPA = rows.every((r) => r.points_against != null);

  // recompute
  const bb = sr(latest).filter((r) => r.result === 'RUNNER_UP').map((r) => era(r.franchise_id, latest));
  const sieve = hasPA ? maxBy(latest, (r) => r.points_against) : null;
  const banner = maxBy(latest, (r) => pct(r.wins, r.losses, r.ties));
  const engine = maxBy(latest, (r) => r.points_for);
  // climb
  const cp = new Map(sr(latest).map((r) => [r.franchise_id, pct(r.wins, r.losses, r.ties)]));
  const pp = new Map(sr(prior).map((r) => [r.franchise_id, pct(r.wins, r.losses, r.ties)]));
  let climbBest = -Infinity, climbFids: string[] = [];
  for (const [f, c] of Array.from(cp)) { const p = pp.get(f); if (c != null && p != null) { const d = c - p; if (d > climbBest) { climbBest = d; climbFids = [f]; } else if (Math.abs(d - climbBest) < 1e-9) climbFids.push(f); } }
  const inaug = rows.filter((r) => r.result === 'CHAMPION' && r.season === 2010).map((r) => era(r.franchise_id, 2010));
  const champ = new Map(rows.filter((r) => r.result === 'CHAMPION').map((r) => [r.season, r.franchise_id]));
  const b2b: string[] = []; for (const s of seasons) { const a = champ.get(s); if (a && a === champ.get(s + 1)) b2b.push(`${s}-${s + 1}`); }
  const storm = rows.filter((r) => r.wins === 0).map((r) => `${r.season}`);

  console.log('  recompute:');
  console.log('   #2 Bridesmaid ->', bb.join(' & '), `(${latest})`);
  console.log('   #5 Sieve ->', sieve ? sieve.fids.map((f) => era(f, latest)).join(' & ') + ` (${sieve.best})` : '(not lit - points_against absent/null)');
  console.log('   #8 Climb ->', climbFids.map((f) => era(f, latest)).join(' & '), `(${climbBest.toFixed(3)})`);
  console.log('   #10 Banner ->', banner.fids.map((f) => era(f, latest)).join(' & '), `(${banner.best.toFixed(3)})`);
  console.log('   #11 Engine ->', engine.fids.map((f) => era(f, latest)).join(' & '), `(${engine.best})`);
  console.log('   #32 Inaugural ->', inaug.join(' & '), '(2010)');
  console.log('   #34 Back-to-Back ->', b2b.join(', ') || '(none)');
  console.log('   #35 Perfect Storm ->', storm.length, 'winless seasons');

  const html = await (await fetch(`${BASE}/league/${SLUG}/trophy-room`)).text();
  console.log('\n  page assertions:');
  const checks: [string, boolean][] = [
    ['Annual Awards section', html.includes('Annual Awards')],
    ['Permanent Records section', html.includes('Permanent Records')],
    ['#2 Bridesmaid card + holder', html.includes('The Bridesmaid Bouquet') && bb.every((n) => html.includes(n))],
    ['#8 The Climb card + holder', html.includes('The Climb') && climbFids.every((f) => html.includes(era(f, latest)))],
    ['#10 The Banner card + holder', html.includes('The Banner') && banner.fids.every((f) => html.includes(era(f, latest)))],
    ['#11 The Engine card + holder', html.includes('The Engine') && engine.fids.every((f) => html.includes(era(f, latest)))],
    ['#32 Inaugural Champion card + holder', html.includes('The Inaugural Champion') && inaug.every((n) => html.includes(n))],
    ['#34 Back-to-Back card', html.includes('Back-to-Back')],
    ['#35 The Perfect Storm card', html.includes('The Perfect Storm')],
    ['Docket IDs TR-LRC-2/10/11/32/34/35', ['TR-LRC-2-', 'TR-LRC-10-', 'TR-LRC-11-', 'TR-LRC-32-2010', 'TR-LRC-34', 'TR-LRC-35'].every((d) => html.includes(d))],
    ['CANONICAL trust label present', html.includes('ENTERED INTO THE RECORD')],
  ];
  if (hasPA) checks.push(['#5 The Sieve LIT + holder', html.includes('The Sieve') && !!sieve && sieve.fids.every((f) => html.includes(era(f, latest)))]);
  else checks.push(['#5 The Sieve silent (points_against not populated)', !html.includes('The Sieve')]);
  // Back-to-Back spans rendered (if any)
  if (b2b.length) checks.push(['#34 spans rendered', b2b.every((s) => html.includes(s))]);
  // Perfect Storm: a couple of winless seasons rendered
  if (storm.length) checks.push(['#35 winless entries rendered', storm.slice(0, 2).every((s) => html.includes(`(${s})`))]);
  checks.forEach(([label, passed]) => passed ? ok(label) : bad(label));

  console.log('\n=== Result:', failures === 0 ? 'ALL ACCEPTANCE CRITERIA MET' : `${failures} FAILURE(S)`, '===');
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error('proof error:', e); process.exit(1); });
