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
import { isLeagueMember, isLeagueCommissioner, evaluatePlaybackGate } from '@/lib/av-room';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL_SECONDS = 120;
// D-W1-A: the playback-specific TTL (the 120s display TTL is unchanged). An already-minted
// playback URL lives out this window even after a superseding attestation - supersession
// stops future ISSUANCE, never rewrites an in-flight stream (the D-U boundary on playback).
const PLAYBACK_TTL_SECONDS = 600;

export async function POST(req: NextRequest) {
  let body: { mediaEntryId?: unknown; variant?: unknown; download?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { mediaEntryId, variant } = body;
  // R4-D2: 'download' mints a signed URL of the ORIGINAL (any kind) with a download
  // disposition - RETRIEVAL, not display. Commissioner-only in Increment 1.
  const wantDownload = body.download === true;
  // R4-D1: 'poster' signs a video's still. Default display: the full-resolution photo.
  const wantPoster = variant === 'poster';
  // D-W1-A: 'playback' signs a VIDEO's ORIGINAL for the <video> player - but ONLY behind
  // the route-enforced playback gate (spec 5.7). This AMENDS the prior code-level invariant
  // ("a video's original is never signed for display"): a video's original is now signed
  // for display ONLY through this gate-checked variant (TTL 600s). The UI is never the
  // boundary - the gate is enforced here.
  const wantPlayback = variant === 'playback';

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
    .select('league_id, storage_path, media_kind')
    .eq('id', mediaEntryId)
    .maybeSingle()) as {
    data: { league_id: string; storage_path: string; media_kind: string } | null;
  };
  if (!entry) return NextResponse.json({ error: 'Media entry not found' }, { status: 404 });

  // Auth: download is commissioner-only (Inc 1); display + playback are league-member (the
  // room reads them - for playback the GATE, not membership, is the real protection).
  if (wantDownload) {
    if (!(await isLeagueCommissioner(admin, entry.league_id, user.id))) {
      return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
    }
  } else if (!(await isLeagueMember(admin, entry.league_id, user.id))) {
    return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });
  }

  const folder = entry.storage_path.slice(0, entry.storage_path.lastIndexOf('/'));
  let path: string;
  let ttl = SIGNED_URL_TTL_SECONDS;
  let options: { download?: string } | undefined;

  if (wantPlayback) {
    // Video-only; the gate is enforced HERE.
    if (entry.media_kind !== 'video') {
      return NextResponse.json({ error: 'Playback applies to video only' }, { status: 400 });
    }
    const gate = await evaluatePlaybackGate(admin, mediaEntryId);
    if (!gate.allowed) {
      // Neutral body: no leakage of which gate leg failed, or what tags/grants exist.
      return NextResponse.json({ error: 'Playback gated' }, { status: 403 });
    }
    // D-W1-A6: prefer the playback RENDITION (H.264/AAC, web-decodable) when present, else
    // fall back to the original. Progressive enhancement, zero regression - Safari users
    // (HEVC-native) lose nothing while renditions backfill, and the gate already passed
    // identically above. The rendition is a derived sibling in poster.jpg's governance
    // class (6.9); filesystem presence IS the state.
    const { data: rendition } = await admin.storage
      .from('league-media')
      .createSignedUrl(`${folder}/playback.mp4`, PLAYBACK_TTL_SECONDS);
    if (rendition) {
      return NextResponse.json({ url: rendition.signedUrl, ttl: PLAYBACK_TTL_SECONDS });
    }
    path = entry.storage_path;
    ttl = PLAYBACK_TTL_SECONDS;
  } else if (wantDownload) {
    path = entry.storage_path;
    const ext = entry.storage_path.slice(entry.storage_path.lastIndexOf('.') + 1) || 'bin';
    options = { download: `squadvault-${mediaEntryId.slice(0, 8)}.${ext}` };
  } else {
    // Display -> photo original or a video's poster; a video's original is NEVER signed
    // for display here (only the gate-checked playback variant above may sign it).
    path = wantPoster || entry.media_kind === 'video' ? `${folder}/poster.jpg` : entry.storage_path;
  }

  const { data: signed, error: signErr } = await admin.storage
    .from('league-media')
    .createSignedUrl(path, ttl, options);
  if (signErr || !signed) {
    return NextResponse.json({ error: 'Could not sign URL' }, { status: 502 });
  }

  return NextResponse.json({ url: signed.signedUrl, ttl });
}
