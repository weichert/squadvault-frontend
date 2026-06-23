// scripts/probe_w5_preapply.ts
// W.5 Championship Package FRESH prod object-existence probe (Charter step 3; the repo-Done !=
// prod-applied hazard, the 010 G11 false-pass lesson). Run BEFORE each migration apply.
// Confirms the shipped substrate is live AND that the increment's new objects do NOT yet exist:
//   - trophy_room_entries (shipped v1) present; franchise_season_names present; member_consent /
//     media_captions present (prod == repo at 024)
//   - trophy_custody_events absent; custody_integrity_probe absent (pre-025)
// Object-existence, not the schema_migrations ledger. PostgREST: 42P01 / PGRST205 => absent.
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsTransport = ws as any;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !SERVICE_KEY) {
  console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}
const svc = createClient(URL, SERVICE_KEY, { realtime: { transport: wsTransport } });

const ABSENT = new Set(['42P01', 'PGRST205']);

async function tableExists(name: string): Promise<boolean> {
  const { error } = await svc.from(name).select('*').limit(1);
  if (!error) return true;
  if (ABSENT.has((error as { code?: string }).code ?? '')) return false;
  return true; // RLS / other error => relation exists
}
async function rpcExists(name: string): Promise<boolean> {
  const { error } = await svc.rpc(name as never);
  // PGRST202 = function not found in schema cache; 42883 = undefined_function
  if (!error) return true;
  const code = (error as { code?: string }).code ?? '';
  return !(code === 'PGRST202' || code === '42883' || ABSENT.has(code));
}

async function main() {
  console.log('=== W.5 FRESH pre-apply probe - prod', URL.replace(/https:\/\/|\.supabase.*/g, ''), '===\n');
  let ok = true;
  const present = ['trophy_room_entries', 'franchise_season_names', 'franchises', 'member_consent_events', 'media_captions'];
  for (const t of present) {
    const ex = await tableExists(t);
    console.log(`${ex ? 'OK  ' : 'FAIL'}  shipped substrate present: ${t}`);
    if (!ex) ok = false;
  }
  // prod == repo at 024: caption_separation_probe (024) should be live
  const cap = await rpcExists('caption_separation_probe');
  console.log(`${cap ? 'OK  ' : 'FAIL'}  caption_separation_probe() live (prod == repo at 024)`);
  if (!cap) ok = false;

  console.log('');
  const custody = await tableExists('trophy_custody_events');
  console.log(`${!custody ? 'OK  ' : 'FAIL'}  trophy_custody_events does NOT yet exist (expected absent pre-025)`);
  if (custody) ok = false;
  const probe = await rpcExists('custody_integrity_probe');
  console.log(`${!probe ? 'OK  ' : 'FAIL'}  custody_integrity_probe() does NOT yet exist (expected absent pre-025)`);
  if (probe) ok = false;

  console.log('\n===', ok ? 'PRE-APPLY STATE CONFIRMED - safe to prepare 025.' : 'PROBE FAILED - STOP, reconcile.', '===');
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error('probe error:', e); process.exit(1); });
