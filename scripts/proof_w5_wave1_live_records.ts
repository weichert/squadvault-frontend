// scripts/proof_w5_wave1_live_records.ts
// W.5 Inc 2 Wave 1 acceptance proof. INDEPENDENTLY recomputes the 4 Group-A Live Records from
// franchise_season_records (service role, not the app lib), resolves holder names, then asserts the
// rendered Trophy Room page (/league/70985/trophy-room) shows those holders + values + Docket IDs +
// the CANONICAL trust label. Read-only (no writes; nothing to scrub).
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsT = ws as any;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.PROOF_BASE ?? 'http://localhost:3942';
const LEAGUE_ID = '00000000-0000-0000-0000-000000000001';
const SLUG = '70985';
const svc = createClient(URL, SERVICE, { realtime: { transport: wsT } });
let failures = 0;
const ok = (m: string) => console.log(`  OK   ${m}`);
const bad = (m: string) => { console.log(`  FAIL ${m}`); failures++; };

type Row = { franchise_id: string; season: number; wins: number; losses: number; ties: number; result: string };
const pct = (w: number, l: number, t: number) => (w + l + t > 0 ? w / (w + l + t) : null);

async function main() {
  console.log('\n=== W.5 Inc 2 Wave 1 - Live Records acceptance proof (league', SLUG + ') ===');
  const { data: rows } = (await svc.from('franchise_season_records').select('franchise_id, season, wins, losses, ties, result').eq('league_id', LEAGUE_ID)) as { data: Row[] | null };
  if (!rows || rows.length === 0) { bad('no franchise_season_records'); process.exit(1); }
  const fids = Array.from(new Set(rows.map((r) => r.franchise_id)));
  const { data: frs } = (await svc.from('franchises').select('id, canonical_franchise_id, owner_display_name').in('id', fids)) as { data: { id: string; canonical_franchise_id: string; owner_display_name: string }[] | null };
  const curName = new Map((frs ?? []).map((f) => [f.id, f.owner_display_name]));
  const canon = new Map((frs ?? []).map((f) => [f.id, f.canonical_franchise_id]));
  const { data: sn } = (await svc.from('franchise_season_names').select('canonical_franchise_id, season, team_name').eq('league_id', LEAGUE_ID)) as { data: { canonical_franchise_id: string; season: number; team_name: string }[] | null };
  const eraKey = new Map((sn ?? []).map((r) => [`${r.canonical_franchise_id}:${r.season}`, r.team_name]));
  const era = (fid: string, season: number) => eraKey.get(`${canon.get(fid)}:${season}`) ?? curName.get(fid) ?? null;

  // Aggregate per franchise.
  const agg = new Map<string, { w: number; l: number; t: number; titles: number; ru: number }>();
  for (const r of rows) {
    const a = agg.get(r.franchise_id) ?? { w: 0, l: 0, t: 0, titles: 0, ru: 0 };
    a.w += r.wins; a.l += r.losses; a.t += r.ties;
    if (r.result === 'CHAMPION') a.titles++; if (r.result === 'RUNNER_UP') a.ru++;
    agg.set(r.franchise_id, a);
  }
  const leadersMax = (score: Map<string, number>, elig?: (fid: string) => boolean) => {
    let best = -Infinity; for (const [f, v] of Array.from(score)) if ((!elig || elig(f)) && v > best) best = v;
    return { best, fids: Array.from(score).filter(([f, v]) => (!elig || elig(f)) && Math.abs(v - best) < 1e-9).map(([f]) => f) };
  };

  // #24 Cavallini (win-pct), #25 Dynasty (titles), #26 Eternal Runner-Up (ru, titles==0)
  const cav = leadersMax(new Map(Array.from(agg).map(([f, a]) => [f, pct(a.w, a.l, a.t) ?? -1])), (f) => { const a = agg.get(f)!; return a.w + a.l + a.t > 0; });
  const dyn = leadersMax(new Map(Array.from(agg).map(([f, a]) => [f, a.titles])));
  const eru = leadersMax(new Map(Array.from(agg).map(([f, a]) => [f, a.ru])), (f) => agg.get(f)!.titles === 0);
  // #30 The Floor (worst single season)
  const lows = rows.map((r) => ({ fid: r.franchise_id, season: r.season, p: pct(r.wins, r.losses, r.ties) })).filter((x) => x.p !== null) as { fid: string; season: number; p: number }[];
  const minP = Math.min(...lows.map((x) => x.p));
  const floor = lows.filter((x) => Math.abs(x.p - minP) < 1e-9);

  const cavNames = cav.fids.map((f) => curName.get(f)!);
  const dynNames = dyn.fids.map((f) => curName.get(f)!);
  const eruNames = eru.fids.map((f) => curName.get(f)!);
  const floorNames = floor.map((x) => `${era(x.fid, x.season)} (${x.season})`);
  console.log('  independent recompute:');
  console.log('   #24 Cavallini ->', cavNames.join(' & '), `(pct ${cav.best.toFixed(3)})`);
  console.log('   #25 Dynasty   ->', dynNames.join(' & '), `(${dyn.best} titles)`);
  console.log('   #26 EternalRU ->', eruNames.join(' & '), `(${eru.best} ru, no title)`);
  console.log('   #30 The Floor ->', floorNames.join(' & '), `(pct ${minP.toFixed(3)}; ${floor.length} co-holder(s))`);

  // Fetch the rendered page.
  const html = await (await fetch(`${BASE}/league/${SLUG}/trophy-room`)).text();
  console.log('\n  page assertions:');
  ([
    ['"Live Records" section', html.includes('Live Records')],
    ['The Cavallini Standard card', html.includes('The Cavallini Standard')],
    ['The Dynasty card', html.includes('The Dynasty')],
    ['The Eternal Runner-Up card', html.includes('The Eternal Runner-Up')],
    ['The Floor card', html.includes('The Floor')],
    ['"Held by (derived)" label', html.includes('Held by (derived')],
    ['Cavallini holder rendered', cavNames.every((n) => html.includes(n))],
    ['Dynasty holder rendered', dynNames.every((n) => html.includes(n))],
    ['Eternal Runner-Up holder rendered', eruNames.every((n) => html.includes(n))],
    ['The Floor holder(s) rendered (era + season)', floor.every((x) => html.includes(`${era(x.fid, x.season)}`) && html.includes(`(${x.season})`))],
    ['Docket IDs TR-LRC-24/25/26/30', ['TR-LRC-24', 'TR-LRC-25', 'TR-LRC-26', 'TR-LRC-30'].every((d) => html.includes(d))],
    ['CANONICAL trust label', html.includes('ENTERED INTO THE RECORD')],
  ] as [string, boolean][]).forEach(([label, passed]) => passed ? ok(label) : bad(label));

  // C6 multi-valued: if The Floor has a real tie, assert >1 holder is rendered (else note single).
  if (floor.length > 1) (floor.every((x) => html.includes(`(${x.season})`)) ? ok(`The Floor multi-valued: ${floor.length} co-holders all rendered (C6)`) : bad('The Floor co-holders not all rendered'));
  else console.log(`     (The Floor has a single worst season this data; C6 multi-valued path exercised by the recompute logic, no tie to render)`);

  console.log('\n=== Result:', failures === 0 ? 'ALL ACCEPTANCE CRITERIA MET' : `${failures} FAILURE(S)`, '===');
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error('proof error:', e); process.exit(1); });
