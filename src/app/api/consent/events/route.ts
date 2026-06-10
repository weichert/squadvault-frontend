// src/app/api/consent/events/route.ts
//
// W.6 Consent Governance Memo (ratified 2026-06-10) — the member consent write
// path. Records one GRANT/REVOKE event in member_consent_events (the append-only
// system of record, D-V). MEMBER-ONLY: member_user_id is taken from the
// authenticated session, never the request body, and the RLS INSERT policy
// (member_user_id = auth.uid()) is the hard guarantee — no commissioner/admin
// proxy (W.6 section 1.3). Append-only: this route only ever inserts; a
// correction is a new REVOKE/GRANT, never an edit.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import type {
  Database,
  MemberConsentCategory,
  MemberConsentEventType,
} from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MemberConsentInsert =
  Database['public']['Tables']['member_consent_events']['Insert'];

const CATEGORIES: MemberConsentCategory[] = [
  'media_appearance',
  'recorded_voice',
  'likeness_derived',
  'attributed_quotes',
  'synthesized_voice',
];
const EVENT_TYPES: MemberConsentEventType[] = ['GRANT', 'REVOKE'];

export async function POST(req: NextRequest) {
  let body: {
    leagueId?: unknown;
    category?: unknown;
    event_type?: unknown;
    rendering_class?: unknown;
    context?: unknown;
    note?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { leagueId, category, event_type: eventType, context } = body;
  const renderingClass = body.rendering_class ?? null;
  const note = body.note ?? null;

  if (
    typeof leagueId !== 'string' ||
    typeof category !== 'string' ||
    !CATEGORIES.includes(category as MemberConsentCategory) ||
    typeof eventType !== 'string' ||
    !EVENT_TYPES.includes(eventType as MemberConsentEventType) ||
    typeof context !== 'string' ||
    context.length === 0
  ) {
    return NextResponse.json({ error: 'Invalid consent fields' }, { status: 400 });
  }

  // 2e (synthesized_voice) is scoped per rendering class; required iff that
  // category, forbidden otherwise — mirrors the DB CHECK constraint.
  const isSynth = category === 'synthesized_voice';
  if (isSynth && (typeof renderingClass !== 'string' || renderingClass.length === 0)) {
    return NextResponse.json(
      { error: 'synthesized_voice requires a rendering_class' },
      { status: 400 },
    );
  }
  if (!isSynth && renderingClass !== null) {
    return NextResponse.json(
      { error: 'rendering_class is only valid for synthesized_voice' },
      { status: 400 },
    );
  }
  if (note !== null && typeof note !== 'string') {
    return NextResponse.json({ error: 'Invalid note' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only a member of this league (the commissioner, or a franchise member once
  // onboarding links member_user_id) may record consent within it. The subject
  // is always the authenticated user themselves.
  const admin = createAdminClient();
  const { data: lg } = (await admin
    .from('leagues')
    .select('commissioner_user_id')
    .eq('id', leagueId)
    .maybeSingle()) as { data: { commissioner_user_id: string | null } | null };
  let belongs = !!lg && lg.commissioner_user_id === user.id;
  if (!belongs) {
    const { data: fr } = (await admin
      .from('franchises')
      .select('id')
      .eq('league_id', leagueId)
      .eq('member_user_id', user.id)
      .limit(1)
      .maybeSingle()) as { data: { id: string } | null };
    belongs = !!fr;
  }
  if (!belongs) {
    return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });
  }

  const row: MemberConsentInsert = {
    member_user_id: user.id,
    league_id: leagueId,
    event_type: eventType as MemberConsentEventType,
    category: category as MemberConsentCategory,
    rendering_class: isSynth ? (renderingClass as string) : null,
    context,
    note: note as string | null,
  };

  const { error: insErr } = await supabase
    .from('member_consent_events')
    .insert(row as never);
  if (insErr) {
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
