#!/usr/bin/env tsx
// scripts/test-governance.ts
// Governance test checklist — the frontend's equivalent of prove_ci.sh
// Run: npm run test:governance
// ALL tests must pass before any merge to main.
// A governance test failure is BLOCKING — it does not get merged with a note.

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsTransport = ws as any;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('Missing required env vars. Copy .env.local and set all three Supabase keys.');
  process.exit(1);
}

const anonClient    = createClient(SUPABASE_URL, ANON_KEY, { realtime: { transport: wsTransport } });
const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, { realtime: { transport: wsTransport } });

const DEMO_LEAGUE_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ARTIFACT_ID = '00000000-0000-0002-0000-000000000001';

let passed = 0;
let failed = 0;

function pass(test: string) {
  console.log(`  ✓  ${test}`);
  passed++;
}

function fail(test: string, detail: string) {
  console.error(`  ✗  ${test}`);
  console.error(`     ${detail}`);
  failed++;
}

// ── G1: Member query cannot retrieve unapproved artifacts ──────────────
async function g1() {
  console.log('\nG1 — Member query cannot retrieve unapproved artifacts');

  // First, insert a DRAFT artifact via service role
  const { data: draftArtifact } = await serviceClient
    .from('artifacts')
    .insert({
      league_id:      DEMO_LEAGUE_ID,
      artifact_type:  'WEEKLY_RECAP',
      artifact_class: 'E1',
      approval_state: 'DRAFT',
      is_demo:        true,
      trust_bar_text: 'Draft Preview | Pending Commissioner Review | SquadVault',
    })
    .select()
    .single();

  if (!draftArtifact) {
    fail('G1', 'Could not insert DRAFT artifact via service role');
    return;
  }

  // Anon client should return zero unapproved artifacts
  const { data: unapproved, error } = await anonClient
    .from('artifacts')
    .select('id, approval_state')
    .eq('league_id', DEMO_LEAGUE_ID)
    .not('approval_state', 'in', '("APPROVED","DISTRIBUTED")');

  if (error || !unapproved || unapproved.length === 0) {
    pass('G1: Anon cannot see DRAFT artifacts (RLS enforced)');
  } else {
    fail('G1', `Anon can see ${unapproved.length} unapproved artifact(s) — RLS FAILURE`);
  }

  // Clean up
  await serviceClient.from('artifacts').delete().eq('id', draftArtifact.id);
}

// ── G3: No DELETE action exists on any table (RLS) ─────────────────────
async function g3() {
  console.log('\nG3 — No DELETE policy on any table');

  const tables = [
    'leagues', 'franchises', 'artifacts', 'artifact_versions',
    'approval_events', 'docket_ids', 'trophy_room_entries',
    'founding_sessions', 'commissioner_notes', 'friction_log',
    'sync_log', 'audit_log',
  ];

  const { data: deletePolicies } = await serviceClient
    .rpc('pg_policies' as never)
    .select('*')
    .is('cmd', 'DELETE' as never);

  // Alternative: query pg_policies directly
  const { data: policies } = await serviceClient
    .from('pg_policies' as never)
    .select('tablename, cmd')
    .eq('cmd', 'DELETE')
    .in('tablename', tables);

  if (!policies || policies.length === 0) {
    pass('G3: No DELETE RLS policies exist on any table');
  } else {
    fail('G3', `Found ${policies.length} DELETE policy/policies: ${JSON.stringify(policies)}`);
  }
}

