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
import { isLeagueMember } from '@/lib/av-room';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL_SECONDS = 120;

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
    .select('league_id, storage_path')
    .eq('id', mediaEntryId)
    .maybeSingle()) as { data: { league_id: string; storage_path: string } | null };
  if (!entry) return NextResponse.json({ error: 'Media entry not found' }, { status: 404 });

  if (!(await isLeagueMember(admin, entry.league_id, user.id))) {
    return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from('league-media')
    .createSignedUrl(entry.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed) {
    return NextResponse.json({ error: 'Could not sign URL' }, { status: 502 });
  }

  return NextResponse.json({ url: signed.signedUrl, ttl: SIGNED_URL_TTL_SECONDS });
}
