// src/app/api/av-room/attest/route.ts
// W.1 D-W1-A: record a voice attestation - a human commissioner's claim about whether a
// video contains a member's voice. This is the OWN class that satisfies the playback
// gate's first disjunct (spec 5.7); option-3 (a soft tag carrying a hard gate) was
// rejected. The attestation is VOICE-ONLY and says nothing about likeness (visual presence
// stays governed by room ratification + 2a).
//
// Append-only: a contrary or superseding claim is a NEW event ('member_voice_present' or a
// fresh 'no_member_voice'), never an edit or delete - the gate reads the LATEST event. The
// EVENT is the claim: it is inserted via the AUTHED client so RLS (INSERT commissioner) is
// the hard guarantee, exactly like the withdrawal/expungement siblings. Event-before-
// effect: the insert must succeed before any UI flip.
//
// NO AI: the attestation is a human commissioner's act, full stop - no audio analysis ever
// proposes or makes one. Commissioner-only this increment (the W.6 deferred posture; member
// grants, including the commissioner's own 2b, wait on E2.3).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner } from '@/lib/av-room';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ATTESTED_STATES = new Set(['no_member_voice', 'member_voice_present']);

export async function POST(req: NextRequest) {
  let body: { mediaEntryId?: unknown; attestedState?: unknown; note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { mediaEntryId, attestedState, note } = body;
  if (typeof mediaEntryId !== 'string' || mediaEntryId.length === 0) {
    return NextResponse.json({ error: 'mediaEntryId is required' }, { status: 400 });
  }
  if (typeof attestedState !== 'string' || !ATTESTED_STATES.has(attestedState)) {
    return NextResponse.json({ error: 'attestedState must be no_member_voice or member_voice_present' }, { status: 400 });
  }
  const noteValue = typeof note === 'string' && note.trim().length > 0 ? note.trim() : null;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: entry } = (await admin
    .from('media_entries')
    .select('league_id, media_kind')
    .eq('id', mediaEntryId)
    .maybeSingle()) as { data: { league_id: string; media_kind: string } | null };
  if (!entry) {
    return NextResponse.json({ error: 'Media entry not found' }, { status: 404 });
  }
  if (entry.media_kind !== 'video') {
    return NextResponse.json({ error: 'Voice attestation applies to video only' }, { status: 400 });
  }
  if (!(await isLeagueCommissioner(admin, entry.league_id, user.id))) {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }

  // The event is the claim. Authed insert (RLS INSERT-commissioner is the hard guarantee).
  // Graceful 503 until migration 015 is applied (the 012/G17 rhythm).
  const { error: insErr } = await supabase
    .from('media_voice_attestations')
    .insert({ league_id: entry.league_id, media_entry_id: mediaEntryId, attested_state: attestedState, attested_by: user.id, note: noteValue } as never);
  if (insErr) {
    if ((insErr as { code?: string }).code === '42P01') {
      return NextResponse.json({ error: 'Voice attestation is not enabled yet (migration 015 not applied).' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Could not record the attestation.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
