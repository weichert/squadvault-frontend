// src/lib/auth/callback.ts
// Pure branch-selection for the auth callback (Bug B fix, 2026-06-24). Lives outside the
// route module because Next.js App Router route files may only export HTTP handlers + config
// (a non-handler export breaks the route type contract); this keeps the logic testable
// without a request scope. See src/app/auth/callback/route.ts for the full rationale.
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type AuthCallbackParams = {
  token_hash: string | null;
  type: EmailOtpType | null;
  code: string | null;
};

// Resolve the authenticated user from whichever credential the email link carried.
// token_hash + type is the SSR-correct path (verifyOtp - works for invites and
// cross-device, no PKCE verifier needed); ?code= is the legacy PKCE fallback. Returns the
// user identity to drive the commissioner claim, or empty when nothing verified.
export async function resolveAuthSession(
  supabase: SupabaseClient<Database>,
  { token_hash, type, code }: AuthCallbackParams,
): Promise<{ userId?: string; userEmail?: string }> {
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error && data?.user) {
      return { userId: data.user.id, userEmail: data.user.email ?? undefined };
    }
    return {};
  }
  if (code) {
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    const user = data?.session?.user;
    return { userId: user?.id, userEmail: user?.email ?? undefined };
  }
  return {};
}
