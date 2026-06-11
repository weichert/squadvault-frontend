// src/app/api/av-room/upload/finalize/route.ts
// W.1 A/V Room - the finalize route (D-W1-V1 remedy B, Spec 5.1 Amendment 1,
// clauses c-e). The original has already been uploaded client-direct under the
// grant minted by ../grant. This route finalizes the RECORD: it re-verifies the
// commissioner, RE-DERIVES the expected object path server-side (never trusting a
// client path), confirms the uploaded object exists, then appends the single
// media_entries row via the authed client (RLS-backed). Append-only begins at the
// record, not the byte (clause d): an uploaded object that is never finalized is a
// pre-record orphan - unreferenced, invisible (no SELECT policy; only row-derived
// signed URLs), and reapable as hygiene without touching append-only discipline.
//
// The original is stored unmodified (6.9, clause e). A video may also carry a small
// poster still as a form part, written AFTER the record as a by-convention sibling
// (D3); it is best-effort and never fails the finalize.
//
// Orphan reap rule:
//   - Immediate: if the record INSERT fails (and is not a duplicate finalize), the
//     just-uploaded object(s) are removed here, so a failed finalize leaves nothing.
//   - Stragglers (grant minted + uploaded, finalize never called): an object under
//     {league_id}/{media_entry_id}/ with NO matching media_entries row is reapable.
//     Trigger = a periodic hygiene sweep listing league-media prefixes and removing
//     any whose media_entry_id is absent from media_entries; deferred to an ops
//     sweep, not a request-path concern. Documented here so it is not silent.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner, EXT_BY_MIME, mediaKindForMime } from '@/lib/av-room';
import type { Database, MediaKind } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MediaEntryInsert = Database['public']['Tables']['media_entries']['Insert'];

const MEDIA_KINDS: MediaKind[] = ['photo', 'video'];

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const mediaEntryId = form.get('mediaEntryId');
  const leagueId = form.get('leagueId');
  const mediaKind = form.get('media_kind');
  const mime = form.get('mime');
  const uploadNoteRaw = form.get('upload_note');

  if (typeof mediaEntryId !== 'string' || mediaEntryId.length === 0) {
    return NextResponse.json({ error: 'mediaEntryId is required' }, { status: 400 });
  }
  if (typeof leagueId !== 'string' || leagueId.length === 0) {
    return NextResponse.json({ error: 'leagueId is required' }, { status: 400 });
  }
  if (typeof mediaKind !== 'string' || !MEDIA_KINDS.includes(mediaKind as MediaKind)) {
    return NextResponse.json({ error: 'media_kind must be photo or video' }, { status: 400 });
  }
  if (typeof mime !== 'string' || mediaKindForMime(mime) !== mediaKind) {
    return NextResponse.json({ error: 'mime is missing or does not match media_kind' }, { status: 400 });
  }
  const ext = EXT_BY_MIME[mime];
  if (!ext) {
    return NextResponse.json({ error: `Unsupported file type: ${mime}` }, { status: 400 });
  }
  const uploadNote =
    typeof uploadNoteRaw === 'string' && uploadNoteRaw.trim().length > 0
      ? uploadNoteRaw.trim()
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

  // Re-derive the path server-side from (leagueId, mediaEntryId, ext) - the client
  // path is never trusted. This is the SAME formula the grant route minted.
  const folder = `${leagueId}/${mediaEntryId}`;
  const storagePath = `${folder}/original.${ext}`;

  // Confirm the client actually uploaded the original under the granted path before
  // we create a record that points at it.
  const { data: listed, error: listErr } = await admin.storage.from('league-media').list(folder);
  if (listErr) {
    return NextResponse.json({ error: 'Could not verify the upload' }, { status: 502 });
  }
  if (!listed?.some((o) => o.name === `original.${ext}`)) {
    return NextResponse.json({ error: 'The upload was not found; nothing to finalize.' }, { status: 409 });
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
    // A duplicate finalize (record already exists) must NOT reap - the object is
    // legitimately referenced by the existing row. Treat as already-finalized.
    if ((insErr as { code?: string }).code === '23505') {
      return NextResponse.json({ id: mediaEntryId, storage_path: storagePath, alreadyFinalized: true });
    }
    // Otherwise this object is a pre-record orphan: reap it (and any poster).
    await admin.storage.from('league-media').remove([storagePath, `${folder}/poster.jpg`]);
    return NextResponse.json(
      { error: 'The file was uploaded but its record could not be saved; the upload was rolled back.' },
      { status: 500 },
    );
  }

  // D3 poster (video only), written AFTER the record, best-effort.
  if (mediaKind === 'video') {
    const poster = form.get('poster');
    if (poster instanceof File && poster.size > 0) {
      const posterBytes = new Uint8Array(await poster.arrayBuffer());
      await admin.storage
        .from('league-media')
        .upload(`${folder}/poster.jpg`, posterBytes, { contentType: 'image/jpeg', upsert: false });
    }
  }

  // R3-D1 thumb (photo only), the same by-convention-sibling pattern as the poster:
  // a small derived rendition the list surfaces serve instead of the full original.
  // Written AFTER the record, best-effort - a missing thumb is backfillable and the
  // list falls back to a placeholder, never the multi-MB original.
  if (mediaKind === 'photo') {
    const thumb = form.get('thumb');
    if (thumb instanceof File && thumb.size > 0) {
      const thumbBytes = new Uint8Array(await thumb.arrayBuffer());
      await admin.storage
        .from('league-media')
        .upload(`${folder}/thumb.jpg`, thumbBytes, { contentType: 'image/jpeg', upsert: false });
    }
  }

  return NextResponse.json({ id: mediaEntryId, storage_path: storagePath });
}
