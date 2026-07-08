// src/app/api/members/invite/route.ts
// E2.3-minimal (D-SEQ-2, ruled 2026-06-12): the commissioner-only invite + linkage
// path. ONE commissioner action issues a Supabase magic-link invite to a member's
// email AND records the ratified linkage fact binding the returned user_id to a
// franchise. The member clicks the emailed link only to authenticate; the linkage was
// ratified by the commissioner at issue time (never self-asserted).
//
// Writes follow the house pattern: the linkage FACT is inserted via the AUTHED
// commissioner client so the franchise_member_links RLS (commissioner-only INSERT) is
// the hard boundary; the derived franchises.member_user_id pointer is updated via the
// same authed client under the franchises_update RLS (commissioner/admin). The admin
// client is used only to ANSWER questions (resolve the franchise, verify commissioner)
// and to drive the auth admin API (inviteUserByEmail / resolve an existing user).
//
// Out of scope (Inc 2 / later): captions/marginalia/self-tag, notifications, profile
// pages, password auth, unlinking. This route only links.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { isLeagueCommissioner } from '@/lib/av-room';
import { classifyInviteError, buildInviteRedirect, redactEmail } from '@/lib/members/invite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Deliberately permissive: a single '@' with non-empty local and domain parts. Real
// validity is proven by the member receiving the magic link, not by a regex.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Resolve an existing auth user's id by email when inviteUserByEmail reports the address
// is already registered. listUsers is paginated; a ten-member league fits one page, but
// page through defensively (cap at a few pages so a misconfig can't loop forever).
async function resolveExistingUserId(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const match = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function POST(req: NextRequest) {
  // Derive the app origin from the request (server-only route): removes the build-inlined
  // NEXT_PUBLIC_APP_URL failure mode and keeps the redirect same-origin by construction.
  const origin = new URL(req.url).origin;

  let body: { email?: unknown; franchiseId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    console.error('invite:bad-json', { origin });
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { email, franchiseId } = body;
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    console.error('invite:bad-email', {
      email: typeof email === 'string' ? redactEmail(email.trim()) : '(non-string)',
    });
    return NextResponse.json({ error: 'A valid member email is required.' }, { status: 400 });
  }
  if (typeof franchiseId !== 'string' || franchiseId.length === 0) {
    console.error('invite:bad-franchise-id', {});
    return NextResponse.json({ error: 'franchiseId is required.' }, { status: 400 });
  }
  const cleanEmail = email.trim();
  const emailRedacted = redactEmail(cleanEmail);

  // Auth: the actor must be signed in...
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error('invite:auth', { email: emailRedacted });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ...resolve the franchise (and its league) via the admin read...
  const admin = createAdminClient();
  const { data: franchise } = (await admin
    .from('franchises')
    .select('id, league_id, owner_display_name')
    .eq('id', franchiseId)
    .maybeSingle()) as {
    data: { id: string; league_id: string; owner_display_name: string } | null;
  };
  if (!franchise) {
    console.error('invite:franchise-missing', { franchiseId, email: emailRedacted });
    return NextResponse.json({ error: 'Franchise not found.' }, { status: 404 });
  }

  // ...and must be the commissioner of that franchise's league.
  if (!(await isLeagueCommissioner(admin, franchise.league_id, user.id))) {
    console.error('invite:not-commissioner', {
      franchiseId: franchise.id,
      leagueId: franchise.league_id,
      email: emailRedacted,
    });
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }

  // Every failure branch below logs a stable tag + upstream detail + this request context
  // (F1, the masking fix). NEVER log the full email (redacted only) or any token/key.
  const logCtx = { franchiseId: franchise.id, leagueId: franchise.league_id, email: emailRedacted };

  // Probe the linkage table BEFORE inviting, so a not-yet-applied migration 016 cannot
  // leave an orphaned invited user with no recorded link (the G17/G19/G20 503 rhythm).
  const { error: probeErr } = await admin.from('franchise_member_links').select('id').limit(1);
  if (probeErr && (probeErr as { code?: string }).code === '42P01') {
    console.error('invite:migration-probe', { ...logCtx, code: '42P01' });
    return NextResponse.json(
      { error: 'Member linkage is not enabled yet (migration 016 not applied).' },
      { status: 503 },
    );
  }

  // Resolve the league's canonical_id for the redirect. The /league/[id] routes resolve
  // [id] via getLeague, which keys on canonical_id - NOT the leagues UUID. franchise.league_id
  // is the UUID FK (correct for every DB write below); only the redirect URL needs the
  // canonical id, or the member lands on a 404 after authenticating.
  const { data: leagueRow } = (await admin
    .from('leagues')
    .select('canonical_id')
    .eq('id', franchise.league_id)
    .maybeSingle()) as { data: { canonical_id: string } | null };
  if (!leagueRow?.canonical_id) {
    console.error('invite:league-missing', logCtx);
    return NextResponse.json({ error: 'League not found.' }, { status: 404 });
  }
  const leagueCtx = { ...logCtx, league: leagueRow.canonical_id };

  // Issue the magic-link invite. redirectTo is the callback-entry contract (Gate B,
  // 2026-07-07): the emailed link carries token_hash to /auth/callback (the only route that
  // runs verifyOtp), which then forwards to the inner consent path. Redirecting straight to
  // consent would skip verification. See docs/auth_email_template_contract.md.
  let memberUserId: string;
  let alreadyRegistered = false;

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    cleanEmail,
    { redirectTo: buildInviteRedirect(origin, leagueRow.canonical_id) },
  );

  if (inviteErr) {
    // F2 - branch on the GoTrue error class instead of one catch-all:
    const upstream = {
      code: (inviteErr as { code?: string }).code ?? null,
      status: (inviteErr as { status?: number }).status ?? null,
    };
    const cls = classifyInviteError(inviteErr as never);
    if (cls.kind === 'rate_limit') {
      console.error(cls.tag, { ...leagueCtx, ...upstream });
      return NextResponse.json({ error: cls.clientMessage }, { status: cls.status });
    }
    // already_registered (re-invite / prior login) or a genuinely-other error: try to
    // resolve an existing account and still record the ratified link. If none resolves,
    // surface a 502 whose tag distinguishes the cause (no more three-into-one collapse).
    const existingId = await resolveExistingUserId(admin, cleanEmail);
    if (!existingId) {
      const tag = cls.kind === 'already_registered' ? 'invite:resolve-failed' : cls.tag;
      console.error(tag, { ...leagueCtx, ...upstream });
      return NextResponse.json(
        { error: 'Could not issue the invite or resolve an existing account for that email.' },
        { status: 502 },
      );
    }
    memberUserId = existingId;
    alreadyRegistered = true;
  } else if (invited?.user?.id) {
    memberUserId = invited.user.id;
  } else {
    console.error('invite:invite-no-user', leagueCtx);
    return NextResponse.json({ error: 'Invite returned no user id.' }, { status: 502 });
  }

  // F4 - idempotency: if this (franchise, member) pair is already linked, the re-invite has
  // re-sent the email and there is nothing to write. The orphan-cleanup invariant below
  // guarantees a link row only survives WITH a set pointer, so an existing link implies the
  // pointer is already current - return success without a second insert.
  const { data: existingLink } = (await supabase
    .from('franchise_member_links')
    .select('id')
    .eq('franchise_id', franchise.id)
    .eq('member_user_id', memberUserId)
    .maybeSingle()) as { data: { id: string } | null };
  if (existingLink) {
    return NextResponse.json({
      ok: true,
      franchise: franchise.owner_display_name,
      alreadyRegistered,
    });
  }

  // Record the ratified linkage FACT via the AUTHED commissioner client: RLS
  // (franchise_member_links_insert = commissioner/admin) is the hard boundary. Capture the
  // inserted id so a downstream pointer failure can compensate (F4 orphan cleanup).
  const { data: inserted, error: linkErr } = (await supabase
    .from('franchise_member_links')
    .insert({
      league_id: franchise.league_id,
      franchise_id: franchise.id,
      member_user_id: memberUserId,
      linked_by: user.id,
      note: null,
    } as never)
    .select('id')
    .single()) as { data: { id: string } | null; error: { code?: string } | null };
  if (linkErr) {
    if (linkErr.code === '42P01') {
      console.error('invite:migration-link', { ...leagueCtx, code: '42P01' });
      return NextResponse.json(
        { error: 'Member linkage is not enabled yet (migration 016 not applied).' },
        { status: 503 },
      );
    }
    console.error('invite:link-insert', { ...leagueCtx, code: linkErr.code ?? null });
    return NextResponse.json({ error: 'Could not record the linkage.' }, { status: 502 });
  }

  // Maintain the DERIVED current pointer the existing readers consume (the 2a gate,
  // member_consent scoping, get_user_league_id). Authed client under franchises_update
  // RLS - a commissioner editing a franchise in their own league.
  const { error: ptrErr } = await supabase
    .from('franchises')
    .update({ member_user_id: memberUserId } as never)
    .eq('id', franchise.id);
  if (ptrErr) {
    // F4 orphan cleanup: the link inserted but the pointer failed. Close the orphan window
    // by DELETING the just-inserted link row so no link survives without a set pointer.
    // franchise_member_links has NO DELETE RLS policy (append-only default-deny, migration
    // 016), so the authed client cannot delete - the admin (service-role) client, which
    // bypasses RLS, performs this compensation for the never-completed write.
    let cleaned = false;
    if (inserted?.id) {
      const { error: cleanupErr } = await admin
        .from('franchise_member_links')
        .delete()
        .eq('id', inserted.id);
      if (cleanupErr) {
        // The compensating delete failed - an orphan link may persist. Surface it loudly so
        // it can be reconciled; do not pretend the window closed.
        console.error('invite:orphan-cleanup-failed', {
          ...leagueCtx,
          linkId: inserted.id,
          code: (cleanupErr as { code?: string }).code ?? null,
        });
      } else {
        cleaned = true;
      }
    }
    console.error('invite:pointer-update', {
      ...leagueCtx,
      code: (ptrErr as { code?: string }).code ?? null,
      cleanedLinkId: inserted?.id ?? null,
      cleaned,
    });
    return NextResponse.json(
      { error: 'Linkage recorded but the franchise pointer did not update; retry.' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    franchise: franchise.owner_display_name,
    alreadyRegistered,
  });
}
