// scripts/probe_w1_inc2_preapply.ts
// W.1 Inc 2 FRESH pre-apply object-existence probe (Charter step 3; the repo-Done !=
// prod-applied hazard, the 010 G11 false-pass lesson). Run BEFORE any 022 apply.
// Confirms the six-true substrate AND that the increment's new objects do NOT yet exist:
//   - media_captions table absent
//   - 'media_caption' NOT yet accepted by member_consent_events.category CHECK
// Object-existence, not the schema_migrations ledger.
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

// 42P01 = undefined_table (direct PG); PGRST205 = table absent from PostgREST schema cache.
// Both mean "the relation does not exist".
const ABSENT_CODES = new Set(['42P01', 'PGRST205']);
const CHECK_VIOLATION = '23514';

async function tableExists(name: string): Promise<boolean> {
  const { error } = await svc.from(name).select('id').limit(1);
  if (!error) return true;
  if (ABSENT_CODES.has((error as { code?: string }).code ?? '')) return false;
  // Any other error (RLS etc.) still implies the relation exists.
  return true;
}

async function main() {
  console.log('═══ W.1 Inc 2 FRESH pre-apply probe — prod', URL.replace(/https:\/\/|\.supabase.*/g, ''), '═══\n');
  let ok = true;

  // --- The six-true substrate (must ALL exist) ---
  const substrate = [
    'media_entries',
    'media_provenance_tag_events',
    'media_display_withdrawals',
    'member_consent_events',
    'member_history_exchanges',
  ];
  for (const t of substrate) {
    const ex = await tableExists(t);
    console.log(`${ex ? 'OK  ' : 'FAIL'}  substrate exists: ${t}`);
    if (!ex) ok = false;
  }
  // testimony_separation_probe() is the sixth — call it (021 / L.1).
  {
    const { data, error } = await svc.rpc('testimony_separation_probe' as never);
    const present = !error && Array.isArray(data) && data.length > 0;
    console.log(`${present ? 'OK  ' : 'FAIL'}  substrate exists: testimony_separation_probe() (021)`);
    if (!present) ok = false;
  }

  console.log('');

  // --- The increment's NEW objects must NOT yet exist ---
  const capExists = await tableExists('media_captions');
  console.log(`${!capExists ? 'OK  ' : 'FAIL'}  media_captions does NOT yet exist (expected absent pre-022)`);
  if (capExists) ok = false;

  const capProbe = await svc.rpc('caption_separation_probe' as never);
  const probeAbsent = !!capProbe.error;
  console.log(`${probeAbsent ? 'OK  ' : 'FAIL'}  caption_separation_probe() does NOT yet exist (expected absent pre-022)`);
  if (!probeAbsent) ok = false;

  // --- 'media_caption' must NOT yet be in the consent category CHECK ---
  // Find a real franchise-linked member + league so FKs pass, isolating the CHECK as the
  // only possible gate. A 23514 (check_violation) => media_caption is NOT yet permitted.
  const { data: fr } = (await svc
    .from('franchises')
    .select('member_user_id, league_id')
    .not('member_user_id', 'is', null)
    .limit(1)
    .maybeSingle()) as { data: { member_user_id: string; league_id: string } | null };
  if (!fr) {
    console.log('WARN  no franchise-linked member found; CHECK probe via FK-passing insert skipped');
  } else {
    const { data: ins, error: insErr } = (await svc
      .from('member_consent_events')
      .insert({
        member_user_id: fr.member_user_id,
        league_id: fr.league_id,
        event_type: 'GRANT',
        category: 'media_caption',
        rendering_class: null,
        context: 'preapply_probe',
        note: 'W1I2 preapply probe — delete if present',
      } as never)
      .select('id')
      .maybeSingle()) as { data: { id: string } | null; error: { code?: string } | null };
    if (insErr && insErr.code === CHECK_VIOLATION) {
      console.log(`OK    'media_caption' is REJECTED by the consent CHECK (23514 — not yet widened)`);
    } else if (insErr) {
      console.log(`?     consent insert errored with ${insErr.code ?? '(no code)'} — inspect: ${JSON.stringify(insErr)}`);
      ok = false;
    } else {
      console.log(`FAIL  'media_caption' was ACCEPTED — CHECK already widened (unexpected pre-apply). Cleaning up.`);
      if (ins?.id) await svc.from('member_consent_events').delete().eq('id', ins.id);
      ok = false;
    }
  }

  console.log('\n═══', ok ? 'PRE-APPLY STATE CONFIRMED — safe to prepare 022.' : 'PROBE FAILED — STOP, reconcile before any apply.', '═══');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('probe error:', e);
  process.exit(1);
});
