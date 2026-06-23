// scripts/proof_w5_ratify_ui.ts
// W.5 Belt ratify UI - commissioner-only gating proof. The route POST is already proven
// (proof_w5_championship.ts); this proves the new SURFACE: the ratify control renders for the
// commissioner and is ABSENT for a member and for anon. Headless sessions (the L.1/W.1 pattern).
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import ws from 'ws';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsT = ws as any;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.PROOF_BASE ?? 'http://localhost:3941';
const SLUG = '70985';
const MARKER = 'Ratify a Belt transfer';
const svc = createClient(URL, SERVICE, { realtime: { transport: wsT } });
let failures = 0;
const ok = (m: string) => console.log(`  OK   ${m}`);
const bad = (m: string) => { console.log(`  FAIL ${m}`); failures++; };

async function cookie(email: string): Promise<string> {
  const link = await svc.auth.admin.generateLink({ type: 'magiclink', email });
  const hashed = (link.data as { properties?: { hashed_token?: string } })?.properties?.hashed_token!;
  const anon = createClient(URL, ANON, { realtime: { transport: wsT } });
  const otp = await anon.auth.verifyOtp({ token_hash: hashed, type: 'magiclink' });
  const s = otp.data.session!;
  const jar = new Map<string, string>();
  const ssr = createServerClient(URL, ANON, { realtime: { transport: wsT }, cookies: { getAll: () => Array.from(jar).map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)) } });
  await ssr.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  return Array.from(jar).map(([n, v]) => `${n}=${v}`).join('; ');
}
const pageHas = async (c: string | null) => {
  const r = await fetch(`${BASE}/league/${SLUG}/trophy-room`, { headers: c ? { Cookie: c } : {} });
  return (await r.text()).includes(MARKER);
};

async function main() {
  console.log('\n=== W.5 Belt ratify UI - commissioner-only gating ===');
  const commish = await cookie('steven.weichert@gmail.com');
  const member = await cookie('swickywick@yahoo.com');
  (await pageHas(commish)) ? ok('commissioner SEES the ratify control') : bad('commissioner does not see the ratify control');
  (await pageHas(member)) ? bad('member SEES the ratify control (should not)') : ok('member does NOT see the ratify control');
  (await pageHas(null)) ? bad('anon SEES the ratify control (should not)') : ok('anon does NOT see the ratify control');
  console.log('\n=== Result:', failures === 0 ? 'RATIFY UI GATING PROVEN' : `${failures} FAILURE(S)`, '===');
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error('proof error:', e); process.exit(1); });
