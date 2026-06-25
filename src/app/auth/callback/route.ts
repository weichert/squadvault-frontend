// src/app/auth/callback/route.ts
// Handles the redirect from Supabase auth emails (magic link, invite, confirm signup).
//
// Bug B fix (2026-06-24): the prior route only acted inside `if (code)` and called
// exchangeCodeForSession (the PKCE path). That path cannot work for INVITED members -
// invites are minted server-side via admin.inviteUserByEmail, so the clicking member
// never ran signInWithOtp in their browser and there is no PKCE code-verifier to
// exchange - and the default email templates deliver the session in a URL FRAGMENT
// (#access_token=...) that a server route physically cannot read. Both paths no-oped.
//
// The SSR-correct fix is token_hash + verifyOtp: the email links carry a server-readable
// ?token_hash=...&type=..., and the callback verifies it server-side. No PKCE verifier
// needed; works cross-device; works for invites. verifyOtp writes the session into the
// cookie store via the SSR client's setAll, so the member is authenticated after the call.
// The ?code= branch is kept as a harmless legacy fallback.
// Ref: https://supabase.com/docs/guides/auth/server-side/nextjs
//
// After a session is obtained, claims commissioner role by writing
// auth.uid() -> leagues.commissioner_user_id for an unclaimed league matching the email.
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { resolveAuthSession, safeRedirectPath } from "@/lib/auth/callback";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code"); // legacy PKCE fallback - harmless to keep
  const redirect = searchParams.get("redirect") ?? "/";

  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { userId, userEmail } = await resolveAuthSession(supabase, { token_hash, type, code });

  // Commissioner claim: if this user's email matches a league with no
  // commissioner_user_id set yet, claim it. One league per email at v1. Runs after a
  // session is obtained by EITHER path - unchanged from the prior route.
  if (userId && userEmail) {
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find a league expecting this commissioner email that is unclaimed
    const { data: league } = await admin
      .from("leagues")
      .select("id")
      .eq("commissioner_email", userEmail)
      .is("commissioner_user_id", null)
      .maybeSingle() as { data: { id: string } | null };

    if (league) {
      await admin
        .from("leagues")
        .update({ commissioner_user_id: userId } as Record<string, unknown>)
        .eq("id", league.id);
    }
  }

  // Resolve the destination to a safe same-origin path: a relative path, a same-origin
  // absolute URL (the email-template `&redirect={{ .RedirectTo }}` carry-through that lands
  // an invited member on their league consent page), or a self-referential callback URL
  // that nests the real destination. Cross-origin collapses to "/" (no open redirect).
  const safeRedirect = safeRedirectPath(redirect, origin);
  return NextResponse.redirect(`${origin}${safeRedirect}`);
}
