// src/middleware.ts
// Registered middleware. It MUST live under src/ (beside app) to be picked up when the
// project uses the src/ convention; a root-level middleware.ts is silently ignored, which
// is exactly the bug diagnosed in
// _observations/OBSERVATIONS_2026_07_04_MIDDLEWARE_ANON_GATE_FINDINGS.md (memo 2af142d).
//
// This is the SECOND layer of access control, behind the page-level self-gates, which
// remain PRIMARY (each gated page still runs its own `if (!viewer.userId) redirect(...)`).
// The matcher below lists exactly the working / consent-scoped surfaces (ruling R1). The
// R1-public ceremonial surfaces - league home, coach-office, members, trophy-room, archive
// - are intentionally NOT matched and stay world-visible; unmatched routes are not touched
// by this middleware at all (including no session refresh - see the findings/honesty memo).
//
// The Supabase SSR client + cookie getAll/setAll session-refresh pattern is the standard
// @supabase/ssr middleware form, reused verbatim from the prior (dead) root file.
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = req.nextUrl.pathname;

  // Every matched route requires authentication. Bounce anonymous requests to sign-in,
  // preserving the originating path in ?redirect= - the identical destination shape the
  // page gates produce (a relative, safeRedirectPath-compatible value), so the two layers
  // agree. "Which routes are gated" is decided by config.matcher, not re-encoded here.
  if (!user) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin surfaces additionally require the admin role; authed non-admins get a plain 403.
  if (pathname.startsWith('/admin/')) {
    const role = (user.app_metadata as Record<string, string>)?.role;
    if (role !== 'admin') return new NextResponse('Forbidden', { status: 403 });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/league/:id/office/:path*',
    '/league/:id/vault/:path*',
    '/league/:id/history/:path*',
    '/league/:id/consent/:path*',
    '/league/:id/av-room/:path*',
    '/league/:id/approve/:path*',
    '/admin/:path*',
  ],
};
