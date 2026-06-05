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
