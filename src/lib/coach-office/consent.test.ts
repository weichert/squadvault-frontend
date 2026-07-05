// src/lib/coach-office/consent.test.ts
// G2 obligations T2.* — the CO-R1 fail-closed consent gate. This is the test set that
// matters most: an office must never leak a member's data to a visitor. Pure seams +
// a stubbed admin client (node environment; no DB, no DOM).
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isGrant, memberHoldsGrant } from "@/lib/coach-office/consent";

describe("isGrant — only an explicit GRANT opens (T2.1, T2.2, T2.3, T2.8)", () => {
  it("current_state 'GRANT' -> true (T2.1)", () => {
    expect(isGrant({ current_state: "GRANT" })).toBe(true);
  });
  it("current_state 'REVOKE' -> false (T2.2)", () => {
    expect(isGrant({ current_state: "REVOKE" })).toBe(false);
  });
  it("absent row (null/undefined) -> false, fail-closed (T2.3)", () => {
    expect(isGrant(null)).toBe(false);
    expect(isGrant(undefined)).toBe(false);
  });
  it("unrecognized / malformed state -> false, defaults closed (T2.8)", () => {
    // A schema drift or typo must never accidentally open the gate.
    for (const s of ["grant", "Granted", "", "PENDING", "GRANTED", "0", "true"]) {
      expect(isGrant({ current_state: s })).toBe(false);
    }
  });
});

// A minimal chainable stub of the admin client's query builder. Every method returns the
// same chainable object; `maybeSingle` yields (or throws) the configured terminal.
function stubAdmin(
  terminal: { data: unknown; error: unknown } | (() => never),
): SupabaseClient<Database> {
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  chain.from = passthrough;
  chain.select = passthrough;
  chain.eq = passthrough;
  chain.maybeSingle =
    typeof terminal === "function" ? terminal : async () => terminal;
  return chain as unknown as SupabaseClient<Database>;
}

describe("memberHoldsGrant — reads the current view, fail-closed (T2.4, T2.5, T2.6, T2.7)", () => {
  const L = "league-uuid";
  const M = "member-uuid";

  it("current GRANT -> true (T2.4 populated / grant path)", async () => {
    const admin = stubAdmin({ data: { current_state: "GRANT" }, error: null });
    expect(await memberHoldsGrant(admin, L, M, "attributed_quotes")).toBe(true);
  });

  it("current REVOKE -> false (T2.5 fail-closed)", async () => {
    const admin = stubAdmin({ data: { current_state: "REVOKE" }, error: null });
    expect(await memberHoldsGrant(admin, L, M, "attributed_quotes")).toBe(false);
  });

  it("no row at all -> false (T2.6 default-posture)", async () => {
    const admin = stubAdmin({ data: null, error: null });
    expect(await memberHoldsGrant(admin, L, M, "attributed_quotes")).toBe(false);
  });

  it("query error -> false (T2.7 fail-closed on I/O error)", async () => {
    const admin = stubAdmin({ data: null, error: { code: "PGRST" } });
    expect(await memberHoldsGrant(admin, L, M, "attributed_quotes")).toBe(false);
  });

  it("thrown exception -> false (T2.7 fail-closed on throw)", async () => {
    const admin = stubAdmin(() => {
      throw new Error("boom");
    });
    expect(await memberHoldsGrant(admin, L, M, "attributed_quotes")).toBe(false);
  });
});
