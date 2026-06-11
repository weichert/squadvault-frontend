// src/app/api/av-room/withdraw/route.ts
// W.1 A/V Room display withdrawal (spec 5.5) - item-scoped removal from forward
// rendering; the record stands (never deletion, 6.9). Increment 1 is commissioner-
// authored: the commissioner both requests and ratifies, so the withdrawal is
// effective at insert (carry-forward note 3) - requested_by AND ratified_by are
// the acting commissioner. Append-only; a future reinstatement is a later unit's
// decision, not an edit of this row.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner } from '@/lib/av-room';
import type { Database } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WithdrawalInsert = Database['public']['Tables']['media_display_withdrawals']['Insert'];

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

  // The parent entry resolves the league (and carries league_id onto the
  // withdrawal row so RLS league-scoping holds even when media_entry_id is null
  // for later units).
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

  const row: WithdrawalInsert = {
    league_id: entry.league_id,
    media_entry_id: mediaEntryId,
    requested_by: user.id,
    ratified_by: user.id,
    note,
  };
  const { error: insErr } = await supabase
    .from('media_display_withdrawals')
    .insert(row as never);
  if (insErr) {
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
