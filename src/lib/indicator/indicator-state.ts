// src/lib/indicator/indicator-state.ts
// SIGNED-IN INDICATOR — the pure state seam. Resolves the viewer's display state from
// plain inputs (the getViewer contract + a resolved franchise name), and builds the
// anonymous sign-in href with its redirect validated. PURE (no I/O, no DOM): all
// correctness is provable in the node suite. The indicator DISPLAYS state; it never
// computes auth. (Brief sections 3-4.)
import { safeRedirectPath } from "@/lib/auth/callback";

// The honest viewer states. A name appears ONLY in the `member` case, and only ever the
// resolved franchise name — there is no shape in which a name is synthesized.
export type IndicatorState =
  | { kind: "anonymous"; signInHref: string }
  | { kind: "member"; name: string }
  | { kind: "commissioner" }
  | { kind: "signed_in" };

export type IndicatorInput = {
  userId: string | null;
  isCommissioner: boolean;
  franchiseName: string | null;
  signInHref: string;
};

// Precedence (first match wins): anonymous (no session) -> member (a resolvable, non-blank
// franchise name) -> commissioner (signed in, no franchise, is the commissioner) -> signed_in
// (the honest catch-all). An empty / whitespace-only name is treated as UNRESOLVED, so a
// signed-in viewer never sees a blank chip or a fabricated name.
export function resolveIndicatorState(input: IndicatorInput): IndicatorState {
  const { userId, isCommissioner, franchiseName, signInHref } = input;
  if (!userId) return { kind: "anonymous", signInHref };
  const name = (franchiseName ?? "").trim();
  if (name) return { kind: "member", name };
  if (isCommissioner) return { kind: "commissioner" };
  return { kind: "signed_in" };
}

// The anonymous sign-in href: /auth/login with the intended return path validated through
// safeRedirectPath (same-origin / relative only; an off-origin or protocol-relative target
// collapses to "/"). Defense against an open-redirect smuggle even though the path is
// app-constructed. (D-2.)
export function buildSignInHref(intendedRedirectPath: string, origin: string): string {
  const safe = safeRedirectPath(intendedRedirectPath, origin);
  return `/auth/login?redirect=${encodeURIComponent(safe)}`;
}
