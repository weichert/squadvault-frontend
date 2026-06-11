// src/app/api/av-room/upload/grant/route.ts
// W.1 A/V Room - the grant-mint route (D-W1-V1 remedy B, Spec 5.1 Amendment 1).
// Under the amendment the bytes flow CLIENT-DIRECT to Storage, so this route does
// NOT carry them. It performs the SAME commissioner authorization as the old
// passthrough (clause a), mints the media_entry_id and the server-chosen object
// path (clause b - the client never names paths), and issues a single-use signed
// upload grant scoped to that one path. The record itself is finalized later, by
// the finalize route, only after the upload completes (clause c).
//
// The write boundary moves here: because a signed-upload token authorizes its own
// write (it does not ride storage.objects RLS), the commissioner check + the
// server-chosen path in THIS route are the security guarantee that a commissioner
// can only ever obtain a grant for their own league's prefix. The cross-league
// mint test (G16) plants exactly that.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner, EXT_BY_MIME, mediaKindForMime } from '@/lib/av-room';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, formatSize } from '@/lib/av-room-limits';
import type { MediaKind } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MEDIA_KINDS: MediaKind[] = ['photo', 'video'];

export async function POST(req: NextRequest) {
  let body: { leagueId?: unknown; media_kind?: unknown; mime?: unknown; size?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { leagueId, media_kind: mediaKind, mime, size } = body;
  if (typeof leagueId !== 'string' || leagueId.length === 0) {
    return NextResponse.json({ error: 'leagueId is required' }, { status: 400 });
  }
  if (typeof mediaKind !== 'string' || !MEDIA_KINDS.includes(mediaKind as MediaKind)) {
    return NextResponse.json({ error: 'media_kind must be photo or video' }, { status: 400 });
  }
  if (typeof mime !== 'string') {
    return NextResponse.json({ error: 'mime is required' }, { status: 400 });
  }
  // D6 backstop: HEIC/HEIF gets a specific, actionable reason (browsers can't render
  // it) rather than the generic unsupported-type message; the client refuses it first.
  if (mime === 'image/heic' || mime === 'image/heif') {
    return NextResponse.json(
      { error: 'HEIC/HEIF photos are not supported. Export the photo as JPEG and upload that.' },
      { status: 415 },
    );
  }
  const ext = EXT_BY_MIME[mime];
  if (!ext) {
    return NextResponse.json({ error: `Unsupported file type: ${mime || 'unknown'}` }, { status: 400 });
  }
  // The declared kind must match the file's actual media type - no photo bytes filed
  // as video (which would then ride the deferred video gate) or vice versa.
  if (mediaKindForMime(mime) !== mediaKind) {
    return NextResponse.json({ error: `File type ${mime} does not match media_kind ${mediaKind}` }, { status: 400 });
  }
  // Honest ceiling, server-side (the bytes go direct to Storage, but we reject an
  // over-cap declared size before minting so the commissioner gets a clean reason
  // rather than a raw Storage error mid-upload). Storage's own 1 GB cap is the
  // backstop if the declared size is understated.
  if (typeof size === 'number' && size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `This file is ${formatSize(size)}; the limit is ${MAX_UPLOAD_LABEL}.` },
      { status: 413 },
    );
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!(await isLeagueCommissioner(admin, leagueId, user.id))) {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }

  // Server mints BOTH the id and the path; the client receives them, it never names
  // them. The path's first segment is leagueId, so the grant is inherently scoped to
  // this commissioner's league (clause b).
  const mediaEntryId = crypto.randomUUID();
  const path = `${leagueId}/${mediaEntryId}/original.${ext}`;

  const { data: grant, error: grantErr } = await admin.storage
    .from('league-media')
    .createSignedUploadUrl(path);
  if (grantErr || !grant) {
    return NextResponse.json({ error: 'Could not mint an upload grant' }, { status: 502 });
  }

  // token + path -> the client calls uploadToSignedUrl(path, token, file). The grant
  // is single-use; the record is finalized separately after the upload.
  return NextResponse.json({
    mediaEntryId,
    path: grant.path,
    token: grant.token,
    signedUrl: grant.signedUrl,
    mime,
    media_kind: mediaKind,
  });
}
