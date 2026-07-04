// src/lib/auth/callback.test.ts
// Vitest unit suite for the two pure auth functions (D-Q harness). Asserts the ratified
// PR #43 (resolveAuthSession) and PR #44 (safeRedirectPath) contracts against the code as
// it stands - no source behavior is changed by this unit. Explicit assertions only; no
// snapshots. Outcomes here are the 34 cases frozen at Gate 1 (2026-07-03) and verified by
// a ground-truth probe of the real function before implementation.
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { resolveAuthSession, safeRedirectPath } from "@/lib/auth/callback";

const O = "https://app.example";
const enc = encodeURIComponent;
// Build a self-referential /auth/callback URL that nests `inner` in its own ?redirect=,
// the shape the callers hand Supabase as redirectTo. Composable to test the depth cap.
const cb = (inner: string) => `${O}/auth/callback?redirect=${enc(inner)}`;

describe("safeRedirectPath", () => {
  // The frozen case table. `expected` is the exact same-origin relative path the function
  // returns; every row was confirmed against the real implementation at Gate 1.
  const cases: Array<{ name: string; input: string; expected: string }> = [
    // --- accepted same-origin destinations ---
    { name: "relative path preserved", input: "/league/70985/consent", expected: "/league/70985/consent" },
    { name: 'bare "/" preserved', input: "/", expected: "/" },
    { name: "query + hash preserved", input: "/x?a=1#h", expected: "/x?a=1#h" },
    { name: "same-origin absolute -> path (the {{ .RedirectTo }} carry-through)", input: `${O}/league/70985/consent`, expected: "/league/70985/consent" },
    { name: "nested callback unwrapped to inner destination", input: cb("/league/70985/consent"), expected: "/league/70985/consent" },
    { name: "callback URL with no nested redirect -> /", input: `${O}/auth/callback`, expected: "/" },
    // --- depth cap boundary (MAX_UNWRAP_DEPTH = 3) ---
    { name: "3 nested callbacks unwrap to inner (at the cap)", input: cb(cb(cb("/x"))), expected: "/x" },
    { name: "4 nested callbacks exceed the cap -> /", input: cb(cb(cb(cb("/x")))), expected: "/" },
    // --- open-redirect vectors: all collapse to "/" (constraint-2 mandatory set) ---
    { name: "cross-origin absolute rejected", input: "https://evil.example/steal", expected: "/" },
    { name: "protocol-relative // rejected", input: "//evil.example", expected: "/" },
    { name: "nested cross-origin re-validated and rejected", input: `${O}/auth/callback?redirect=https://evil.example`, expected: "/" },
    { name: "nested protocol-relative rejected", input: cb("//evil.example"), expected: "/" },
    { name: "javascript: scheme rejected (opaque origin)", input: "javascript:alert(1)", expected: "/" },
    { name: "data: scheme rejected (opaque origin)", input: "data:text/html,x", expected: "/" },
    // backslash variants that normalize to protocol-relative -> rejected
    { name: "double backslash normalizes to protocol-relative -> rejected", input: "\\\\evil.example", expected: "/" },
    { name: "slash-backslash normalizes to protocol-relative -> rejected", input: "/\\evil.example", expected: "/" },
    { name: "backslash-slash normalizes to protocol-relative -> rejected", input: "\\/evil.example", expected: "/" },
    // --- same-origin-but-notable outcomes (frozen as safe; not open redirects) ---
    { name: "single backslash resolves to a same-origin path (safe)", input: "\\evil.example", expected: "/evil.example" },
    { name: "empty string resolves to /", input: "", expected: "/" },
    { name: "whitespace resolves to /", input: " ", expected: "/" },
    { name: "non-URL string stays a same-origin relative path (safe)", input: "not-a-url", expected: "/not-a-url" },
  ];

  for (const { name, input, expected } of cases) {
    it(name, () => {
      expect(safeRedirectPath(input, O)).toBe(expected);
    });
  }

  // Row 21 (undefined) is called out separately because its outcome is a registered wart.
  // Ratified at Gate 1 as DOCUMENTED CURRENT BEHAVIOR: `undefined` coerces to the string
  // "undefined", yielding a same-origin path "/undefined". The same-origin security
  // invariant still holds (it is not an open redirect), but "/undefined" is NOT a contract
  // endorsement - a future fix that normalizes it changes this test with it.
  it('undefined coerces to a same-origin "/undefined" (registered wart, not endorsed)', () => {
    expect(safeRedirectPath(undefined as unknown as string, O)).toBe("/undefined");
  });

  // The core security property, asserted across every case above plus the wart: the result
  // is ALWAYS a same-origin relative path, so `${origin}${result}` can never open-redirect.
  it("every result is a same-origin relative path (no open redirect)", () => {
    const inputs = [...cases.map((c) => c.input), undefined as unknown as string];
    for (const input of inputs) {
      const result = safeRedirectPath(input, O);
      expect(result.startsWith("/")).toBe(true);
      expect(new URL(result, O).origin).toBe(O);
    }
  });
});

