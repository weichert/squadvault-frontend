// src/app/api/trophy-room/custody/route.ts
// W.5 Trophy Room - the Belt manual-ratify path (spec section 8.1; build brief unit 3). The
// commissioner ratifies one custody transfer of a traveling trophy - a per-championship handoff or
// a historical backfill row (the same dignity as oral history). Every row is a COMMISSIONER-ratified
// manual fact (the Manual Fact Import frame).
//
// GOVERNANCE: commissioner-only. ratified_by is taken from the authenticated session, never the
// body; the RLS INSERT policy ((is_commissioner OR is_admin) AND ratified_by = auth.uid()) is the
// hard guarantee - member and anon have no write path. Approval is a PUBLICATION GATE, not a
// fact-creation step: the commissioner records a fact that happened, the derived holder reads it.
// Append-only: this route only ever INSERTs; a correction is a new event (no UPDATE/DELETE exists).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner } from '@/lib/av-room';
import { TROPHY_BELT_ID } from '@/lib/trophy-room';
import type { Database } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CustodyInsert = Database['public']['Tables']['trophy_custody_events']['Insert'];

export async function POST(req: NextRequest) {
  let body: {
    leagueId?: unknown;
    trophyId?: unknown;
    toFranchise?: unknown;
    fromFranchise?: unknown;
    occasion?: unknown;
    season?: unknown;
    week?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const leagueId = typeof body.leagueId === 'string' ? body.leagueId : '';
  if (!leagueId) return NextResponse.json({ error: 'A leagueId is required.' }, { status: 400 });

  // trophy_id defaults to the Belt (the only Championship Package custody trophy); a non-empty code.
  const trophyId =
    typeof body.trophyId === 'string' && body.trophyId.trim().length > 0
      ? body.trophyId.trim()
      : TROPHY_BELT_ID;

  const toFranchise = typeof body.toFranchise === 'string' ? body.toFranchise : '';
  if (!toFranchise) {
    return NextResponse.json({ error: 'toFranchise (the new holder) is required.' }, { status: 400 });
  }
  const fromFranchise =
    typeof body.fromFranchise === 'string' && body.fromFranchise.length > 0 ? body.fromFranchise : null;

  const season = typeof body.season === 'number' && Number.isInteger(body.season) ? body.season : null;
  if (season === null) {
    return NextResponse.json({ error: 'A season (integer) is required.' }, { status: 400 });
  }
  const week =
    typeof body.week === 'number' && Number.isInteger(body.week) ? body.week : null;
  const occasion =
    typeof body.occasion === 'string' && body.occasion.trim().length > 0 ? body.occasion.trim() : null;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Commissioner gate against the league (the RLS INSERT is the hard guarantee; this gives a clean
  // 403 and lets us validate the franchises belong to the league).
  const admin = createAdminClient();
  if (!(await isLeagueCommissioner(admin, leagueId, user.id))) {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }

  // The holder(s) must be franchises IN this league (no cross-league custody).
  const refIds = fromFranchise ? [toFranchise, fromFranchise] : [toFranchise];
  const { data: frRows } = (await admin
    .from('franchises')
    .select('id')
    .eq('league_id', leagueId)
    .in('id', refIds)) as { data: { id: string }[] | null };
  const found = new Set((frRows ?? []).map((f) => f.id));
  if (!found.has(toFranchise)) {
    return NextResponse.json({ error: 'toFranchise is not a franchise in this league.' }, { status: 400 });
  }
  if (fromFranchise && !found.has(fromFranchise)) {
    return NextResponse.json({ error: 'fromFranchise is not a franchise in this league.' }, { status: 400 });
  }
  if (fromFranchise && fromFranchise === toFranchise) {
    return NextResponse.json({ error: 'A transfer cannot be from and to the same franchise.' }, { status: 400 });
  }

  // INSERT via the authed client so RLS is the enforcer. ratified_by = the acting commissioner.
  const row: CustodyInsert = {
    league_id: leagueId,
    trophy_id: trophyId,
    from_franchise: fromFranchise,
    to_franchise: toFranchise,
    occasion,
    season,
    week,
    ratified_by: user.id,
  };
  const { data: created, error: insErr } = (await supabase
    .from('trophy_custody_events')
    .insert(row as never)
    .select('id, ratified_at')
    .single()) as { data: { id: string; ratified_at: string } | null; error: unknown };
  if (insErr || !created) {
    return NextResponse.json({ error: 'Could not record the custody event.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eventId: created.id, ratified_at: created.ratified_at });
}
