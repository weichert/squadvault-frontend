// src/lib/founding/actions.ts
'use server';
//
// Commissioner Founding Session (State 3) — session bootstrap server action.
//
// D9: writes go through the SSR client so RLS (commissioner_user_id =
//     auth.uid()) is the enforcement — no service-role here.
// D10: creation lives in a server action (not a server-component render),
//     invoked from the "Begin" entry. Mutations stay out of render.
//
// Resolve-or-create is idempotent: an existing session for the league is
// resumed rather than duplicated. founding_sessions has no unique(league_id)
// yet, so this guards the common single-commissioner case; a partial unique
// index is the hardening follow-on.

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getLeague } from '@/lib/league';
import { REQUIRED_TOPICS } from '@/lib/founding/protocol';
import { foundingOpeningMessage } from '@/lib/founding/session-prompt';
import { createClient as createUntypedAdmin } from '@supabase/supabase-js';
import { isLegalFoundingTransition } from '@/lib/founding/session-state';
import type {
  Database,
  FoundingSession,
  FoundingSessionState,
  SessionExchange,
} from '@/lib/supabase/types';

export type StartResult = { ok: boolean; error?: string };

type FoundingSessionInsert =
  Database['public']['Tables']['founding_sessions']['Insert'];

export async function startFoundingSession(
  canonicalId: string,
): Promise<StartResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const league = await getLeague(canonicalId);
  if (!league) return { ok: false, error: 'not_found' };
  if (league.status !== 'founding') return { ok: false, error: 'not_founding' };
  if (league.commissioner_user_id !== user.id) {
    return { ok: false, error: 'forbidden' };
  }

  // Idempotent resume.
  const { data: existing } = await supabase
    .from('founding_sessions')
    .select('id')
    .eq('league_id', league.id)
    .limit(1);
  if (existing && existing.length > 0) {
    revalidatePath(`/founding/${canonicalId}`);
    return { ok: true };
  }

  // Seed the canonical opening (spec section 5.2) as turn 1 — deterministic,
  // no model call.
  const opening: SessionExchange = {
    turn: 1,
    role: 'agent',
    content: foundingOpeningMessage(league.name),
    intent_classified: null,
    created_at: new Date().toISOString(),
  };

  const payload: FoundingSessionInsert = {
    league_id: league.id,
    commissioner_user_id: user.id,
    state: 'IN_PROGRESS',
    exchanges: [opening],
    covered_topics: [],
    pending_required_topics: [...REQUIRED_TOPICS],
    consent: { photos: null, voice_recording: null, text_likeness: null },
    voice_profile_selection: null,
    total_tokens_used: 0,
    outputs_generated: false,
    outputs_approved: false,
  };

  // The repo's Database type omits the Views/Enums/CompositeTypes keys
  // supabase-js needs for write-path inference, so .insert() infers `never`
  // (the reason the rest of the repo writes via an untyped client). We keep
  // the SSR client here so RLS stays the enforcement (D9) and contain the
  // cast to the call boundary — `payload` is fully checked against the real
  // Insert type above.
  const { error } = await supabase
    .from('founding_sessions')
    .insert(payload as never);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/founding/${canonicalId}`);
  return { ok: true };
}

export type FoundingOutputStatus = {
  ok: boolean;
  state?: FoundingSessionState;
  outputsGenerated?: boolean;
  artifactId?: string | null;
  approved?: boolean;
  error?: string;
};

// F3-3b: reconcile the output phase for the founding page. Returns current
// status and, once the Founding Artifact is APPROVED, advances the session to
// COMPLETE (edge-guarded). Reads the artifact via service-role admin like the
// generate/approve routes; the founding_sessions write stays on the RLS client.
export async function foundingOutputStatus(
  sessionId: string,
): Promise<FoundingOutputStatus> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data: sessionRow } = await supabase
    .from('founding_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  const session = sessionRow as FoundingSession | null;
  if (!session) return { ok: false, error: 'not_found' };
  if (session.commissioner_user_id !== user.id) {
    return { ok: false, error: 'forbidden' };
  }

  const admin = createUntypedAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: art } = (await admin
    .from('artifacts')
    .select('id, approval_state')
    .eq('league_id', session.league_id)
    .eq('artifact_type', 'FOUNDING')
    .maybeSingle()) as {
    data: { id: string; approval_state: string } | null;
  };

  const approved = art?.approval_state === 'APPROVED';
  let state: FoundingSessionState = session.state;
  if (
    approved &&
    state === 'OUTPUT_GENERATION' &&
    isLegalFoundingTransition('OUTPUT_GENERATION', 'COMPLETE')
  ) {
    await supabase
      .from('founding_sessions')
      .update({ state: 'COMPLETE', outputs_approved: true } as never)
      .eq('id', sessionId);
    // P / completion lifecycle: approving the Founding Artifact opens the
    // Clubhouse. The league home renders LockedRoom while status is 'founding'
    // and the established experience once 'active'; the First Approval Ceremony
    // ("The record is open.") and the founding closing ("Enter the Clubhouse")
    // both presuppose this flip. Service-role write behind the commissioner
    // check above; scoped to status='founding' so it is a one-way, idempotent
    // open that never disturbs an archived or already-open league.
    await admin
      .from('leagues')
      .update({ status: 'active' })
      .eq('id', session.league_id)
      .eq('status', 'founding');
    state = 'COMPLETE';
  }

  return {
    ok: true,
    state,
    outputsGenerated: session.outputs_generated,
    artifactId: art?.id ?? null,
    approved,
  };
}

export async function skipFoundingSession(
  canonicalId: string,
): Promise<StartResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const league = await getLeague(canonicalId);
  if (!league) return { ok: false, error: 'not_found' };
  // Already set up (e.g. a re-click after skipping) is an idempotent no-op.
  if (league.status === 'active') {
    revalidatePath(`/founding/${canonicalId}`);
    return { ok: true };
  }
  if (league.status !== 'founding') return { ok: false, error: 'not_founding' };
  if (league.commissioner_user_id !== user.id) {
    return { ok: false, error: 'forbidden' };
  }

  // Entry-screen skip is for leagues with no session yet (spec section 9.1).
  // If a session already exists the founding page renders the conversation, not
  // the Begin screen, so this path should not be reached; guard anyway.
  const { data: existing } = await supabase
    .from('founding_sessions')
    .select('id')
    .eq('league_id', league.id)
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: false, error: 'session_exists' };
  }

  // B1 / spec section 9.1: skip the founding session. No Founding Artifact, no
  // founding_sessions row, and leagues.voice_profile_id is left null. The voice
  // defaults to MIXED at the recap-time consumer (the engine), matching the
  // founding generate route's `?? 'MIXED'` resolution, so a skipped league
  // behaves like one founded on the MIXED register. The status flip moves the
  // league into the established experience, where the founding session stays
  // re-runnable from the Review Room (B2). Service-role write behind the SSR
  // commissioner check above, mirroring the generate route.
  const admin = createUntypedAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await admin
    .from('leagues')
    .update({ status: 'active' })
    .eq('id', league.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/founding/${canonicalId}`);
  revalidatePath(`/league/${canonicalId}`);
  return { ok: true };
}