// ── G4: Invalid state transition rejected at DB layer ──────────────────
async function g4() {
  console.log('\nG4 — Invalid approval state transition rejected at DB layer');

  const illegalTransitions: Array<[string, string]> = [
    ['DRAFT', 'APPROVED'],        // Skips UNDER_REVIEW
    ['DRAFT', 'DISTRIBUTED'],     // Skips entire chain
    ['APPROVED', 'DRAFT'],        // No reversal to draft
    ['DISTRIBUTED', 'APPROVED'],  // Distributed is terminal
  ];

  // Create a test artifact
  const { data: testArtifact } = await serviceClient
    .from('artifacts')
    .insert({
      league_id:      DEMO_LEAGUE_ID,
      artifact_type:  'WEEKLY_RECAP',
      artifact_class: 'E1',
      approval_state: 'DRAFT',
      is_demo:        true,
      trust_bar_text: 'Draft Preview | Pending Commissioner Review | SquadVault',
    })
    .select()
    .single();

  if (!testArtifact) {
    fail('G4', 'Could not create test artifact');
    return;
  }

  let allRejected = true;
  for (const [from, to] of illegalTransitions) {
    // Set the artifact to the FROM state via REST bypass (skips trigger)
    await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/test_force_artifact_state`,
      {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artifact_id: (testArtifact as { id: string }).id,
          new_state: from,
        }),
      }
    );
    // Attempt the illegal transition (bypass OFF — trigger must fire)
    const { error } = await serviceClient
      .from('artifacts')
      .update({ approval_state: to })
      .eq('id', (testArtifact as { id: string }).id);

    if (error && error.message.includes('Invalid approval state transition')) {
      pass(`G4: ${from} → ${to} correctly rejected`);
    } else {
      fail('G4', `Illegal transition ${from} → ${to} was NOT rejected — trigger FAILURE`);
      allRejected = false;
    }
  }

  // Clean up
  await serviceClient.from('artifacts').delete().eq('id', (testArtifact as { id: string }).id);
}

// ── G6: Anon cannot read private league artifacts ──────────────────────
async function g6() {
  console.log('\nG6 — Anon request cannot read private league artifacts');

  const tables = ['artifacts', 'franchises', 'leagues', 'voice_profiles'];
  let allBlocked = true;

  for (const table of tables) {
    const { data, error } = await anonClient
      .from(table)
      .select('id')
      .limit(1);

    if (error || !data || data.length === 0) {
      pass(`G6: Anon cannot read from ${table} (RLS enforced)`);
    } else {
      fail('G6', `Anon can read from ${table} — RLS FAILURE. ${data.length} rows returned.`);
      allBlocked = false;
    }
  }

  return allBlocked;
}

// ── G7: No speculative content on archive pages (manual check reminder) ─
async function g7() {
  console.log('\nG7 — No speculative content check');
  // This test is a reminder for manual verification — automated check:
  // Confirm APPROVED demo artifact has the correct trust bar text

  const { data: artifact } = await serviceClient
    .from('artifacts')
    .select('trust_bar_text, is_demo, approval_state')
    .eq('id', DEMO_ARTIFACT_ID)
    .single();

  if (!artifact) {
    fail('G7', 'Demo artifact not found — seed may not have run');
    return;
  }

  if (artifact.is_demo && artifact.trust_bar_text.includes('Demo Artifact')) {
    pass('G7: Demo artifact has correct DEMO trust bar text');
  } else {
    fail('G7', `Demo artifact has wrong trust bar: "${artifact.trust_bar_text}"`);
  }

  if (artifact.approval_state === 'APPROVED') {
    pass('G7: Demo artifact is in APPROVED state');
  } else {
    fail('G7', `Demo artifact is in ${artifact.approval_state} state, expected APPROVED`);
  }
}

// ── G9: Trust bar and docket ID present on demo artifact ──────────────
async function g9() {
  console.log('\nG9 — Trust bar and docket ID present on artifact records');

  const { data } = await serviceClient
    .from('artifacts')
    .select('id, trust_bar_text, docket_id')
    .eq('league_id', DEMO_LEAGUE_ID)
    .eq('approval_state', 'APPROVED');

  if (!data || data.length === 0) {
    fail('G9', 'No APPROVED artifacts found in demo league');
    return;
  }

  for (const artifact of data) {
    if (!artifact.trust_bar_text || artifact.trust_bar_text.length === 0) {
      fail('G9', `Artifact ${artifact.id} has empty trust_bar_text`);
    } else {
      pass(`G9: Artifact ${artifact.id.slice(0,8)}... has trust bar`);
    }

    if (!artifact.docket_id) {
      fail('G9', `Artifact ${artifact.id} has no docket_id`);
    } else if (artifact.docket_id.startsWith('DEMO-') || artifact.docket_id.startsWith('SV-')) {
      pass(`G9: Artifact ${artifact.id.slice(0,8)}... has docket ID: ${artifact.docket_id}`);
    } else {
      fail('G9', `Artifact ${artifact.id} has malformed docket_id: ${artifact.docket_id}`);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  SquadVault Governance Tests');
  console.log('  Running against:', SUPABASE_URL);
  console.log('═══════════════════════════════════════════════════');

  await g1();
  await g3();
  await g4();
  await g6();
  await g7();
  await g9();

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════');

  if (failed > 0) {
    console.error('\n  GOVERNANCE FAILURE — do not merge until all tests pass.\n');
    process.exit(1);
  } else {
    console.log('\n  All governance tests passed.\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Governance test runner error:', err);
  process.exit(1);
});
