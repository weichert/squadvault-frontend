// src/app/api/av-room/upload/route.ts
// W.1 A/V Room ingest - the commissioner upload path (Increment 1). The file
// passes THROUGH this server route (no client-direct write, spec 5.1): the bytes
// go to the private league-media bucket, then one row is appended to media_entries.
//
// Governance: commissioner-only. The upload uses the authed SSR client, so the
// storage policy league_media_commissioner_insert (keyed off the {league_id}/...
// path) AND the media_entries INSERT policy (commissioner-only, uploaded_by =
// auth.uid()) are both the hard guarantee - this route's own checks are for clean
// status codes, not the security boundary. Append-only: insert only.
//
// The original is the retained source (6.9): stored unmodified at
// {league_id}/{media_entry_id}/original.{ext}, never edited in place. The
// media_entry_id is minted here so the storage key and the row id match.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner } from '@/lib/av-room';
import type { Database, MediaKind } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MediaEntryInsert = Database['public']['Tables']['media_entries']['Insert'];

const MEDIA_KINDS: MediaKind[] = ['photo', 'video'];

// Allowed content types -> file extension. Kept deliberately small and explicit;
// the original bytes are retained as-is, so this only governs the stored key's ext.
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

const PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const file = form.get('file');
  const leagueId = form.get('leagueId');
  const mediaKind = form.get('media_kind');
  const uploadNoteRaw = form.get('upload_note');

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'A non-empty file is required' }, { status: 400 });
  }
  if (typeof leagueId !== 'string' || leagueId.length === 0) {
    return NextResponse.json({ error: 'leagueId is required' }, { status: 400 });
  }
  if (typeof mediaKind !== 'string' || !MEDIA_KINDS.includes(mediaKind as MediaKind)) {
    return NextResponse.json({ error: 'media_kind must be photo or video' }, { status: 400 });
  }
  const uploadNote =
    typeof uploadNoteRaw === 'string' && uploadNoteRaw.trim().length > 0
      ? uploadNoteRaw.trim()
      : null;

  const mime = file.type;
  const ext = EXT_BY_MIME[mime];
  if (!ext) {
    return NextResponse.json({ error: `Unsupported file type: ${mime || 'unknown'}` }, { status: 400 });
  }
  // The declared kind must match the file's actual media type - no photo bytes
  // filed as video (which would then ride the deferred video gate) or vice versa.
  const kindMatches =
    (mediaKind === 'photo' && PHOTO_MIMES.has(mime)) ||
    (mediaKind === 'video' && VIDEO_MIMES.has(mime));
  if (!kindMatches) {
    return NextResponse.json({ error: `File type ${mime} does not match media_kind ${mediaKind}` }, { status: 400 });
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

  const mediaEntryId = crypto.randomUUID();
  const storagePath = `${leagueId}/${mediaEntryId}/original.${ext}`;

  // Storage write via the authed client -> the league_media_commissioner_insert
  // policy is enforced as this commissioner. Bytes retained unmodified (6.9).
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: storageErr } = await supabase.storage
    .from('league-media')
    .upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (storageErr) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 502 });
  }

  const row: MediaEntryInsert & { id: string } = {
    id: mediaEntryId,
    league_id: leagueId,
    media_kind: mediaKind as MediaKind,
    storage_path: storagePath,
    mime_type: mime,
    uploaded_by: user.id,
    upload_note: uploadNote,
  };
  const { error: insErr } = await supabase.from('media_entries').insert(row as never);
  if (insErr) {
    // Roll back the orphaned object so a failed insert leaves no dangling bytes.
    await supabase.storage.from('league-media').remove([storagePath]);
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 });
  }

  return NextResponse.json({ id: mediaEntryId, storage_path: storagePath });
}
