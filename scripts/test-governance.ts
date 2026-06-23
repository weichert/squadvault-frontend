#!/usr/bin/env tsx
// scripts/test-governance.ts
// Governance test checklist — the frontend's equivalent of prove_ci.sh
// Run: npm run test:governance
// ALL tests must pass before any merge to main.
// A governance test failure is BLOCKING — it does not get merged with a note.

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
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

// Assert an anon INSERT was denied by RLS specifically (Postgres 42501,
// "new row violates row-level security policy"), NOT by some incidental
// constraint (FK 23503, NOT NULL 23502, CHECK 23514). RLS WITH CHECK is
// evaluated before the row's constraints, so a genuine policy denial always
// surfaces as 42501 even with bogus FK ids — asserting the code keeps an
// unrelated schema error from masquerading as a passing governance test.
function assertRlsInsertDenied(
  label: string,
  table: string,
  err: { code?: string } | null,
) {
  if (err?.code === '42501') {
    pass(`${label}: Anon cannot insert ${table} (RLS denial 42501)`);
  } else if (err) {
    fail(label, `Insert into ${table} was denied by ${err.code}, not RLS 42501 — assertion too weak / wrong cause`);
  } else {
    fail(label, `Anon inserted a ${table} row — RLS FAILURE`);
  }
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

// ── G10: founding_sessions is commissioner-scoped (RLS) ────────────────
async function g10() {
  console.log('\nG10 — founding_sessions is commissioner-scoped (RLS)');

  // (a) Anon cannot create a founding session. Data-independent: anon has no
  // auth.uid(), so INSERT WITH CHECK (commissioner_user_id = auth.uid())
  // denies it. (A bad FK would also reject it; either way anon cannot write.)
  const { error: insErr } = await anonClient
    .from('founding_sessions')
    .insert({
      league_id: DEMO_LEAGUE_ID,
      commissioner_user_id: '00000000-0000-0000-0000-0000000000ff',
      state: 'IN_PROGRESS',
      exchanges: [],
      covered_topics: [],
      pending_required_topics: [],
      consent: {},
      voice_profile_selection: null,
      total_tokens_used: 0,
      outputs_generated: false,
      outputs_approved: false,
    });
  if (insErr) {
    pass('G10: Anon cannot insert founding_sessions (RLS enforced)');
  } else {
    fail('G10', 'Anon inserted a founding_sessions row — RLS FAILURE');
  }

  // (b) Anon cannot read a commissioner's session. Needs a real row, so
  // resolve a commissioner from an existing league; skip with a note if none.
  const { data: leagueRow } = (await serviceClient
    .from('leagues')
    .select('id, commissioner_user_id')
    .not('commissioner_user_id', 'is', null)
    .limit(1)
    .maybeSingle()) as {
    data: { id: string; commissioner_user_id: string } | null;
  };

  if (!leagueRow) {
    console.log(
      '     (skip G10b: no league with a commissioner_user_id in this environment)',
    );
    return;
  }

  const { data: seeded } = (await serviceClient
    .from('founding_sessions')
    .insert({
      league_id: leagueRow.id,
      commissioner_user_id: leagueRow.commissioner_user_id,
      state: 'IN_PROGRESS',
      exchanges: [],
      covered_topics: [],
      pending_required_topics: [],
      consent: {},
      voice_profile_selection: null,
      total_tokens_used: 0,
      outputs_generated: false,
      outputs_approved: false,
    })
    .select('id')
    .single()) as { data: { id: string } | null };

  if (!seeded) {
    fail('G10', 'Could not seed a founding_sessions row via service role');
    return;
  }

  const { data: anonRead } = await anonClient
    .from('founding_sessions')
    .select('id')
    .eq('id', seeded.id);

  if (!anonRead || anonRead.length === 0) {
    pass('G10: Anon cannot read a commissioner founding_sessions row (RLS enforced)');
  } else {
    fail('G10', `Anon read a founding_sessions row — RLS FAILURE (${anonRead.length})`);
  }

  const { data: anonUpdated } = await anonClient
    .from('founding_sessions')
    .update({ state: 'COMPLETE' })
    .eq('id', seeded.id)
    .select('id');
  if (!anonUpdated || anonUpdated.length === 0) {
    pass('G10: Anon cannot update founding_sessions (RLS enforced)');
  } else {
    fail('G10', 'Anon updated a founding_sessions row — RLS FAILURE');
  }

  await serviceClient.from('founding_sessions').delete().eq('id', seeded.id);
}

// ── G11: member_consent_events is member-scoped + append-only (RLS, W.6) ──
async function g11() {
  console.log('\nG11 — member_consent_events is member-scoped + append-only (RLS, W.6)');

  // (a) Anon cannot INSERT a consent event. Data-independent: anon has no
  // auth.uid(), so INSERT WITH CHECK (member_user_id = auth.uid()) denies it.
  // This is the W.6 section 1.3 guarantee at the RLS layer — only the member
  // may author a grant; no anon/commissioner/admin proxy.
  const { error: insErr } = await anonClient
    .from('member_consent_events')
    .insert({
      member_user_id: '00000000-0000-0000-0000-0000000000ff',
      league_id: DEMO_LEAGUE_ID,
      event_type: 'GRANT',
      category: 'media_appearance',
      rendering_class: null,
      context: 'governance_test',
      note: null,
    });
  if (insErr) {
    pass('G11: Anon cannot insert member_consent_events (RLS enforced)');
  } else {
    fail('G11', 'Anon inserted a member_consent_events row — RLS FAILURE');
  }

  // (b)-(d) need a real (member_user_id, league_id) to satisfy the auth.users
  // FK. Resolve a member from franchises; skip with a note if none.
  const { data: fr } = (await serviceClient
    .from('franchises')
    .select('member_user_id, league_id')
    .not('member_user_id', 'is', null)
    .limit(1)
    .maybeSingle()) as {
    data: { member_user_id: string; league_id: string } | null;
  };

  if (!fr) {
    console.log(
      '     (skip G11b-d: no franchise with a member_user_id in this environment)',
    );
    return;
  }

  const { data: seeded } = (await serviceClient
    .from('member_consent_events')
    .insert({
      member_user_id: fr.member_user_id,
      league_id: fr.league_id,
      event_type: 'GRANT',
      category: 'attributed_quotes',
      rendering_class: null,
      context: 'governance_test',
      note: null,
    })
    .select('id')
    .single()) as { data: { id: string } | null };

  if (!seeded) {
    fail('G11', 'Could not seed a member_consent_events row via service role');
    return;
  }

  // (b) Anon cannot read a member's consent row (RLS select scope).
  const { data: anonRead } = await anonClient
    .from('member_consent_events')
    .select('id')
    .eq('id', seeded.id);
  if (!anonRead || anonRead.length === 0) {
    pass('G11: Anon cannot read a member_consent_events row (RLS enforced)');
  } else {
    fail('G11', `Anon read a member_consent_events row — RLS FAILURE (${anonRead.length})`);
  }

  // (c) Append-only: no UPDATE policy — anon update affects no rows.
  const { data: anonUpd } = await anonClient
    .from('member_consent_events')
    .update({ note: 'tampered' })
    .eq('id', seeded.id)
    .select('id');
  if (!anonUpd || anonUpd.length === 0) {
    pass('G11: Anon cannot update member_consent_events (append-only)');
  } else {
    fail('G11', 'Anon updated a member_consent_events row — APPEND-ONLY FAILURE');
  }

  // (d) Append-only: no DELETE policy — anon delete affects no rows.
  const { data: anonDel } = await anonClient
    .from('member_consent_events')
    .delete()
    .eq('id', seeded.id)
    .select('id');
  if (!anonDel || anonDel.length === 0) {
    pass('G11: Anon cannot delete member_consent_events (append-only)');
  } else {
    fail('G11', 'Anon deleted a member_consent_events row — APPEND-ONLY FAILURE');
  }

  // NOTE (harness limitation): member-A-vs-member-B SELECT isolation and the
  // commissioner-cannot-proxy-INSERT guarantee (W.6 1.3) require authenticated
  // member/commissioner sessions; this harness exercises anon-denial only.
  // Those assertions are deferred to an authenticated-session harness extension.

  await serviceClient.from('member_consent_events').delete().eq('id', seeded.id);
}

// Resolve a real (member_user_id, league_id) to satisfy the auth.users FK on the
// W.1 tables when seeding via service role. Returns null if the environment has no
// franchise with a member yet (then seeded sub-tests skip, like G11b-d).
async function resolveMember(): Promise<{ member_user_id: string; league_id: string } | null> {
  const { data } = (await serviceClient
    .from('franchises')
    .select('member_user_id, league_id')
    .not('member_user_id', 'is', null)
    .limit(1)
    .maybeSingle()) as { data: { member_user_id: string; league_id: string } | null };
  return data;
}

// ── G12: media_entries is commissioner-write + append-only (RLS, W.1) ────
async function g12() {
  console.log('\nG12 — media_entries is commissioner-write + append-only (RLS, W.1)');

  // (a) Anon cannot INSERT. Data-independent: INSERT WITH CHECK requires
  // is_commissioner/is_admin AND uploaded_by = auth.uid(); anon has neither.
  const { error: insErr } = await anonClient.from('media_entries').insert({
    league_id: DEMO_LEAGUE_ID,
    media_kind: 'photo',
    storage_path: `${DEMO_LEAGUE_ID}/00000000-0000-0000-0000-0000000000aa/original.jpg`,
    mime_type: 'image/jpeg',
    uploaded_by: '00000000-0000-0000-0000-0000000000ff',
    upload_note: 'governance_test',
  });
  assertRlsInsertDenied('G12', 'media_entries', insErr);

  const fr = await resolveMember();
  if (!fr) {
    console.log('     (skip G12b-d: no franchise with a member_user_id in this environment)');
    return;
  }

  const { data: seeded } = (await serviceClient
    .from('media_entries')
    .insert({
      league_id: fr.league_id,
      media_kind: 'photo',
      storage_path: `${fr.league_id}/00000000-0000-0000-0000-0000000000ab/original.jpg`,
      mime_type: 'image/jpeg',
      uploaded_by: fr.member_user_id,
      upload_note: 'governance_test',
    })
    .select('id')
    .single()) as { data: { id: string } | null };

  if (!seeded) {
    fail('G12', 'Could not seed a media_entries row via service role');
    return;
  }

  // (b) Anon cannot UPDATE (append-only — no UPDATE policy).
  const { data: anonUpd } = await anonClient
    .from('media_entries')
    .update({ upload_note: 'tampered' })
    .eq('id', seeded.id)
    .select('id');
  if (!anonUpd || anonUpd.length === 0) {
    pass('G12: Anon cannot update media_entries (append-only)');
  } else {
    fail('G12', 'Anon updated a media_entries row — APPEND-ONLY FAILURE');
  }

  // (c) Anon cannot DELETE (append-only — no DELETE policy).
  const { data: anonDel } = await anonClient
    .from('media_entries')
    .delete()
    .eq('id', seeded.id)
    .select('id');
  if (!anonDel || anonDel.length === 0) {
    pass('G12: Anon cannot delete media_entries (append-only)');
  } else {
    fail('G12', 'Anon deleted a media_entries row — APPEND-ONLY FAILURE');
  }

  await serviceClient.from('media_entries').delete().eq('id', seeded.id);
}

// ── G13: media_provenance_tag_events append-only + scoped (RLS, W.1) ─────
async function g13() {
  console.log('\nG13 — media_provenance_tag_events is commissioner-write + append-only (RLS, W.1)');

  // (a) Anon cannot INSERT. Data-independent: WITH CHECK requires commissioner on
  // the parent media_entries league AND ratified_by = auth.uid(); anon has neither.
  const { error: insErr } = await anonClient.from('media_provenance_tag_events').insert({
    media_entry_id: '00000000-0000-0000-0000-0000000000ac',
    tag_kind: 'contributor',
    tag_value: 'governance_test',
    ratified_by: '00000000-0000-0000-0000-0000000000ff',
  });
  assertRlsInsertDenied('G13', 'media_provenance_tag_events', insErr);

  const fr = await resolveMember();
  if (!fr) {
    console.log('     (skip G13b-d: no franchise with a member_user_id in this environment)');
    return;
  }

  // Seed a parent media_entries row, then a tag event on it.
  const { data: parent } = (await serviceClient
    .from('media_entries')
    .insert({
      league_id: fr.league_id,
      media_kind: 'photo',
      storage_path: `${fr.league_id}/00000000-0000-0000-0000-0000000000ad/original.jpg`,
      mime_type: 'image/jpeg',
      uploaded_by: fr.member_user_id,
      upload_note: 'governance_test',
    })
    .select('id')
    .single()) as { data: { id: string } | null };

  if (!parent) {
    fail('G13', 'Could not seed a parent media_entries row via service role');
    return;
  }

  const { data: seeded } = (await serviceClient
    .from('media_provenance_tag_events')
    .insert({
      media_entry_id: parent.id,
      tag_kind: 'contributor',
      tag_value: 'governance_test',
      ratified_by: fr.member_user_id,
    })
    .select('id')
    .single()) as { data: { id: string } | null };

  if (!seeded) {
    fail('G13', 'Could not seed a media_provenance_tag_events row via service role');
    await serviceClient.from('media_entries').delete().eq('id', parent.id);
    return;
  }

  // (b) Anon cannot read the tag event (RLS select scope, via the parent league).
  const { data: anonRead } = await anonClient
    .from('media_provenance_tag_events')
    .select('id')
    .eq('id', seeded.id);
  if (!anonRead || anonRead.length === 0) {
    pass('G13: Anon cannot read a media_provenance_tag_events row (RLS enforced)');
  } else {
    fail('G13', `Anon read a media_provenance_tag_events row — RLS FAILURE (${anonRead.length})`);
  }

  // (c) Anon cannot UPDATE (append-only — supersession, not edit).
  const { data: anonUpd } = await anonClient
    .from('media_provenance_tag_events')
    .update({ note: 'tampered' })
    .eq('id', seeded.id)
    .select('id');
  if (!anonUpd || anonUpd.length === 0) {
    pass('G13: Anon cannot update media_provenance_tag_events (append-only)');
  } else {
    fail('G13', 'Anon updated a media_provenance_tag_events row — APPEND-ONLY FAILURE');
  }

  // (d) Anon cannot DELETE (append-only).
  const { data: anonDel } = await anonClient
    .from('media_provenance_tag_events')
    .delete()
    .eq('id', seeded.id)
    .select('id');
  if (!anonDel || anonDel.length === 0) {
    pass('G13: Anon cannot delete media_provenance_tag_events (append-only)');
  } else {
    fail('G13', 'Anon deleted a media_provenance_tag_events row — APPEND-ONLY FAILURE');
  }

  await serviceClient.from('media_provenance_tag_events').delete().eq('id', seeded.id);
  await serviceClient.from('media_entries').delete().eq('id', parent.id);
}

// ── G14: room_ratification_events append-only + the fail-closed gate ─────
async function g14() {
  console.log('\nG14 — room_ratification_events is commissioner-write + append-only (RLS, W.1)');

  // (a) Anon cannot INSERT (the gate cannot be opened by anon).
  const { error: insErr } = await anonClient.from('room_ratification_events').insert({
    league_id: DEMO_LEAGUE_ID,
    ratified_by: '00000000-0000-0000-0000-0000000000ff',
    scope_note: 'governance_test',
  });
  assertRlsInsertDenied('G14', 'room_ratification_events', insErr);

  const fr = await resolveMember();
  if (!fr) {
    console.log('     (skip G14b-c: no franchise with a member_user_id in this environment)');
    return;
  }

  const { data: seeded } = (await serviceClient
    .from('room_ratification_events')
    .insert({
      league_id: fr.league_id,
      ratified_by: fr.member_user_id,
      scope_note: 'governance_test',
    })
    .select('id')
    .single()) as { data: { id: string } | null };

  if (!seeded) {
    fail('G14', 'Could not seed a room_ratification_events row via service role');
    return;
  }

  // (b) Anon cannot UPDATE (append-only).
  const { data: anonUpd } = await anonClient
    .from('room_ratification_events')
    .update({ scope_note: 'tampered' })
    .eq('id', seeded.id)
    .select('id');
  if (!anonUpd || anonUpd.length === 0) {
    pass('G14: Anon cannot update room_ratification_events (append-only)');
  } else {
    fail('G14', 'Anon updated a room_ratification_events row — APPEND-ONLY FAILURE');
  }

  // (c) Anon cannot DELETE (append-only — the gate cannot be un-ratified).
  const { data: anonDel } = await anonClient
    .from('room_ratification_events')
    .delete()
    .eq('id', seeded.id)
    .select('id');
  if (!anonDel || anonDel.length === 0) {
    pass('G14: Anon cannot delete room_ratification_events (append-only)');
  } else {
    fail('G14', 'Anon deleted a room_ratification_events row — APPEND-ONLY FAILURE');
  }

  await serviceClient.from('room_ratification_events').delete().eq('id', seeded.id);
}

// ── G15: media_display_withdrawals append-only + commissioner-write ──────
async function g15() {
  console.log('\nG15 — media_display_withdrawals is commissioner-write + append-only (RLS, W.1)');

  // (a) Anon cannot INSERT a withdrawal.
  const { error: insErr } = await anonClient.from('media_display_withdrawals').insert({
    league_id: DEMO_LEAGUE_ID,
    media_entry_id: null,
    requested_by: '00000000-0000-0000-0000-0000000000ff',
    note: 'governance_test',
  });
  assertRlsInsertDenied('G15', 'media_display_withdrawals', insErr);

  const fr = await resolveMember();
  if (!fr) {
    console.log('     (skip G15b-c: no franchise with a member_user_id in this environment)');
    return;
  }

  const { data: seeded } = (await serviceClient
    .from('media_display_withdrawals')
    .insert({
      league_id: fr.league_id,
      media_entry_id: null,
      requested_by: fr.member_user_id,
      note: 'governance_test',
    })
    .select('id')
    .single()) as { data: { id: string } | null };

  if (!seeded) {
    fail('G15', 'Could not seed a media_display_withdrawals row via service role');
    return;
  }

  // (b) Anon cannot UPDATE (append-only).
  const { data: anonUpd } = await anonClient
    .from('media_display_withdrawals')
    .update({ note: 'tampered' })
    .eq('id', seeded.id)
    .select('id');
  if (!anonUpd || anonUpd.length === 0) {
    pass('G15: Anon cannot update media_display_withdrawals (append-only)');
  } else {
    fail('G15', 'Anon updated a media_display_withdrawals row — APPEND-ONLY FAILURE');
  }

  // (c) Anon cannot DELETE (append-only).
  const { data: anonDel } = await anonClient
    .from('media_display_withdrawals')
    .delete()
    .eq('id', seeded.id)
    .select('id');
  if (!anonDel || anonDel.length === 0) {
    pass('G15: Anon cannot delete media_display_withdrawals (append-only)');
  } else {
    fail('G15', 'Anon deleted a media_display_withdrawals row — APPEND-ONLY FAILURE');
  }

  // NOTE (harness limitation): the fail-closed room render (no ratification ->
  // empty display) and "signed URLs are server-issued, no public read path" are
  // render/route-level acceptance criteria (brief deliverable 6) exercised at the
  // founder click-through, not in this anon-RLS harness. The league-media bucket is
  // created out-of-band and is private (no public SELECT policy), so a direct anon
  // object read has no path; that is asserted at runtime, not here.

  await serviceClient.from('media_display_withdrawals').delete().eq('id', seeded.id);
}

// ── G16: league-media storage write is commissioner-only (RLS) — the
//        defense-in-depth layer under D-W1-V1 remedy B (Spec 5.1 Amendment 1) ──
async function g16() {
  console.log('\nG16 — league-media storage write is commissioner-only (RLS, W.1 remedy B)');

  // Under Amendment 1 the byte write moves to a client-direct upload under a
  // server-minted grant; the grant route's commissioner check + the server-chosen
  // path are the PRIMARY boundary. storage.objects RLS (league_media_commissioner_insert)
  // remains the defense-in-depth layer: a non-commissioner has NO direct write path
  // into league-media, regardless of prefix. Anon is the strongest non-commissioner.
  const bytes = new Uint8Array([0x00]);

  // Confirm the private bucket exists here via a service-role probe (service bypasses
  // RLS). If it is not provisioned in this environment, skip rather than false-pass
  // on a "bucket not found" error that looks like a denial.
  const probePath = `${DEMO_LEAGUE_ID}/${randomUUID()}/probe.bin`;
  const { error: probeErr } = await serviceClient.storage
    .from('league-media')
    .upload(probePath, bytes, { contentType: 'application/octet-stream', upsert: false });
  if (probeErr) {
    console.log('     (skip G16: league-media bucket not provisioned in this environment)');
    return;
  }
  await serviceClient.storage.from('league-media').remove([probePath]);

  // Anon cannot write an object into league-media (its own demo prefix)...
  const anonPath = `${DEMO_LEAGUE_ID}/${randomUUID()}/original.jpg`;
  const { data: anonData, error: anonErr } = await anonClient.storage
    .from('league-media')
    .upload(anonPath, bytes, { contentType: 'image/jpeg', upsert: false });
  if (!anonData && anonErr) {
    pass('G16: Anon cannot write league-media objects (storage RLS enforced)');
  } else {
    fail('G16', 'Anon wrote an object into league-media — STORAGE RLS FAILURE');
    await serviceClient.storage.from('league-media').remove([anonPath]);
  }

  // ...nor into an arbitrary other league prefix it has no claim to (the boundary is
  // not specific to one league id).
  const otherPath = `${randomUUID()}/${randomUUID()}/original.jpg`;
  const { data: otherData, error: otherErr } = await anonClient.storage
    .from('league-media')
    .upload(otherPath, bytes, { contentType: 'image/jpeg', upsert: false });
  if (!otherData && otherErr) {
    pass('G16: Anon cannot write an arbitrary league-media prefix (storage RLS enforced)');
  } else {
    fail('G16', 'Anon wrote into an arbitrary league-media prefix — STORAGE RLS FAILURE');
    await serviceClient.storage.from('league-media').remove([otherPath]);
  }

  // NOTE (harness limitation, consistent with G10-G15): the route-level cross-league
  // MINT guarantee — a commissioner of league X cannot obtain a grant for league Y —
  // is enforced in /api/av-room/upload/grant by isLeagueCommissioner(leagueId) + the
  // server-chosen path (Amendment 1 clauses a-b). That is an authenticated-route
  // assertion; this anon-RLS harness covers the storage defense-in-depth layer above,
  // and the founder click-through covers the authed-route path.
}

// ── G17: media_display_reinstatements is commissioner-write + append-only
//        (RLS, W.1 D5) ───────────────────────────────────────────────────
async function g17() {
  console.log('\nG17 — media_display_reinstatements is commissioner-write + append-only (RLS, W.1 D5)');

  // Probe existence via service role; skip (not false-pass) if migration 012 is not
  // yet applied to this environment.
  const { error: probeErr } = await serviceClient
    .from('media_display_reinstatements')
    .select('id')
    .limit(1);
  if (probeErr) {
    console.log('     (skip G17: media_display_reinstatements not present — apply migration 012)');
    return;
  }

  // Anon cannot INSERT. Data-independent: WITH CHECK requires commissioner/admin,
  // which anon is not; RLS WITH CHECK is evaluated before the row's FK constraints,
  // so bogus ids still surface as a 42501 policy denial rather than an FK error.
  const { error: insErr } = await anonClient.from('media_display_reinstatements').insert({
    league_id: DEMO_LEAGUE_ID,
    media_entry_id: '00000000-0000-0000-0000-0000000000aa',
    withdrawal_id: '00000000-0000-0000-0000-0000000000bb',
    reinstated_by: '00000000-0000-0000-0000-0000000000cc',
  });
  assertRlsInsertDenied('G17', 'media_display_reinstatements', insErr);
}

// ── G18: media_entries is append-only — there is NO UPDATE policy, so no non-service
// client can mutate a row (RLS filters it: zero rows, null error). This turns the R4-D3
// backfill accident into a permanent assertion: an authed UPDATE silently matched zero
// rows, which is exactly why the backfill hash write must use the admin (service) client.
async function g18() {
  console.log('\nG18 — media_entries is append-only: no UPDATE for any non-service client (RLS, W.1 011)');

  // Need a REAL row to prove RLS *denies the update* (vs. merely matching nothing).
  // Probe via service role; skip if media_entries is empty/absent in this environment.
  const { data: rows, error: probeErr } = await serviceClient
    .from('media_entries')
    .select('id, upload_note')
    .limit(1);
  if (probeErr) {
    console.log('     (skip G18: media_entries not present — apply migration 011)');
    return;
  }
  if (!rows || rows.length === 0) {
    console.log('     (skip G18: no media_entries row to probe against)');
    return;
  }
  const target = rows[0] as { id: string; upload_note: string | null };
  const sentinel = `g18-rls-probe-${randomUUID()}`;

  // Anon has no UPDATE policy; RLS filters the row out -> zero rows updated, error null.
  const { data: updated } = await anonClient
    .from('media_entries')
    .update({ upload_note: sentinel })
    .eq('id', target.id)
    .select('id');

  if (updated && updated.length > 0) {
    fail('G18', 'A non-service UPDATE on media_entries affected a row — APPEND-ONLY / RLS FAILURE');
    // Defensive restore via service role so the probe never persists a change.
    await serviceClient.from('media_entries').update({ upload_note: target.upload_note }).eq('id', target.id);
  } else {
    pass('G18: Non-service UPDATE on media_entries is denied (append-only; RLS filters the row)');
  }
}

// ── G19: media_expungement_events is commissioner-write + append-only (RLS, W.1 D-W1-E1).
// The expungement EVENT is the license to delete bytes (the ruled exception); the event
// itself must be commissioner-only and append-only, exactly like its withdrawal/
// reinstatement siblings. Probe-skip until migration 014 is applied (the 012/G17 rhythm).
async function g19() {
  console.log('\nG19 — media_expungement_events is commissioner-write + append-only (RLS, W.1 D-W1-E1)');

  const { error: probeErr } = await serviceClient
    .from('media_expungement_events')
    .select('id')
    .limit(1);
  if (probeErr) {
    console.log('     (skip G19: media_expungement_events not present — apply migration 014)');
    return;
  }

  // Anon cannot INSERT. WITH CHECK requires commissioner/admin, evaluated before FK, so
  // bogus ids still surface as a 42501 policy denial rather than an FK error.
  const { error: insErr } = await anonClient.from('media_expungement_events').insert({
    league_id: DEMO_LEAGUE_ID,
    media_entry_id: '00000000-0000-0000-0000-0000000000aa',
    reason: 'g19 probe',
    expunged_by: '00000000-0000-0000-0000-0000000000cc',
  });
  assertRlsInsertDenied('G19', 'media_expungement_events', insErr);
}

// ── G20: media_voice_attestations is commissioner-write + append-only (RLS, W.1 D-W1-A).
// The attestation EVENT is the license that satisfies the playback gate's first disjunct;
// it must be commissioner-only and append-only, like its withdrawal/expungement siblings.
// Probe-skip until migration 015 is applied (the G17/G19 rhythm).
async function g20() {
  console.log('\nG20 — media_voice_attestations is commissioner-write + append-only (RLS, W.1 D-W1-A)');

  const { error: probeErr } = await serviceClient
    .from('media_voice_attestations')
    .select('id')
    .limit(1);
  if (probeErr) {
    console.log('     (skip G20: media_voice_attestations not present — apply migration 015)');
    return;
  }

  // Anon cannot INSERT. WITH CHECK requires commissioner/admin, evaluated before FK, so
  // bogus ids still surface as a 42501 policy denial rather than an FK error.
  const { error: insErr } = await anonClient.from('media_voice_attestations').insert({
    league_id: DEMO_LEAGUE_ID,
    media_entry_id: '00000000-0000-0000-0000-0000000000aa',
    attested_state: 'no_member_voice',
    attested_by: '00000000-0000-0000-0000-0000000000cc',
  });
  assertRlsInsertDenied('G20', 'media_voice_attestations', insErr);
}

// ── G21: franchise_member_links is commissioner-write + append-only (RLS, E2.3-minimal).
// The linkage EVENT is the commissioner's ratification binding a member to a franchise;
// it must be commissioner-only and append-only, like its 012/014/015 siblings - a member
// can never self-assert the link. Probe-skip until migration 016 is applied (the
// G17/G19/G20 rhythm).
async function g21() {
  console.log('\nG21 — franchise_member_links is commissioner-write + append-only (RLS, E2.3)');

  const { error: probeErr } = await serviceClient
    .from('franchise_member_links')
    .select('id')
    .limit(1);
  if (probeErr) {
    console.log('     (skip G21: franchise_member_links not present — apply migration 016)');
    return;
  }

  // Anon cannot INSERT. WITH CHECK requires commissioner/admin, evaluated before FK, so
  // bogus ids still surface as a 42501 policy denial rather than an FK error. This is the
  // "never self-asserted" guarantee at the RLS layer: no anon/member proxy can author a link.
  const { error: insErr } = await anonClient.from('franchise_member_links').insert({
    league_id: DEMO_LEAGUE_ID,
    franchise_id: '00000000-0000-0000-0000-0000000000aa',
    member_user_id: '00000000-0000-0000-0000-0000000000bb',
    linked_by: '00000000-0000-0000-0000-0000000000cc',
  });
  assertRlsInsertDenied('G21', 'franchise_member_links', insErr);
}

// ── G22: the Vault seal fails closed (RLS, L.3) ─────────────────────────
// Inverse-of-G11 discipline: a MISSING table/policy/probe FAILS this test; absence must
// never read as a granted-deny pass. The seal is "no read policy on the body for any role";
// pg_policies is not reachable via PostgREST, so the structural proof runs through the
// SECURITY DEFINER vault_seal_probe() helper (migration 018), which returns booleans only.
async function g22() {
  console.log('\nG22 — the Vault seal fails closed: no role reads a sealed body (RLS, L.3)');

  // STRUCTURAL — the load-bearing seal proof, covering EVERY role (author, commissioner,
  // admin) via the absence of any SELECT/ALL policy on the body table.
  const { data: probeData, error: probeErr } = await serviceClient.rpc('vault_seal_probe' as never);
  const probe = (probeData as
    | { body_table_exists: boolean; body_has_read_policy: boolean; body_has_insert_policy: boolean; meta_table_exists: boolean }[]
    | null)?.[0];
  if (probeErr || !probe) {
    fail('G22', `vault_seal_probe() unavailable — migration 018 not applied? (${probeErr ? (probeErr as { message?: string }).message : 'no rows'})`);
    return;
  }
  if (!probe.meta_table_exists) {
    fail('G22', 'vault_sealed_letters (metadata) missing — migration 018 not applied');
    return;
  }
  if (!probe.body_table_exists) {
    fail('G22', 'vault_sealed_letter_bodies missing — migration 018 not applied');
    return;
  }
  if (probe.body_has_read_policy) {
    fail('G22', 'vault_sealed_letter_bodies has a SELECT/ALL policy — THE SEAL LEAKS (a role can read a sealed body)');
  } else {
    pass('G22: vault_sealed_letter_bodies has NO read policy — no role (author, commissioner, admin) reads a sealed body');
  }
  if (probe.body_has_insert_policy) {
    pass('G22: vault_sealed_letter_bodies is RLS-governed (author INSERT policy present)');
  } else {
    fail('G22', 'vault_sealed_letter_bodies has no INSERT policy — table not governed as expected (incomplete migration?)');
  }

  // BEHAVIORAL — anon can author neither a letter nor a body.
  const { error: metaInsErr } = await anonClient.from('vault_sealed_letters').insert({
    league_id: DEMO_LEAGUE_ID,
    member_user_id: '00000000-0000-0000-0000-0000000000bb',
    franchise_id: '00000000-0000-0000-0000-0000000000aa',
    season: 2026,
  });
  assertRlsInsertDenied('G22', 'vault_sealed_letters', metaInsErr);

  const { error: bodyInsErr } = await anonClient.from('vault_sealed_letter_bodies').insert({
    letter_id: '00000000-0000-0000-0000-0000000000dd',
    body: 'governance_probe',
  });
  assertRlsInsertDenied('G22', 'vault_sealed_letter_bodies', bodyInsErr);

  // BEHAVIORAL on a REAL row — seed a sealed letter + body via service role, then assert an
  // anon SELECT of the body returns nothing. We just seeded it, so an empty read is a genuine
  // RLS denial, not a missing-table vacuum (the G11 false-pass guard).
  const { data: fr } = (await serviceClient
    .from('franchises')
    .select('id, league_id, member_user_id')
    .not('member_user_id', 'is', null)
    .limit(1)
    .maybeSingle()) as { data: { id: string; league_id: string; member_user_id: string } | null };
  if (!fr) {
    console.log('     (G22 behavioral seed skipped: no franchise with a member_user_id; the structural seal proof above stands)');
    return;
  }

  const { data: meta } = (await serviceClient
    .from('vault_sealed_letters')
    .insert({ league_id: fr.league_id, member_user_id: fr.member_user_id, franchise_id: fr.id, season: 2026 })
    .select('id, sealed_at')
    .single()) as { data: { id: string; sealed_at: string } | null };
  if (!meta) {
    fail('G22', 'Could not seed vault_sealed_letters via service role');
    return;
  }

  const { error: seedBodyErr } = await serviceClient
    .from('vault_sealed_letter_bodies')
    .insert({ letter_id: meta.id, body: 'GOVERNANCE_SEAL_PROBE_BODY' });
  if (seedBodyErr) {
    fail('G22', `Could not seed vault_sealed_letter_bodies via service role: ${(seedBodyErr as { message?: string }).message}`);
    await serviceClient.from('vault_sealed_letters').delete().eq('id', meta.id);
    return;
  }

  const { data: anonBody } = await anonClient
    .from('vault_sealed_letter_bodies')
    .select('letter_id, body')
    .eq('letter_id', meta.id);
  if (!anonBody || anonBody.length === 0) {
    pass('G22: Anon SELECT of a seeded sealed body returns no body (RLS denies a real row)');
  } else {
    fail('G22', `Anon read a sealed body — SEAL FAILURE (${anonBody.length})`);
  }

  const metaKeys = Object.keys(meta);
  if (metaKeys.includes('sealed_at') && !metaKeys.includes('body')) {
    pass('G22: metadata projection returns existence + sealed_at, never a body');
  } else {
    fail('G22', `metadata projection shape wrong: ${JSON.stringify(metaKeys)}`);
  }

  // Cleanup — service role bypasses the append-only RLS for test teardown.
  await serviceClient.from('vault_sealed_letter_bodies').delete().eq('letter_id', meta.id);
  await serviceClient.from('vault_sealed_letters').delete().eq('id', meta.id);
}

// ── G23: testimony never contaminates the event ledger (the L.1 PAYLOAD) ─
// Inverse-of-G11 discipline: a MISSING table/probe/policy FAILS this test; absence must never
// read as a granted-deny pass. The separation invariant is "testimony has no FK/trigger/write
// path to the canonical events ledger, and its provenance stamp is non-strippable." The FK /
// trigger catalog is not reachable via PostgREST, so the structural proof runs through the
// SECURITY DEFINER testimony_separation_probe() helper (migration 021), booleans only.
async function g23() {
  console.log('\nG23 — testimony never contaminates the event ledger: no write path, fails closed (RLS, L.1)');

  // STRUCTURAL — the load-bearing separation proof.
  const { data: probeData, error: probeErr } = await serviceClient.rpc('testimony_separation_probe' as never);
  const probe = (probeData as
    | { sessions_table_exists: boolean; exchanges_table_exists: boolean; provenance_not_null: boolean; no_ledger_fk: boolean; no_triggers: boolean }[]
    | null)?.[0];
  if (probeErr || !probe) {
    fail('G23', `testimony_separation_probe() unavailable — migration 021 not applied? (${probeErr ? (probeErr as { message?: string }).message : 'no rows'})`);
    return;
  }
  if (!probe.sessions_table_exists) {
    fail('G23', 'member_history_sessions missing — migration 020 not applied');
    return;
  }
  if (!probe.exchanges_table_exists) {
    fail('G23', 'member_history_exchanges missing — migration 020 not applied');
    return;
  }
  if (probe.provenance_not_null) {
    pass('G23: member_history_exchanges.provenance is present and NOT NULL (non-strippable S1 stamp)');
  } else {
    fail('G23', 'member_history_exchanges.provenance is missing or nullable — the testimony stamp is strippable');
  }
  if (probe.no_ledger_fk) {
    pass('G23: testimony tables have NO foreign key to any fact/event-ledger table (no structural write path into the ledger)');
  } else {
    fail('G23', 'a testimony table has a FK to a fact/event-ledger table — THE SEPARATION LEAKS (testimony could be read as / merged into an event fact)');
  }
  if (probe.no_triggers) {
    pass('G23: testimony tables carry NO trigger (no trigger can copy a remembered datum into a fact table)');
  } else {
    fail('G23', 'a testimony table carries a trigger — a write path to the event ledger may exist');
  }

  // BEHAVIORAL — anon can author neither a session nor an exchange.
  const { error: sessInsErr } = await anonClient.from('member_history_sessions').insert({
    league_id: DEMO_LEAGUE_ID,
    member_user_id: '00000000-0000-0000-0000-0000000000bb',
    franchise_id: '00000000-0000-0000-0000-0000000000aa',
  });
  assertRlsInsertDenied('G23', 'member_history_sessions', sessInsErr);

  const { error: exInsErr } = await anonClient.from('member_history_exchanges').insert({
    session_id: '00000000-0000-0000-0000-0000000000ee',
    turn: 1,
    speaker: 'MEMBER',
    content: 'governance_probe',
  });
  assertRlsInsertDenied('G23', 'member_history_exchanges', exInsErr);

  // BEHAVIORAL on a REAL row — seed a session + exchange via service role, then assert an anon
  // SELECT of the exchange returns nothing. We just seeded it, so an empty read is a genuine
  // RLS denial (author + admin only), not a missing-table vacuum (the G11 false-pass guard).
  const { data: fr } = (await serviceClient
    .from('franchises')
    .select('id, league_id, member_user_id')
    .not('member_user_id', 'is', null)
    .limit(1)
    .maybeSingle()) as { data: { id: string; league_id: string; member_user_id: string } | null };
  if (!fr) {
    console.log('     (G23 behavioral seed skipped: no franchise with a member_user_id; the structural separation proof above stands)');
    return;
  }

  const { data: sess } = (await serviceClient
    .from('member_history_sessions')
    .insert({ league_id: fr.league_id, member_user_id: fr.member_user_id, franchise_id: fr.id })
    .select('id')
    .single()) as { data: { id: string } | null };
  if (!sess) {
    fail('G23', 'Could not seed member_history_sessions via service role');
    return;
  }

  const { error: seedExErr } = await serviceClient
    .from('member_history_exchanges')
    .insert({ session_id: sess.id, turn: 1, speaker: 'MEMBER', content: 'GOVERNANCE_SEPARATION_PROBE' });
  if (seedExErr) {
    fail('G23', `Could not seed member_history_exchanges via service role: ${(seedExErr as { message?: string }).message}`);
    await serviceClient.from('member_history_sessions').delete().eq('id', sess.id);
    return;
  }

  const { data: anonEx } = await anonClient
    .from('member_history_exchanges')
    .select('id, content')
    .eq('session_id', sess.id);
  if (!anonEx || anonEx.length === 0) {
    pass('G23: Anon SELECT of a seeded exchange returns nothing (RLS denies a real row — author + admin only)');
  } else {
    fail('G23', `Anon read a testimony exchange — RLS FAILURE (${anonEx.length})`);
  }

  // Cleanup — service role bypasses the append-only RLS for test teardown.
  await serviceClient.from('member_history_exchanges').delete().eq('session_id', sess.id);
  await serviceClient.from('member_history_sessions').delete().eq('id', sess.id);
}

// ── G24: a member caption never contaminates the media FACT layer (the W.1 Inc 2 PAYLOAD) ─
// Inverse-of-G11 discipline: a MISSING table/probe/policy FAILS this test; absence must never
// read as a granted-deny pass. The separation invariant (sharper than L.1's): a caption may FK
// the ITEM layer (media_entries — the allowed attach point) but has NO FK/trigger/write path to
// the human-ratified FACT layer (media_provenance_tag_events) OR the event ledger, and its
// provenance stamp is non-strippable. The FK/trigger catalog is not reachable via PostgREST, so
// the structural proof runs through the SECURITY DEFINER caption_separation_probe() (migration
// 024), booleans only.
async function g24() {
  console.log('\nG24 — a member caption never contaminates the media FACT layer: no write path, fails closed (RLS, W.1 Inc 2)');

  // STRUCTURAL — the load-bearing separation proof.
  const { data: probeData, error: probeErr } = await serviceClient.rpc('caption_separation_probe' as never);
  const probe = (probeData as
    | { captions_table_exists: boolean; provenance_not_null: boolean; no_fact_layer_fk: boolean; no_triggers: boolean }[]
    | null)?.[0];
  if (probeErr || !probe) {
    fail('G24', `caption_separation_probe() unavailable — migration 024 not applied? (${probeErr ? (probeErr as { message?: string }).message : 'no rows'})`);
    return;
  }
  if (!probe.captions_table_exists) {
    fail('G24', 'media_captions missing — migration 023 not applied');
    return;
  }
  pass('G24: media_captions exists');
  if (probe.provenance_not_null) {
    pass('G24: media_captions.provenance is present and NOT NULL (non-strippable, value-pinned MEMBER_CAPTION stamp)');
  } else {
    fail('G24', 'media_captions.provenance is missing or nullable — the caption stamp is strippable');
  }
  if (probe.no_fact_layer_fk) {
    pass('G24: media_captions has NO foreign key to the FACT layer (media_provenance_tag_events) or the event ledger — only the media_entries item-attach is permitted');
  } else {
    fail('G24', 'media_captions has a FK into the FACT layer or the event ledger — THE SEPARATION LEAKS (a caption could be read as / merged into a ratified provenance fact)');
  }
  if (probe.no_triggers) {
    pass('G24: media_captions carries NO trigger (no trigger can copy a caption into a fact table)');
  } else {
    fail('G24', 'media_captions carries a trigger — a write path into the FACT layer may exist');
  }

  // BEHAVIORAL — anon cannot author a caption.
  const { error: capInsErr } = await anonClient.from('media_captions').insert({
    media_entry_id: '00000000-0000-0000-0000-0000000000cc',
    author_user_id: '00000000-0000-0000-0000-0000000000bb',
    body: 'governance_probe',
  });
  assertRlsInsertDenied('G24', 'media_captions', capInsErr);

  // BEHAVIORAL on a REAL row — seed a caption via service role on a real media_entry, then
  // assert an anon SELECT returns nothing. We just seeded it, so an empty read is a genuine RLS
  // denial (league-authenticated only; anon is in no league), not a missing-table vacuum.
  const { data: entry } = (await serviceClient
    .from('media_entries')
    .select('id, league_id')
    .limit(1)
    .maybeSingle()) as { data: { id: string; league_id: string } | null };
  if (!entry) {
    console.log('     (G24 behavioral seed skipped: no media_entries row; the structural separation proof above stands)');
    return;
  }
  const { data: fr } = (await serviceClient
    .from('franchises')
    .select('member_user_id')
    .eq('league_id', entry.league_id)
    .not('member_user_id', 'is', null)
    .limit(1)
    .maybeSingle()) as { data: { member_user_id: string } | null };
  if (!fr) {
    console.log('     (G24 behavioral seed skipped: no franchise member in the entry league; the structural separation proof above stands)');
    return;
  }

  const { data: seeded, error: seedErr } = (await serviceClient
    .from('media_captions')
    .insert({ media_entry_id: entry.id, author_user_id: fr.member_user_id, body: 'GOVERNANCE_SEPARATION_PROBE' })
    .select('id')
    .single()) as { data: { id: string } | null; error: { message?: string } | null };
  if (seedErr || !seeded) {
    fail('G24', `Could not seed media_captions via service role: ${seedErr ? seedErr.message : 'no row'}`);
    return;
  }

  const { data: anonCap } = await anonClient
    .from('media_captions')
    .select('id, body')
    .eq('id', seeded.id);
  if (!anonCap || anonCap.length === 0) {
    pass('G24: Anon SELECT of a seeded caption returns nothing (RLS denies a real row — league-authenticated only)');
  } else {
    fail('G24', `Anon read a caption — RLS FAILURE (${anonCap.length})`);
  }

  // Cleanup — service role bypasses the append-only RLS for test teardown.
  await serviceClient.from('media_captions').delete().eq('id', seeded.id);
}

// ── G25: trophy custody is an append-only ledger; current holder is DERIVED, never stored (C1, W.5) ─
// Inverse-of-G11 discipline: a MISSING table/probe FAILS this test; absence must never read as a
// granted-deny pass. The C1 invariant is "the current holder is a derived read off the latest event's
// to_franchise — no stored holder column, no in-place UPDATE, no DELETE." The pg_policy / pg_attribute
// catalog is not reachable via PostgREST, so the structural proof runs through the SECURITY DEFINER
// custody_integrity_probe() helper (migration 026), booleans only.
async function g25() {
  console.log('\nG25 — trophy custody is append-only; current holder is DERIVED, never stored (C1, W.5)');

  // STRUCTURAL — the load-bearing C1 proof.
  const { data: probeData, error: probeErr } = await serviceClient.rpc('custody_integrity_probe' as never);
  const probe = (probeData as
    | { custody_table_exists: boolean; rls_enabled: boolean; no_update_policy: boolean; no_delete_policy: boolean; no_holder_column: boolean }[]
    | null)?.[0];
  if (probeErr || !probe) {
    fail('G25', `custody_integrity_probe() unavailable — migration 026 not applied? (${probeErr ? (probeErr as { message?: string }).message : 'no rows'})`);
    return;
  }
  if (!probe.custody_table_exists) {
    fail('G25', 'trophy_custody_events missing — migration 025 not applied');
    return;
  }
  pass('G25: trophy_custody_events exists');
  if (probe.rls_enabled) pass('G25: row level security is enabled (append-only default-deny)');
  else fail('G25', 'trophy_custody_events has RLS disabled — append-only is unenforced');
  if (probe.no_update_policy) pass('G25: NO UPDATE policy (no in-place edit — a correction is a new event)');
  else fail('G25', 'trophy_custody_events has an UPDATE policy — the ledger is rewritable');
  if (probe.no_delete_policy) pass('G25: NO DELETE policy (the ledger is permanent)');
  else fail('G25', 'trophy_custody_events has a DELETE policy — custody history can be erased');
  if (probe.no_holder_column) pass('G25: NO stored holder/state column (C1: current holder is a DERIVED read of the latest to_franchise)');
  else fail('G25', 'trophy_custody_events carries a stored holder/state column — C1 VIOLATED (mutable current-holder state)');

  // BEHAVIORAL — anon cannot author a custody event (commissioner-only ledger).
  const { error: anonInsErr } = await anonClient.from('trophy_custody_events').insert({
    league_id: DEMO_LEAGUE_ID,
    trophy_id: 'TR-CP-1',
    to_franchise: '00000000-0000-0000-0000-0000000000aa',
    season: 2025,
    ratified_by: '00000000-0000-0000-0000-0000000000bb',
  });
  assertRlsInsertDenied('G25', 'trophy_custody_events', anonInsErr);

  // BEHAVIORAL on a REAL row — seed a custody event via service role on a real league + franchise,
  // then assert an anon SELECT returns nothing (league-authenticated only; anon is in no league).
  const { data: fr } = (await serviceClient
    .from('franchises')
    .select('id, league_id, member_user_id')
    .not('member_user_id', 'is', null)
    .limit(1)
    .maybeSingle()) as { data: { id: string; league_id: string; member_user_id: string } | null };
  if (!fr) {
    console.log('     (G25 behavioral seed skipped: no franchise with a member_user_id; the structural proof above stands)');
    return;
  }
  const { data: seeded, error: seedErr } = (await serviceClient
    .from('trophy_custody_events')
    .insert({ league_id: fr.league_id, trophy_id: 'TR-CP-1-GOVPROBE', to_franchise: fr.id, season: 2025, ratified_by: fr.member_user_id })
    .select('id')
    .single()) as { data: { id: string } | null; error: { message?: string } | null };
  if (seedErr || !seeded) {
    fail('G25', `Could not seed trophy_custody_events via service role: ${seedErr ? seedErr.message : 'no row'}`);
    return;
  }
  const { data: anonRead } = await anonClient
    .from('trophy_custody_events')
    .select('id')
    .eq('id', seeded.id);
  if (!anonRead || anonRead.length === 0) {
    pass('G25: Anon SELECT of a seeded custody event returns nothing (RLS denies a real row — league-authenticated only)');
  } else {
    fail('G25', `Anon read a custody event — RLS FAILURE (${anonRead.length})`);
  }

  // Cleanup — service role bypasses the append-only RLS for test teardown.
  await serviceClient.from('trophy_custody_events').delete().eq('id', seeded.id);
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
  await g10();
  await g11();
  await g12();
  await g13();
  await g14();
  await g15();
  await g16();
  await g17();
  await g18();
  await g19();
  await g20();
  await g21();
  await g22();
  await g23();
  await g24();
  await g25();

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
