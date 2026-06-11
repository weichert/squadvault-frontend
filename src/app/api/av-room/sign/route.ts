// src/app/api/av-room/sign/route.ts
// W.1 A/V Room signed-URL issuance (spec 5.1). Bytes in league-media are NEVER
// served by direct client read - there is no member SELECT policy on the bucket.
// This route mints a short-TTL signed URL for one media entry, server-side, after
// verifying the requester is a member of the entry's league. The display route
// mints photo URLs inline; this endpoint serves on-demand needs (lazy loads, and
// the deferred-video poster path) within the login-gated tree.
//
// Issuance uses the admin client BECAUSE there is no member storage-read policy to
// ride - so the league-membership check here IS the access boundary, applied
// before any URL is produced. TTL is deliberately short.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueMember, isLeagueCommissioner } from '@/lib/av-room';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL_SECONDS = 120;

export async function POST(req: NextRequest) {
  let body: { mediaEntryId?: unknown; variant?: unknown; download?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { mediaEntryId, variant } = body;
  // R4-D2: download mode mints a signed URL of the ORIGINAL (any kind) with a download
  // disposition - the Permanence moat made tangible: the league can always retrieve its
  // own full-resolution history. This is RETRIEVAL, not display/playback, so it signs the
  // original video file too (the image-only / no-playback line governs DISPLAY in the
  // room, not the commissioner pulling back the league's own asset). Commissioner-only in
  // Increment 1 (the room/member download surface rides Inc 2).
  const wantDownload = body.download === true;
  if (typeof mediaEntryId !== 'string' || mediaEntryId.length === 0) {
    return NextResponse.json({ error: 'mediaEntryId is required' }, { status: 400 });
  }
  // R4-D1 quick-look: 'original' (the default - the full-resolution photo) or 'poster'
  // (a video's still). A video's ORIGINAL is never signed for display - the image-only /
  // no-playback line holds; quick-look shows a video's poster, never the .mov.
  const wantPoster = variant === 'poster';

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: entry } = (await admin
    .from('media_entries')
    .select('league_id, storage_path, media_kind')
    .eq('id', mediaEntryId)
    .maybeSingle()) as {
    data: { league_id: string; storage_path: string; media_kind: string } | null;
  };
  if (!entry) return NextResponse.json({ error: 'Media entry not found' }, { status: 404 });

  // Download (full-original retrieval) is commissioner-only in Increment 1; display
  // signing stays league-member (the room reads it).
  if (wantDownload) {
    if (!(await isLeagueCommissioner(admin, entry.league_id, user.id))) {
      return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
    }
  } else if (!(await isLeagueMember(admin, entry.league_id, user.id))) {
    return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });
  }

  const folder = entry.storage_path.slice(0, entry.storage_path.lastIndexOf('/'));
  // Download -> the ORIGINAL (any kind), with a download disposition + friendly filename.
  // Display -> the thumb/poster; a video is NEVER signed as its original bytes for display.
  let path: string;
  let options: { download?: string } | undefined;
  if (wantDownload) {
    path = entry.storage_path;
    const ext = entry.storage_path.slice(entry.storage_path.lastIndexOf('.') + 1) || 'bin';
    options = { download: `squadvault-${mediaEntryId.slice(0, 8)}.${ext}` };
  } else {
    path = wantPoster || entry.media_kind === 'video' ? `${folder}/poster.jpg` : entry.storage_path;
  }

  const { data: signed, error: signErr } = await admin.storage
    .from('league-media')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, options);
  if (signErr || !signed) {
    return NextResponse.json({ error: 'Could not sign URL' }, { status: 502 });
  }

  return NextResponse.json({ url: signed.signedUrl, ttl: SIGNED_URL_TTL_SECONDS });
}
