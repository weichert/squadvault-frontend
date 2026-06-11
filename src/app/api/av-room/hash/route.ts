// src/app/api/av-room/hash/route.ts
// W.1 R4-D3: backfill content_hash for the existing corpus, the same one-off
// maintenance pattern as the thumbnail backfill (R3-D1). New uploads hash themselves
// client-side before upload; pre-existing rows have no hash, so the commissioner runs
// this once: GET the rows missing a hash (each with a signed original), the client reads
// the bytes and computes sha256, POST stores it. Pure byte equality, zero AI; the hash
// is a convenience, not provenance (migration 013).
//
// Graceful until migration 013 is applied: if content_hash does not exist (42703), GET
// returns no targets (inactive=true) and POST reports inactive - never a hard failure.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner } from '@/lib/av-room';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORIGINAL_TTL_SECONDS = 600;

// GET ?leagueId=... -> entries with no content_hash yet, each with a signed ORIGINAL the
// client hashes. All kinds (a duplicate is byte-identity of the original, photo or video).
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

  const { data, error } = (await admin
    .from('media_entries')
    .select('id, storage_path')
    .eq('league_id', leagueId)
    .is('content_hash', null)) as {
    data: { id: string; storage_path: string }[] | null;
    error: { code?: string } | null;
  };
  if (error && error.code === '42703') {
    return NextResponse.json({ targets: [], inactive: true });
  }
  if (error) {
    return NextResponse.json({ error: 'Could not list hash targets' }, { status: 502 });
  }

  const targets: { mediaEntryId: string; originalUrl: string }[] = [];
  for (const e of data ?? []) {
    const { data: signed } = await admin.storage
      .from('league-media')
      .createSignedUrl(e.storage_path, ORIGINAL_TTL_SECONDS);
    if (signed) targets.push({ mediaEntryId: e.id, originalUrl: signed.signedUrl });
  }
  return NextResponse.json({ targets });
}

// POST {mediaEntryId, hash} -> UPDATE the row's content_hash. Entry resolved server-side;
// league derived from it and authorized (the sign/poster/thumb-route pattern).
export async function POST(req: NextRequest) {
  let body: { mediaEntryId?: unknown; hash?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { mediaEntryId, hash } = body;
  if (typeof mediaEntryId !== 'string' || mediaEntryId.length === 0) {
    return NextResponse.json({ error: 'mediaEntryId is required' }, { status: 400 });
  }
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) {
    return NextResponse.json({ error: 'a sha256 hex hash is required' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: entry } = (await admin
    .from('media_entries')
    .select('league_id')
    .eq('id', mediaEntryId)
    .maybeSingle()) as { data: { league_id: string } | null };
  if (!entry) {
    return NextResponse.json({ error: 'Media entry not found' }, { status: 404 });
  }
  if (!(await isLeagueCommissioner(admin, entry.league_id, user.id))) {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }

  const { error: upErr } = await supabase
    .from('media_entries')
    .update({ content_hash: hash } as never)
    .eq('id', mediaEntryId);
  if (upErr && (upErr as { code?: string }).code === '42703') {
    return NextResponse.json({ ok: false, inactive: true });
  }
  if (upErr) {
    return NextResponse.json({ error: 'The hash could not be saved' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
