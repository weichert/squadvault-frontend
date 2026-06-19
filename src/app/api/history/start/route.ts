// src/app/api/history/start/route.ts
//
// L.1 Historian Interviews (capture-only first wave; spec engine c9d32d5, sections 5.3 + 5.7).
// Begins a member's oral-history interview. The constitutional ORDER (S4, invariant 6.4 —
// GRANT precedes capture):
//   1. record the oral_history_testimony consent GRANT (member_consent_events, append-only)
//   2. insert the member_history_sessions metadata row (insert-once)
//   3. insert the opening HISTORIAN exchange (turn 1)
// No exchange is ever stored without a prior GRANT. Idempotent resume: an existing
// IN_PROGRESS interview for this member + league is returned, not duplicated.
//
// MEMBER-ONLY, NO PROXY (invariant 6.5, W.6 1.3): member_user_id is taken from the
// authenticated session, never the body; the RLS INSERT policies (member_user_id =
// auth.uid()) are the hard guarantee. The commissioner cannot author, consent, or proxy.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { historianOpeningMessage } from '@/lib/history/session-prompt';
import type {
  Database,
  MemberHistoryExchange,
} from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ConsentInsert = Database['public']['Tables']['member_consent_events']['Insert'];
type SessionInsert = Database['public']['Tables']['member_history_sessions']['Insert'];
type ExchangeInsert = Database['public']['Tables']['member_history_exchanges']['Insert'];

type ExchangeView = Pick<
  MemberHistoryExchange,
  'turn' | 'speaker' | 'content' | 'intent_classified' | 'topic_covered'
>;

const EXCHANGE_COLS = 'turn, speaker, content, intent_classified, topic_covered';

export async function POST(req: NextRequest) {
  let body: { leagueId?: unknown; grantConsent?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const leagueId = typeof body.leagueId === 'string' ? body.leagueId : '';
  if (!leagueId) {
    return NextResponse.json({ error: 'A leagueId is required.' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // The member's franchise in this league (the franchise_member_links identity key, surfaced
  // via the franchises.member_user_id pointer). Only a franchise-linked member may be
  // interviewed; the commissioner-only or unlinked actor has no franchise here.
  const admin = createAdminClient();
  const { data: fr } = (await admin
    .from('franchises')
    .select('id, league_id, owner_display_name')
    .eq('league_id', leagueId)
    .eq('member_user_id', user.id)
    .limit(1)
    .maybeSingle()) as {
    data: { id: string; league_id: string; owner_display_name: string } | null;
  };
  if (!fr) {
    return NextResponse.json(
      { error: 'No linked franchise for this member; cannot begin an interview.' },
      { status: 403 },
    );
  }

  // Idempotent resume: an existing IN_PROGRESS interview is returned untouched (RLS scopes to
  // the author). The capture surface picks up exactly where it left off.
  const { data: existing } = (await supabase
    .from('member_history_sessions')
    .select('id')
    .eq('member_user_id', user.id)
    .eq('league_id', fr.league_id)
    .eq('state', 'IN_PROGRESS')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { id: string } | null };
  if (existing) {
    const { data: rows } = (await supabase
      .from('member_history_exchanges')
      .select(EXCHANGE_COLS)
      .eq('session_id', existing.id)
      .order('turn', { ascending: true })) as { data: ExchangeView[] | null };
    return NextResponse.json({ sessionId: existing.id, exchanges: rows ?? [], resumed: true });
  }

  // GRANT precedes capture (S4): the interview cannot begin without it.
  if (body.grantConsent !== true) {
    return NextResponse.json(
      { error: 'The oral_history_testimony consent grant is required before the interview begins.' },
      { status: 400 },
    );
  }

  // 1. Record the GRANT — but only if not already current (the log is append-only; a current
  // GRANT need not be re-asserted). Member-authored (RLS member-only).
  const { data: cur } = (await supabase
    .from('member_consent_current')
    .select('current_state')
    .eq('member_user_id', user.id)
    .eq('category', 'oral_history_testimony')
    .maybeSingle()) as { data: { current_state: string } | null };
  if (cur?.current_state !== 'GRANT') {
    const consent: ConsentInsert = {
      member_user_id: user.id,
      league_id: fr.league_id,
      event_type: 'GRANT',
      category: 'oral_history_testimony',
      rendering_class: null,
      context: 'historian_interview',
      note: null,
    };
    const { error: consentErr } = await supabase
      .from('member_consent_events')
      .insert(consent as never);
    if (consentErr) {
      return NextResponse.json({ error: 'Could not record the consent grant.' }, { status: 500 });
    }
  }

  // 2. The interview metadata row (insert-once). RLS: member-only, own league + own franchise.
  const sessionRow: SessionInsert = {
    league_id: fr.league_id,
    member_user_id: user.id,
    franchise_id: fr.id,
  };
  const { data: created, error: sessErr } = (await supabase
    .from('member_history_sessions')
    .insert(sessionRow as never)
    .select('id')
    .single()) as { data: { id: string } | null; error: unknown };
  if (sessErr || !created) {
    return NextResponse.json({ error: 'Could not begin the interview.' }, { status: 500 });
  }

  // 3. The opening HISTORIAN exchange (turn 1) — the onboarding hook. Deterministic, no model
  // call. provenance defaults to the MEMBER_TESTIMONY stamp at the DB layer.
  const leagueName = await leagueNameOf(admin, fr.league_id);
  const opening: ExchangeInsert = {
    session_id: created.id,
    turn: 1,
    speaker: 'HISTORIAN',
    content: historianOpeningMessage({ memberName: fr.owner_display_name, leagueName }),
    intent_classified: null,
    topic_covered: null,
  };
  const { error: openErr } = await supabase
    .from('member_history_exchanges')
    .insert(opening as never);
  if (openErr) {
    return NextResponse.json(
      { error: 'The interview began but the opening did not persist; please reopen.' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    sessionId: created.id,
    exchanges: [
      {
        turn: 1,
        speaker: 'HISTORIAN',
        content: opening.content,
        intent_classified: null,
        topic_covered: null,
      },
    ],
    resumed: false,
  });
}

async function leagueNameOf(
  admin: ReturnType<typeof createAdminClient>,
  leagueId: string,
): Promise<string | null> {
  const { data } = (await admin
    .from('leagues')
    .select('name')
    .eq('id', leagueId)
    .maybeSingle()) as { data: { name: string } | null };
  return data?.name ?? null;
}
