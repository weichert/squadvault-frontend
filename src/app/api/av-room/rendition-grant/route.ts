// src/app/api/av-room/rendition-grant/route.ts
// W.1 D-W1-A6: mint a client-direct upload grant for a video's PLAYBACK RENDITION
// (playback.mp4, H.264/AAC). The remedy-B pattern (Spec 5.1 Amendment 1): the bytes flow
// CLIENT-DIRECT to Storage, never through a function body - a 1080p H.264 rendition exceeds
// the 4.5 MB edge limit by an order of magnitude, so the poster route's multipart shape is
// structurally unavailable. This route carries NO bytes; it does the commissioner
// authorization and mints a single-path upsert grant.
//
// The rendition is a DERIVED sibling in poster.jpg's governance class (6.9): regenerable,
// replaceable (upsert), never a fact - no media_entries row, no finalize, filesystem
// presence IS the state. The SERVER names the path {folder}/playback.mp4 from the entry's
// stored original path; the client never names paths. Commissioner-only; video entries only.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner } from '@/lib/av-room';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { mediaEntryId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { mediaEntryId } = body;
  if (typeof mediaEntryId !== 'string' || mediaEntryId.length === 0) {
    return NextResponse.json({ error: 'mediaEntryId is required' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: entry } = (await admin
    .from('media_entries')
    .select('league_id, media_kind, storage_path')
    .eq('id', mediaEntryId)
    .maybeSingle()) as {
    data: { league_id: string; media_kind: string; storage_path: string } | null;
  };
  if (!entry) {
    return NextResponse.json({ error: 'Media entry not found' }, { status: 404 });
  }
  if (entry.media_kind !== 'video') {
    return NextResponse.json({ error: 'Renditions apply to video only' }, { status: 400 });
  }
  if (!(await isLeagueCommissioner(admin, entry.league_id, user.id))) {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }

  // Server-named, by-convention sibling path (derived from the authoritative stored path).
  // upsert: a better rendition replaces an earlier one (Set-Poster precedent, no append-only
  // concern). The grant is scoped to exactly this one path within the entry's league prefix.
  const folder = entry.storage_path.slice(0, entry.storage_path.lastIndexOf('/'));
  const path = `${folder}/playback.mp4`;
  const { data: grant, error: grantErr } = await admin.storage
    .from('league-media')
    .createSignedUploadUrl(path, { upsert: true });
  if (grantErr || !grant) {
    return NextResponse.json({ error: 'Could not mint a rendition upload grant' }, { status: 502 });
  }

  return NextResponse.json({ path: grant.path, token: grant.token, signedUrl: grant.signedUrl });
}