export async function retriggerFoundingSession(
  canonicalId: string,
): Promise<StartResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const league = await getLeague(canonicalId);
  if (!league) return { ok: false, error: 'not_found' };
  if (league.commissioner_user_id !== user.id) {
    return { ok: false, error: 'forbidden' };
  }

  // F4-B2 / spec sections 9.1 and 9.4: re-open the founding flow for an
  // already-set-up league. Append-only -- any existing COMPLETE session and the
  // approved Founding Artifact are preserved untouched; nothing is deleted or
  // reset. The founding page resolves the latest session by created_at, so a
  // fresh session drives the conversation while the prior record stays intact.
  // If a non-COMPLETE session already exists, resume it instead of inserting a
  // duplicate (the partial unique index allows at most one active session).
  const { data: active } = await supabase
    .from('founding_sessions')
    .select('id')
    .eq('league_id', league.id)
    .neq('state', 'COMPLETE')
    .limit(1);

  if (!active || active.length === 0) {
    const opening: SessionExchange = {
      turn: 1,
      role: 'agent',
      content: foundingOpeningMessage(league.name),
      intent_classified: null,
      created_at: new Date().toISOString(),
    };
    const payload: FoundingSessionInsert = {
      league_id: league.id,
      commissioner_user_id: user.id,
      state: 'IN_PROGRESS',
      exchanges: [opening],
      covered_topics: [],
      pending_required_topics: [...REQUIRED_TOPICS],
      consent: { photos: null, voice_recording: null, text_likeness: null },
      voice_profile_selection: null,
      total_tokens_used: 0,
      outputs_generated: false,
      outputs_approved: false,
    };
    const { error } = await supabase
      .from('founding_sessions')
      .insert(payload as never);
    if (error) return { ok: false, error: error.message };
  }

  // Re-open the founding flow: the founding page guards on status='founding'.
  // Completion re-opens the Clubhouse via foundingOutputStatus (the P
  // transition). Service-role write behind the commissioner check above.
  const admin = createUntypedAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  await admin
    .from('leagues')
    .update({ status: 'founding' })
    .eq('id', league.id);

  revalidatePath(`/founding/${canonicalId}`);
  revalidatePath(`/league/${canonicalId}`);
  return { ok: true };
}
