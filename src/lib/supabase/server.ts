import { createServerClient as createSSRClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from './types';

// Override Supabase's underlying fetch with cache: 'no-store'. Without this,
// Next.js 14's automatic fetch caching (Data Cache) serves stale snapshots
// of Supabase queries between requests even when the calling page has
// `export const dynamic = "force-dynamic"`. force-dynamic opts the page out
// of the Route Segment Cache, but the Data Cache is a separate layer that
// keys on fetch URLs. SquadVault's server clients are used to read live
// state (admin client via service-role key; SSR client via auth cookies)
// and should never be cached. See
// _observations/OBSERVATIONS_2026_05_28_LEAGUE_PAGES_FORCE_DYNAMIC.md in the
// engine repo for the full rationale and diagnostic trail.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' });

export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Read-only in Server Components — middleware handles refresh
          }
        },
      },
      global: {
        fetch: noStoreFetch,
      },
    }
  );
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required but not set. ' +
      'Never use a NEXT_PUBLIC_ prefix for this key.'
    );
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: noStoreFetch,
    },
  });
}
