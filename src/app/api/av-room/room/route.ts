// src/app/api/av-room/room/route.ts
// W.1 A/V Room ratification (spec 5.4) - the fail-closed gate. One commissioner
// act records a room_ratification_event; until one exists, the display route
// renders nothing (6.6). Append-only: a re-ratification after a scope change is a
// new row, never an edit. Commissioner-only via RLS (ratified_by = auth.uid()).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner } from '@/lib/av-room';
import type { Database } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RoomInsert = Database['public']['Tables']['room_ratification_events']['Insert'];

export async function POST(req: NextRequest) {
  let body: { leagueId?: unknown; scope_note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { leagueId } = body;
  if (typeof leagueId !== 'string' || leagueId.length === 0) {
    return NextResponse.json({ error: 'leagueId is required' }, { status: 400 });
  }
  const scopeNote =
    typeof body.scope_note === 'string' && body.scope_note.trim().length > 0
      ? body.scope_note.trim()
      : null;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!(await isLeagueCommissioner(admin, leagueId, user.id))) {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }

  const row: RoomInsert = {
    league_id: leagueId,
    ratified_by: user.id,
    scope_note: scopeNote,
  };
  const { error: insErr } = await supabase
    .from('room_ratification_events')
    .insert(row as never);
  if (insErr) {
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
