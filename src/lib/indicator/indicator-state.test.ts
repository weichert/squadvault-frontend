// src/lib/indicator/indicator-state.test.ts
// SIGNED-IN INDICATOR — Step 2 (tests-first). The constitutional core as a PURE seam
// (node env, no DOM/DB — the coach-office/resolvers idiom). RED until Step 3 creates
// src/lib/indicator/indicator-state.ts.
//
// Founder's two hardest-read areas at G2 are pinned here:
//   (1) the HONEST-FALLBACK test — a signed-in viewer whose franchise does not resolve
//       shows "Signed in" (or the commissioner state), NEVER a fabricated name and NEVER
//       a blank chip that reads as broken; the resolved name is only ever the input name.
//   (2) the REDIRECT-VALIDATION test — the anonymous sign-in href routes /league/{id}
//       through safeRedirectPath, so an off-origin target can never be smuggled in.
import { describe, it, expect } from "vitest";
import { resolveIndicatorState, buildSignInHref } from "@/lib/indicator/indicator-state";

const ORIGIN = "https://squadvault.vercel.app";
const HREF = buildSignInHref("/league/70985", ORIGIN); // a known-safe href for the anon fixtures

describe("resolveIndicatorState — the honest viewer states (brief section 3)", () => {
  it("anonymous (no userId) -> a Sign in affordance", () => {
    const s = resolveIndicatorState({ userId: null, isCommissioner: false, franchiseName: null, signInHref: HREF });
    expect(s.kind).toBe("anonymous");
    expect(s.kind === "anonymous" && s.signInHref).toBe(HREF);
  });

  it("signed in with a resolved franchise -> member, showing exactly the resolved name", () => {
    const s = resolveIndicatorState({ userId: "u1", isCommissioner: false, franchiseName: "Weichert's Warmongers", signInHref: HREF });
    expect(s.kind).toBe("member");
    expect(s.kind === "member" && s.name).toBe("Weichert's Warmongers");
  });

  // (1) THE HONEST-FALLBACK TESTS — the most important (successor note; founder flag).
  it("signed in, franchise UNRESOLVED, commissioner -> honest commissioner state (no fabricated name)", () => {
    const s = resolveIndicatorState({ userId: "u1", isCommissioner: true, franchiseName: null, signInHref: HREF });
    expect(s.kind).toBe("commissioner");
    expect(JSON.stringify(s)).not.toMatch(/name/); // carries no name field at all
  });

  it("signed in, franchise UNRESOLVED, not commissioner -> honest 'Signed in' fallback (never fabricated)", () => {
    const s = resolveIndicatorState({ userId: "u1", isCommissioner: false, franchiseName: null, signInHref: HREF });
    expect(s.kind).toBe("signed_in");
    expect(JSON.stringify(s)).not.toMatch(/name/);
  });

  it("an empty / whitespace franchise name is treated as UNRESOLVED -> honest fallback, never a blank chip", () => {
    for (const blank of ["", "   ", "\t"]) {
      const s = resolveIndicatorState({ userId: "u1", isCommissioner: false, franchiseName: blank, signInHref: HREF });
      expect(s.kind, `blank=${JSON.stringify(blank)}`).toBe("signed_in");
    }
  });

  it("member.name is ONLY ever the input name — never synthesized from id/role/anything", () => {
    const s = resolveIndicatorState({ userId: "u1", isCommissioner: true, franchiseName: "Paradis' Playmakers", signInHref: HREF });
    // franchise name wins even for a commissioner (they are a member with a team).
    expect(s.kind).toBe("member");
    expect(s.kind === "member" && s.name).toBe("Paradis' Playmakers");
  });
});

describe("buildSignInHref — redirect routed through safeRedirectPath (D-2; no open redirect)", () => {
  it("a same-origin league path is preserved as the redirect", () => {
    expect(buildSignInHref("/league/70985", ORIGIN)).toBe(`/auth/login?redirect=${encodeURIComponent("/league/70985")}`);
  });

  it("an absolute off-origin target is neutralized (never smuggled through)", () => {
    const href = buildSignInHref("https://evil.example/phish", ORIGIN);
    expect(href).not.toContain("evil.example");
    expect(href).toBe(`/auth/login?redirect=${encodeURIComponent("/")}`);
  });

  it("a protocol-relative off-origin target is neutralized", () => {
    const href = buildSignInHref("//evil.example", ORIGIN);
    expect(href).not.toContain("evil.example");
    expect(href).toBe(`/auth/login?redirect=${encodeURIComponent("/")}`);
  });
});
