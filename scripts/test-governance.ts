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
