// src/app/api/av-room/caption/route.ts
//
// W.1 Increment 2 member captions (spec engine 905cb1c, sections 5.6 + 5.7; D-W1I2-3,5,6).
// Captures one member-authored CAPTION on an A/V Room media item. The constitutional ORDER
// (invariant 6.4 — GRANT precedes capture):
//   1. record the media_caption consent GRANT (member_consent_events, append-only) if not
//      already current;
//   2. insert the media_captions row (append-only; provenance stamped at the DB layer).
// No caption is ever stored without a prior GRANT; absence = no capture (fail-closed).
//
// MEMBER-ONLY, NO PROXY (invariant 6.5, W.6 1.3): author_user_id is taken from the
// authenticated session, never the body; the RLS INSERT policy (author_user_id = auth.uid()
// AND the parent item is in the author's own league) is the hard guarantee. The commissioner
// cannot author or proxy a caption. The route gates the GRANT; RLS gates ownership +
// append-only (the L.1 route-enforced precedent).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ConsentInsert = Database['public']['Tables']['member_consent_events']['Insert'];
type CaptionInsert = Database['public']['Tables']['media_captions']['Insert'];

const MAX_BODY = 2000;

export async function POST(req: NextRequest) {
  let body: { mediaEntryId?: unknown; body?: unknown; grantConsent?: unknown; supersedes?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const mediaEntryId = typeof body.mediaEntryId === 'string' ? body.mediaEntryId : '';
  if (!mediaEntryId) {
    return NextResponse.json({ error: 'A mediaEntryId is required.' }, { status: 400 });
  }
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'A caption body is required.' }, { status: 400 });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: `A caption may be at most ${MAX_BODY} characters.` }, { status: 400 });
  }
  const supersedes =
    typeof body.supersedes === 'string' && body.supersedes.length > 0 ? body.supersedes : null;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Resolve the parent item's league, and confirm the author is a franchise-linked MEMBER of
  // it (no commissioner proxy: the commissioner is not a captioning member). The member-only
  // RLS INSERT is the hard guarantee; this gives a clean 4xx and the league for the grant row.
  const admin = createAdminClient();
  const { data: entry } = (await admin
    .from('media_entries')
    .select('id, league_id')
    .eq('id', mediaEntryId)
    .maybeSingle()) as { data: { id: string; league_id: string } | null };
  if (!entry) return NextResponse.json({ error: 'Media entry not found' }, { status: 404 });

  const { data: fr } = (await admin
    .from('franchises')
    .select('id')
    .eq('league_id', entry.league_id)
    .eq('member_user_id', user.id)
    .limit(1)
    .maybeSingle()) as { data: { id: string } | null };
  if (!fr) {
    return NextResponse.json(
      { error: 'Only a franchise-linked member of this league may caption an item.' },
      { status: 403 },
    );
  }

  // A supersedes target must be a caption on the SAME entry (a correction is scoped to its own
  // item; you cannot retarget another item's caption).
  if (supersedes) {
    const { data: prior } = (await admin
      .from('media_captions')
      .select('id, media_entry_id')
      .eq('id', supersedes)
      .maybeSingle()) as { data: { id: string; media_entry_id: string } | null };
    if (!prior || prior.media_entry_id !== mediaEntryId) {
      return NextResponse.json({ error: 'Invalid supersedes target' }, { status: 400 });
    }
  }

  // GRANT precedes capture (6.4): the caption cannot be stored without an affirmed grant.
  if (body.grantConsent !== true) {
    return NextResponse.json(
      { error: 'The media_caption consent grant is required before a caption is captured.' },
      { status: 400 },
    );
  }

  // 1. Record the GRANT — but only if not already current (the log is append-only; a current
  // GRANT need not be re-asserted). Member-authored (RLS member-only).
  const { data: cur } = (await supabase
    .from('member_consent_current')
    .select('current_state')
    .eq('member_user_id', user.id)
    .eq('category', 'media_caption')
    .maybeSingle()) as { data: { current_state: string } | null };
  if (cur?.current_state !== 'GRANT') {
    const consent: ConsentInsert = {
      member_user_id: user.id,
      league_id: entry.league_id,
      event_type: 'GRANT',
      category: 'media_caption',
      rendering_class: null,
      context: 'av_room_caption',
      note: null,
    };
    const { error: consentErr } = await supabase
      .from('member_consent_events')
      .insert(consent as never);
    if (consentErr) {
      return NextResponse.json({ error: 'Could not record the consent grant.' }, { status: 500 });
    }
  }

  // 2. The caption row (append-only). provenance defaults to the MEMBER_CAPTION stamp at the DB
  // layer. RLS: author_user_id = auth.uid() AND the parent item is in the author's own league.
  const row: CaptionInsert = {
    media_entry_id: mediaEntryId,
    author_user_id: user.id,
    body: text,
    supersedes,
  };
  const { data: created, error: insErr } = (await supabase
    .from('media_captions')
    .insert(row as never)
    .select('id, recorded_at')
    .single()) as { data: { id: string; recorded_at: string } | null; error: unknown };
  if (insErr || !created) {
    return NextResponse.json({ error: 'Could not store the caption.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, captionId: created.id, recorded_at: created.recorded_at });
}
