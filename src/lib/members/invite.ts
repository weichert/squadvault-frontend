// src/lib/members/invite.ts
// Pure, request-scope-free helpers for the commissioner invite route
// (src/app/api/members/invite/route.ts). They live outside the route module because Next
// App Router route files may only export HTTP handlers + config (a non-handler export
// breaks the route type contract); extracting the branch-selection, redirect composition,
// and log redaction here keeps them unit-testable (the src/lib/auth/callback.ts precedent).

export type InviteErrorKind = "rate_limit" | "already_registered" | "other";

export interface InviteErrorClass {
  kind: InviteErrorKind;
  // HTTP status to return for the terminating kinds (rate_limit=429, other=502).
  // already_registered does not terminate (the route continues to resolveExistingUserId);
  // its status is 0 and unused.
  status: number;
  // Stable log branch tag for the masking-fix logging (F1).
  tag: string;
  // Generic client-facing body; NEVER leaks upstream detail.
  clientMessage: string;
}

// GoTrue surfaces AuthError-ish objects. We read only these fields defensively.
export interface GotrueErrorShape {
  status?: number | null;
  code?: string | null;
  message?: string | null;
}

// F2 — distinguish invite failure classes so the old single catch-all (three unrelated
// causes collapsing into one opaque 502) is no longer reachable:
//   rate_limit         -> 429 with a distinct client message, terminates.
//   already_registered -> the address already has an auth user; NOT a failure. The route
//                         resolves the existing user id and still records the link.
//   other              -> a genuinely unexpected GoTrue error -> 502 with its own tag.
export function classifyInviteError(
  err: GotrueErrorShape | null | undefined,
): InviteErrorClass {
  const code = (err?.code ?? "").toLowerCase();
  const message = (err?.message ?? "").toLowerCase();
  const status = err?.status ?? null;

  if (
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    message.includes("rate limit")
  ) {
    return {
      kind: "rate_limit",
      status: 429,
      tag: "invite:gotrue-refused",
      clientMessage: "Email limit reached — wait and retry.",
    };
  }

  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    status === 422 ||
    message.includes("already been registered") ||
    message.includes("already registered")
  ) {
    return {
      kind: "already_registered",
      status: 0,
      tag: "invite:already-registered",
      clientMessage: "",
    };
  }

  return {
    kind: "other",
    status: 502,
    tag: "invite:gotrue-error",
    clientMessage: "Could not issue the invite. Try again shortly.",
  };
}

// F3 (Gate B, 2026-07-07) — the invited member authenticates through /auth/callback, the
// ONLY route that runs verifyOtp on the emailed token_hash; the callback then forwards to
// the inner consent path via safeRedirectPath. The consent page does NOT verify token_hash
// (it calls getViewer and, with no session, redirects to /auth/login), so redirecting
// straight to it would bounce the member off the login wall. The callback therefore stays
// the entry point. `origin` is derived from the request (no build-inlined NEXT_PUBLIC_APP_URL
// literal). See docs/auth_email_template_contract.md for the template <-> code contract.
export function buildInviteRedirect(origin: string, canonicalId: string): string {
  const consentPath = `/league/${canonicalId}/consent`;
  return `${origin}/auth/callback?redirect=${encodeURIComponent(consentPath)}`;
}

// F1 — never log a full email. Keep the first local-part character + the domain so an
// operator can correlate a log line without the address being exposed. Malformed input
// (no local part before '@') collapses to "***".
//   redactEmail("steven.weichert@gmail.com") -> "s***@gmail.com"
export function redactEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***@${email.slice(at + 1)}`;
}
