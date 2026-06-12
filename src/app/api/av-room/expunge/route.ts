// src/app/api/av-room/expunge/route.ts
// W.1 D-W1-E1 (Spec 5.2 Amendment 1): media EXPUNGEMENT - the ruled exception to byte
// immutability. The sequence is constitutional, not incidental:
//   1. The commissioner is authorized (the boundary).
//   2. An append-only expungement EVENT is inserted via the AUTHED client (RLS-backed,
//      INSERT-commissioner). The EVENT IS THE LICENSE: byte deletion is legitimate only
//      because this row testifies, permanently, that the item existed and was expunged
//      (when / by whom / why). If the event cannot be written, NOTHING is deleted.
//   3. Only then are the stored BYTES deleted via the ADMIN client - original + thumb +
//      poster. The admin client is the instrument of the ruled exception; the event row
//      is its license. The media_entries ROW is never deleted (tombstone); content_hash
//      survives so re-upload surfaces as a duplicate-of-expunged.
// Terminal by design: there is no reinstatement (reinstating content whose bytes are gone
// is incoherent). Commissioner-only in Increment 1; the post-E2.3 consent dimension is
// deferred to Increment 2.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner } from '@/lib/av-room';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { mediaEntryId?: unknown; reason?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { mediaEntryId, reason } = body;
  if (typeof mediaEntryId !== 'string' || mediaEntryId.length === 0) {
    return NextResponse.json({ error: 'mediaEntryId is required' }, { status: 400 });
  }
  // Reason is REQUIRED (the ruling): an expungement must say why.
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    return NextResponse.json({ error: 'A reason is required to expunge an item.' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: entry } = (await admin
    .from('media_entries')
    .select('league_id, storage_path')
    .eq('id', mediaEntryId)
    .maybeSingle()) as { data: { league_id: string; storage_path: string } | null };
  if (!entry) {
    return NextResponse.json({ error: 'Media entry not found' }, { status: 404 });
  }
  if (!(await isLeagueCommissioner(admin, entry.league_id, user.id))) {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }

  // The event is the license. Authed insert (RLS-backed). If migration 014 is not applied
  // yet, the table is absent - report it plainly and delete NOTHING (the 012/G17 rhythm).
  const { error: insErr } = await supabase
    .from('media_expungement_events')
    .insert({ league_id: entry.league_id, media_entry_id: mediaEntryId, reason: reason.trim(), expunged_by: user.id } as never);
  if (insErr) {
    const code = (insErr as { code?: string }).code;
    if (code === '42P01') {
      return NextResponse.json({ error: 'Expungement is not enabled yet (migration 014 not applied).' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Could not record the expungement.' }, { status: 502 });
  }

  // License granted -> destroy the bytes. Best-effort: the event stands regardless, and a
  // straggler object with no readable reference is reapable by the hygiene sweep.
  const folder = entry.storage_path.slice(0, entry.storage_path.lastIndexOf('/'));
  await admin.storage
    .from('league-media')
    .remove([entry.storage_path, `${folder}/thumb.jpg`, `${folder}/poster.jpg`]);

  return NextResponse.json({ ok: true });
}
