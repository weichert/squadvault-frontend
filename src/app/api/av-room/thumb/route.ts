// src/app/api/av-room/thumb/route.ts
// W.1 A/V Room - photo thumbnail renditions (R3-D1, performance at scale). A list
// of 300 photos must not ship 300 full originals to render one page; every list
// surface serves a small derived JPEG at the by-convention sibling path
// {league_id}/{media_entry_id}/thumb.jpg. Videos reuse poster.jpg (r2-D1); this
// route is the photo counterpart.
//
// Why client-side canvas, not server-side resize (recorded per brief): the ORIGINAL
// cannot pass through a function request body (4.5 MB Vercel edge limit), and a
// server-side resize would need a heavy image lib (sharp) plus pulling multi-MB
// originals into the function. The client already holds the original file at upload
// and already proves the canvas-downscale path for video posters (extractPosterBlob),
// so the thumb is generated there and arrives small. This route only RECEIVES the
// small thumb (POST, like poster.jpg) and lists backfill targets (GET).
//
// The thumb is a derived, regenerable rendition - NOT a fact and NOT provenance.
// upsert:true; the original is never touched (6.9). Same upsert-allowed reasoning as
// poster.jpg.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner } from '@/lib/av-room';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const THUMB_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ORIGINAL_TTL_SECONDS = 300;

// GET /api/av-room/thumb?leagueId=... -> backfill targets: photos that have no
// thumb.jpg yet, each with a short-TTL signed URL of the ORIGINAL so the client can
// pull it into a canvas and generate the missing thumb. This is a one-off maintenance
// action (a commissioner click), not a page-render path, so per-folder listing here
// is acceptable - the render path never does this.
export async function GET(req: NextRequest) {
  const leagueId = req.nextUrl.searchParams.get('leagueId');
  if (!leagueId) {
    return NextResponse.json({ error: 'leagueId is required' }, { status: 400 });
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

  const { data: photos } = (await admin
    .from('media_entries')
    .select('id, storage_path, upload_note, created_at')
    .eq('league_id', leagueId)
    .eq('media_kind', 'photo')) as {
    data: { id: string; storage_path: string; upload_note: string | null; created_at: string }[] | null;
  };

  // note + createdAt travel with each target so the client can NAME an item that fails
  // to read (an unreadable, untagged item is otherwise unidentifiable in the UI).
  const targets: { mediaEntryId: string; originalUrl: string; note: string | null; createdAt: string }[] = [];
  for (const p of photos ?? []) {
    const folder = p.storage_path.slice(0, p.storage_path.lastIndexOf('/'));
    const { data: listed } = await admin.storage.from('league-media').list(folder);
    if (listed?.some((o) => o.name === 'thumb.jpg')) continue; // already has a thumb
    const { data: signed } = await admin.storage
      .from('league-media')
      .createSignedUrl(p.storage_path, ORIGINAL_TTL_SECONDS);
    if (signed) {
      targets.push({ mediaEntryId: p.id, originalUrl: signed.signedUrl, note: p.upload_note, createdAt: p.created_at });
    }
  }

  return NextResponse.json({ targets });
}

// POST (multipart) {mediaEntryId, thumb} -> upsert {folder}/thumb.jpg. The entry is
// resolved server-side and the league derived from it (the sign/poster-route pattern);
// the client only names the entry. Photos only.
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const mediaEntryId = form.get('mediaEntryId');
  const thumb = form.get('thumb');

  if (typeof mediaEntryId !== 'string' || mediaEntryId.length === 0) {
    return NextResponse.json({ error: 'mediaEntryId is required' }, { status: 400 });
  }
  if (!(thumb instanceof File) || thumb.size === 0) {
    return NextResponse.json({ error: 'A non-empty image is required' }, { status: 400 });
  }
  if (!THUMB_MIMES.has(thumb.type)) {
    return NextResponse.json({ error: 'The thumbnail must be a JPEG, PNG, or WebP image' }, { status: 400 });
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
  if (!(await isLeagueCommissioner(admin, entry.league_id, user.id))) {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }
  if (entry.media_kind !== 'photo') {
    return NextResponse.json({ error: 'Thumbnails apply to photo entries only' }, { status: 400 });
  }

  const folder = entry.storage_path.slice(0, entry.storage_path.lastIndexOf('/'));
  const bytes = new Uint8Array(await thumb.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('league-media')
    .upload(`${folder}/thumb.jpg`, bytes, { contentType: 'image/jpeg', upsert: true });
  if (upErr) {
    return NextResponse.json({ error: 'The thumbnail could not be saved' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
