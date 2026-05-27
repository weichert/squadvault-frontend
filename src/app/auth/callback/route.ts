// src/app/auth/callback/route.ts
// Handles the redirect from Supabase magic link emails.
// After exchanging the code for a session, claims commissioner role
// by writing auth.uid() -> leagues.commissioner_user_id if not yet set.
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? "/";

  if (code) {
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

    const { data: sessionData } = await supabase.auth.exchangeCodeForSession(code);
    const userId = sessionData?.session?.user?.id;
    const userEmail = sessionData?.session?.user?.email;

    // Commissioner claim: if this user's email matches a league with no
    // commissioner_user_id set yet, claim it. One league per email at v1.
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
  }

  // Sanitize redirect — only allow relative paths to prevent open redirect
  const safeRedirect = redirect.startsWith("/") ? redirect : "/";
  return NextResponse.redirect(`${origin}${safeRedirect}`);
}
