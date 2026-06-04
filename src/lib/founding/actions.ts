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
import type { Database, SessionExchange } from '@/lib/supabase/types';

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
