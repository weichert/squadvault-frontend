// src/app/api/av-room/duplicate/route.ts
// W.1 R4-D3: deterministic duplicate detection. The client computes the sha256 of a
// file's bytes BEFORE uploading and asks here whether that exact byte-identity already
// exists in this league's record. Pure byte equality, zero AI - content_hash is a
// CONVENIENCE, not provenance (see migration 013).
//
// Commissioner-only (the ingest tool's boundary). The league is named by the caller and
// authorized here; the hash is matched within that league only (a duplicate only matters
// inside a league's own record).
//
// Graceful until migration 013 is applied: if content_hash does not exist yet (Postgres
// 42703 undefined_column), this reports "no duplicate" so the upload path keeps working -
// duplicate detection is simply inactive, never a hard failure. The 012/G17 rhythm.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner } from '@/lib/av-room';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { leagueId?: unknown; hash?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { leagueId, hash } = body;
  if (typeof leagueId !== 'string' || leagueId.length === 0) {
    return NextResponse.json({ error: 'leagueId is required' }, { status: 400 });
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
  if (!(await isLeagueCommissioner(admin, leagueId, user.id))) {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }

  const { data, error } = (await admin
    .from('media_entries')
    .select('id, upload_note, created_at')
    .eq('league_id', leagueId)
    .eq('content_hash', hash)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()) as {
    data: { id: string; upload_note: string | null; created_at: string } | null;
    error: { code?: string } | null;
  };

  // Column not applied yet -> detection inactive, report no duplicate (do not 500).
  if (error && error.code === '42703') {
    return NextResponse.json({ duplicate: null, inactive: true });
  }
  if (error) {
    return NextResponse.json({ error: 'Could not check for duplicates' }, { status: 502 });
  }
  if (!data) {
    return NextResponse.json({ duplicate: null });
  }

  // D-W1-E1: the dup-check message distinguishes "expunged" from "in the record". The
  // content_hash survives expungement, so a match may be a tombstone. Graceful if
  // migration 014 is absent (treated as not-expunged).
  let expunged = false;
  const { data: expRow } = (await admin
    .from('media_expungement_events')
    .select('id')
    .eq('media_entry_id', data.id)
    .limit(1)
    .maybeSingle()) as { data: { id: string } | null };
  if (expRow) expunged = true;

  return NextResponse.json({
    duplicate: { id: data.id, note: data.upload_note, createdAt: data.created_at, expunged },
  });
}
