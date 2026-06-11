// src/app/api/av-room/reinstate/route.ts
// W.1 A/V Room reinstatement (spec 5.5 / D5) - restore a withdrawn item to forward
// display. Append-only sibling of the withdrawal: this appends a NEW event that
// reverses the latest standing withdrawal; it never edits or deletes the withdrawal.
// The read-model treats an item as withdrawn iff its latest withdrawal postdates its
// latest reinstatement, so this row flips it back. Commissioner-only in Increment 1.
//
// SPEC NOTE (D5): post-E2.3, a member-requested withdrawal may not be reinstated by
// the commissioner alone - that requires the member's renewed consent, enforced with
// Increment 2. The commissioner-only Increment 1 case here is self-consistent.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner } from '@/lib/av-room';
import type { Database } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReinstatementInsert = Database['public']['Tables']['media_display_reinstatements']['Insert'];

export async function POST(req: NextRequest) {
  let body: { mediaEntryId?: unknown; note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { mediaEntryId } = body;
  if (typeof mediaEntryId !== 'string' || mediaEntryId.length === 0) {
    return NextResponse.json({ error: 'mediaEntryId is required' }, { status: 400 });
  }
  const note =
    typeof body.note === 'string' && body.note.trim().length > 0 ? body.note.trim() : null;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: entry } = (await admin
    .from('media_entries')
    .select('id, league_id')
    .eq('id', mediaEntryId)
    .maybeSingle()) as { data: { id: string; league_id: string } | null };
  if (!entry) return NextResponse.json({ error: 'Media entry not found' }, { status: 404 });
  if (!(await isLeagueCommissioner(admin, entry.league_id, user.id))) {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }

  // The latest withdrawal is the one being reversed (and proves the item is
  // withdrawable). Newest first.
  const { data: latestW } = (await admin
    .from('media_display_withdrawals')
    .select('id, recorded_at')
    .eq('media_entry_id', mediaEntryId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { id: string; recorded_at: string } | null };
  if (!latestW) {
    return NextResponse.json({ error: 'This item has never been withdrawn.' }, { status: 400 });
  }

  // Guard: only reinstate an item that is CURRENTLY withdrawn (latest withdrawal
  // postdates any latest reinstatement) - no redundant reinstatement events.
  const { data: latestR } = (await admin
    .from('media_display_reinstatements')
    .select('recorded_at')
    .eq('media_entry_id', mediaEntryId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { recorded_at: string } | null };
  if (latestR && latestR.recorded_at > latestW.recorded_at) {
    return NextResponse.json({ error: 'This item is already showing.' }, { status: 400 });
  }

  const row: ReinstatementInsert = {
    league_id: entry.league_id,
    media_entry_id: mediaEntryId,
    withdrawal_id: latestW.id,
    reinstated_by: user.id,
    note,
  };
  const { error: insErr } = await supabase
    .from('media_display_reinstatements')
    .insert(row as never);
  if (insErr) {
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
