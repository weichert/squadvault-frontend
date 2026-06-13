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
  let body: { email?: unknown; franchiseId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { email, franchiseId } = body;
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: 'A valid member email is required.' }, { status: 400 });
  }
  if (typeof franchiseId !== 'string' || franchiseId.length === 0) {
    return NextResponse.json({ error: 'franchiseId is required.' }, { status: 400 });
  }
  const cleanEmail = email.trim();

  // Auth: the actor must be signed in...
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    return NextResponse.json({ error: 'Franchise not found.' }, { status: 404 });
  }

  // ...and must be the commissioner of that franchise's league.
  if (!(await isLeagueCommissioner(admin, franchise.league_id, user.id))) {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }

  // Probe the linkage table BEFORE inviting, so a not-yet-applied migration 016 cannot
  // leave an orphaned invited user with no recorded link (the G17/G19/G20 503 rhythm).
  const { error: probeErr } = await admin.from('franchise_member_links').select('id').limit(1);
  if (probeErr && (probeErr as { code?: string }).code === '42P01') {
    return NextResponse.json(
      { error: 'Member linkage is not enabled yet (migration 016 not applied).' },
      { status: 503 },
    );
  }

  // Issue the magic-link invite. Supabase sends the email; the redirect lands the member
  // on their consent surface so the first thing they can do is record 2a/2b grants.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const leagueRedirect = `/league/${franchise.league_id}/consent`;
  let memberUserId: string;
  let alreadyRegistered = false;

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    cleanEmail,
    { redirectTo: `${appUrl}/auth/callback?redirect=${encodeURIComponent(leagueRedirect)}` },
  );

  if (inviteErr) {
    // Most commonly: the address already has an account (re-invite, or the member logged
    // in before). That is not a failure for linkage - resolve the existing user and still
    // record the ratified link. Any other error is surfaced.
    const existingId = await resolveExistingUserId(admin, cleanEmail);
    if (!existingId) {
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
    return NextResponse.json({ error: 'Invite returned no user id.' }, { status: 502 });
  }

  // Record the ratified linkage FACT via the AUTHED commissioner client: RLS
  // (franchise_member_links_insert = commissioner/admin) is the hard boundary.
  const { error: linkErr } = await supabase.from('franchise_member_links').insert({
    league_id: franchise.league_id,
    franchise_id: franchise.id,
    member_user_id: memberUserId,
    linked_by: user.id,
    note: null,
  } as never);
  if (linkErr) {
    const code = (linkErr as { code?: string }).code;
    if (code === '42P01') {
      return NextResponse.json(
        { error: 'Member linkage is not enabled yet (migration 016 not applied).' },
        { status: 503 },
      );
    }
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
    // The fact is recorded; the pointer failed. Report partial so the commissioner retries
    // rather than assuming the member can read the room.
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
