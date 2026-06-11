// src/app/api/av-room/poster/route.ts
// W.1 A/V Room - commissioner set/replace video poster (D0, photo-first tooling
// per D-G). The client-side auto-extraction (extractPosterBlob) is best-effort and
// silently yields nothing for codecs the upload browser cannot decode (iPhone .mov
// / HEVC is the common case). This route is the honest, in-spec fallback: the
// commissioner picks a still for a video and it is stored at the same by-convention
// sibling path the room reads, {league_id}/{media_entry_id}/poster.jpg.
//
// The poster is a small image, well under the 4.5 MB function-body limit, so it
// passes through this route (unlike the original, which goes client-direct under a
// grant). Commissioner-only; the original is never touched (6.9). upsert:true so a
// later, better still replaces an earlier one - the poster is a derived rendition,
// not a fact, so replacement carries no append-only concern.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner } from '@/lib/av-room';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POSTER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const mediaEntryId = form.get('mediaEntryId');
  const poster = form.get('poster');

  if (typeof mediaEntryId !== 'string' || mediaEntryId.length === 0) {
    return NextResponse.json({ error: 'mediaEntryId is required' }, { status: 400 });
  }
  if (!(poster instanceof File) || poster.size === 0) {
    return NextResponse.json({ error: 'A non-empty image is required' }, { status: 400 });
  }
  if (!POSTER_MIMES.has(poster.type)) {
    return NextResponse.json({ error: 'The poster must be a JPEG, PNG, or WebP image' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Resolve the entry server-side; the league is derived from it (the sign-route
  // pattern), so the client only names the entry. The folder comes from the stored
  // path (authoritative) - the poster lands beside the exact original.
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
  if (entry.media_kind !== 'video') {
    return NextResponse.json({ error: 'Posters apply to video entries only' }, { status: 400 });
  }

  const folder = entry.storage_path.slice(0, entry.storage_path.lastIndexOf('/'));
  const posterBytes = new Uint8Array(await poster.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('league-media')
    .upload(`${folder}/poster.jpg`, posterBytes, { contentType: poster.type, upsert: true });
  if (upErr) {
    return NextResponse.json({ error: 'The poster could not be saved' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
