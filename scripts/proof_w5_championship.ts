// scripts/proof_w5_championship.ts
// W.5 Championship Package acceptance proof - driven against the live ratify route + Trophy Room
// page as a real commissioner (headless-minted session; the L.1/W.1-Inc2 precedent). Proves:
// NEGATIVE (anon -> 401, member -> 403, nothing stored), POSITIVE (commissioner ratifies; derived
// holder + transfer count + chain compute, era-correct; the band renders the attested nameplate +
// Ring/League-Trophy derived reads), then scrubs. The DONE bar for the Belt path.
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import ws from 'ws';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsT = ws as any;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.PROOF_BASE ?? 'http://localhost:3940';

const LEAGUE_ID = '00000000-0000-0000-0000-000000000001';
const LEAGUE_SLUG = '70985';
const COMMISH_EMAIL = 'steven.weichert@gmail.com';
const MEMBER_EMAIL = 'swickywick@yahoo.com';

const svc = createClient(URL, SERVICE, { realtime: { transport: wsT } });
let failures = 0;
const ok = (m: string) => console.log(`  OK   ${m}`);
const bad = (m: string) => { console.log(`  FAIL ${m}`); failures++; };

async function mintCookie(email: string): Promise<string> {
  const link = await svc.auth.admin.generateLink({ type: 'magiclink', email });
  const hashed = (link.data as { properties?: { hashed_token?: string } })?.properties?.hashed_token;
  if (!hashed) throw new Error(`generateLink failed for ${email}`);
  const anon = createClient(URL, ANON, { realtime: { transport: wsT } });
  const otp = await anon.auth.verifyOtp({ token_hash: hashed, type: 'magiclink' });
  const session = otp.data.session!;
  const jar = new Map<string, string>();
  const ssr = createServerClient(URL, ANON, {
    realtime: { transport: wsT },
    cookies: { getAll: () => Array.from(jar).map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)) },
  });
  await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  return Array.from(jar).map(([n, v]) => `${n}=${v}`).join('; ');
}

async function eventCount(): Promise<number> {
  const { data } = await svc.from('trophy_custody_events').select('id').eq('league_id', LEAGUE_ID).eq('trophy_id', 'TR-CP-1') as { data: { id: string }[] | null };
  return data?.length ?? 0;
}
const post = (cookie: string | null, body: unknown) =>
  fetch(`${BASE}/api/trophy-room/custody`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });

async function main() {
  console.log('\n=== W.5 Championship Package acceptance proof (league', LEAGUE_SLUG + ') ===');
  if ((await eventCount()) !== 0) { bad('pre-state: TR-CP-1 events already exist - aborting'); process.exit(1); }

  // Two franchises in the league for a Belt transfer.
  const { data: frs } = await svc.from('franchises').select('id, owner_display_name').eq('league_id', LEAGUE_ID).order('canonical_franchise_id').limit(2) as { data: { id: string; owner_display_name: string }[] | null };
  const [a, b] = frs!;
  const commish = await mintCookie(COMMISH_EMAIL);
  const member = await mintCookie(MEMBER_EMAIL);

  console.log('\n[1] NEGATIVE - only the commissioner may ratify');
  const anonRes = await post(null, { leagueId: LEAGUE_ID, toFranchise: a.id, season: 2025 });
  if (anonRes.status === 401) ok('anon -> 401'); else bad(`anon expected 401, got ${anonRes.status}`);
  const memRes = await post(member, { leagueId: LEAGUE_ID, toFranchise: a.id, season: 2025 });
  if (memRes.status === 403) ok(`member (non-commissioner) -> 403 (${(await memRes.json()).error})`); else bad(`member expected 403, got ${memRes.status}`);
  if ((await eventCount()) === 0) ok('nothing stored by the refused attempts'); else bad('a refused attempt stored an event');

  console.log('\n[2] POSITIVE - commissioner ratifies two Belt transfers');
  const t1 = await post(commish, { leagueId: LEAGUE_ID, toFranchise: a.id, season: 2024, occasion: 'Won it outright' });
  if (t1.status === 200) ok(`transfer 1 (origin -> ${a.owner_display_name}, 2024) -> 200`); else bad(`transfer 1 expected 200, got ${t1.status}: ${JSON.stringify(await t1.json())}`);
  const t2 = await post(commish, { leagueId: LEAGUE_ID, toFranchise: b.id, fromFranchise: a.id, season: 2025, week: 9, occasion: 'Stolen at the buzzer' });
  if (t2.status === 200) ok(`transfer 2 (${a.owner_display_name} -> ${b.owner_display_name}, 2025 W9) -> 200`); else bad(`transfer 2 expected 200, got ${t2.status}: ${JSON.stringify(await t2.json())}`);

  console.log('\n[3] DERIVED holder + chain (C1: never stored)');
  const { data: ev } = await svc.from('trophy_custody_events').select('to_franchise, from_franchise, season, week, occasion').eq('league_id', LEAGUE_ID).eq('trophy_id', 'TR-CP-1').order('season', { ascending: false }) as { data: { to_franchise: string; from_franchise: string | null; season: number; week: number | null; occasion: string | null }[] | null };
  const latest = ev![0];
  if (latest.to_franchise === b.id) ok(`derived current holder = latest to_franchise = ${b.owner_display_name}`); else bad('derived holder is not the latest transfer target');
  if (ev!.length === 2) ok('transfer count (ordinal) = 2'); else bad(`expected 2 events, got ${ev!.length}`);
  if (latest.from_franchise === a.id) ok(`chain carries "taken from" = ${a.owner_display_name}`); else bad('latest event missing from_franchise');

  console.log('\n[4] The band RENDERS on the Trophy Room page (slug 70985)');
  const page = await fetch(`${BASE}/league/${LEAGUE_SLUG}/trophy-room`, { redirect: 'manual' });
  const html = await page.text();
  const checks: [string, boolean][] = [
    ['page 200', page.status === 200],
    ['"The Championship Package" band', html.includes('The Championship Package')],
    ['"The Belt" card', html.includes('The Belt')],
    ['"The Ring" card', html.includes('The Ring')],
    ['"The League Trophy" card', html.includes('The League Trophy')],
    ['attested nameplate "Phony Football League"', html.includes('Phony Football League')],
    ['Belt current holder rendered (b name present)', html.includes(b.owner_display_name)],
    ['Docket ID TR-CP-1-2025', html.includes('TR-CP-1-2025')],
    ['"Current holder (derived)" label', html.includes('Current holder (derived)')],
    ['Ring derived "16 rings minted"', html.includes('16 rings minted')],
    ['League Trophy derived "16 names engraved"', html.includes('16 names engraved')],
  ];
  for (const [label, passed] of checks) passed ? ok(label) : bad(`render: ${label}`);

  console.log('\n[5] SCRUB');
  await svc.from('trophy_custody_events').delete().eq('league_id', LEAGUE_ID).eq('trophy_id', 'TR-CP-1');
  if ((await eventCount()) === 0) ok('prod clean: proof events removed'); else bad('scrub incomplete');

  console.log('\n=== Result:', failures === 0 ? 'ALL ACCEPTANCE CRITERIA MET' : `${failures} FAILURE(S)`, '===');
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error('proof error:', e); process.exit(1); });