// Minimal Supabase stand-in: only the two auth methods resolveAuthSession touches, each a
// vi.fn() so calls/args are observable. Tests assert BRANCH SELECTION, not the network.
type MockUser = { id: string; email: string | null } | null;
function makeClient(opts: {
  verify?: { user?: MockUser; error?: boolean };
  exchange?: { user?: MockUser };
}) {
  const verifyOtp = vi.fn(async () => ({
    data: { user: opts.verify?.user ?? null, session: null },
    error: opts.verify?.error ? { message: "invalid token" } : null,
  }));
  const exchangeCodeForSession = vi.fn(async () => ({
    data: { session: opts.exchange?.user ? { user: opts.exchange.user } : null },
    error: null,
  }));
  const client = { auth: { verifyOtp, exchangeCodeForSession } } as unknown as SupabaseClient<Database>;
  return { client, verifyOtp, exchangeCodeForSession };
}

describe("resolveAuthSession", () => {
  it("token_hash + type -> verifyOtp path; returns identity; code untouched", async () => {
    const { client, verifyOtp, exchangeCodeForSession } = makeClient({ verify: { user: { id: "u-1", email: "a@b.com" } } });
    const r = await resolveAuthSession(client, { token_hash: "TH", type: "invite", code: null });
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledWith({ type: "invite", token_hash: "TH" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(r).toEqual({ userId: "u-1", userEmail: "a@b.com" });
  });

  it("verified user with null email -> userEmail undefined", async () => {
    const { client } = makeClient({ verify: { user: { id: "u-1", email: null } } });
    const r = await resolveAuthSession(client, { token_hash: "TH", type: "magiclink", code: null });
    expect(r.userId).toBe("u-1");
    expect(r.userEmail).toBeUndefined();
  });

  it("verifyOtp error -> empty, no throw", async () => {
    const { client, exchangeCodeForSession } = makeClient({ verify: { error: true } });
    const r = await resolveAuthSession(client, { token_hash: "BAD", type: "invite", code: null });
    expect(r).toEqual({});
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("verifyOtp no error but null user -> empty", async () => {
    const { client } = makeClient({ verify: { user: null } });
    const r = await resolveAuthSession(client, { token_hash: "TH", type: "invite", code: null });
    expect(r).toEqual({});
  });

  it("token_hash present but type missing -> no auth call, empty", async () => {
    const { client, verifyOtp, exchangeCodeForSession } = makeClient({});
    const r = await resolveAuthSession(client, { token_hash: "TH", type: null, code: null });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(r).toEqual({});
  });

  it("type present but token_hash missing -> no auth call, empty", async () => {
    const { client, verifyOtp, exchangeCodeForSession } = makeClient({});
    const r = await resolveAuthSession(client, { token_hash: null, type: "invite", code: null });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(r).toEqual({});
  });

  it("legacy ?code= only -> exchangeCodeForSession fallback returns identity", async () => {
    const { client, verifyOtp, exchangeCodeForSession } = makeClient({ exchange: { user: { id: "u-2", email: "c@d.com" } } });
    const r = await resolveAuthSession(client, { token_hash: null, type: null, code: "PKCE" });
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("PKCE");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(r).toEqual({ userId: "u-2", userEmail: "c@d.com" });
  });

  it("?code= with no session -> undefined identity", async () => {
    const { client } = makeClient({ exchange: { user: null } });
    const r = await resolveAuthSession(client, { token_hash: null, type: null, code: "PKCE" });
    expect(r.userId).toBeUndefined();
    expect(r.userEmail).toBeUndefined();
  });

  it("?code= exchanged user with null email -> userEmail undefined", async () => {
    const { client } = makeClient({ exchange: { user: { id: "u-3", email: null } } });
    const r = await resolveAuthSession(client, { token_hash: null, type: null, code: "PKCE" });
    expect(r.userId).toBe("u-3");
    expect(r.userEmail).toBeUndefined();
  });

  it("no credential at all -> empty, neither method called", async () => {
    const { client, verifyOtp, exchangeCodeForSession } = makeClient({});
    const r = await resolveAuthSession(client, { token_hash: null, type: null, code: null });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(r).toEqual({});
  });

  it("token_hash + type takes precedence over a co-present code", async () => {
    const { client, verifyOtp, exchangeCodeForSession } = makeClient({ verify: { user: { id: "u-1", email: "a@b.com" } } });
    const r = await resolveAuthSession(client, { token_hash: "TH", type: "invite", code: "PKCE" });
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(r).toEqual({ userId: "u-1", userEmail: "a@b.com" });
  });

  it("verifyOtp error does NOT fall through to a co-present code", async () => {
    const { client, verifyOtp, exchangeCodeForSession } = makeClient({ verify: { error: true }, exchange: { user: { id: "u-2", email: "c@d.com" } } });
    const r = await resolveAuthSession(client, { token_hash: "BAD", type: "invite", code: "PKCE" });
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(r).toEqual({});
  });
});
