// src/lib/nav/routes.test.ts
// NEW-MEMBER LANDING ROUTING — Step 2 (tests-first). Pure canonical-route seam. Node env.
// RED until Step 3 creates src/lib/nav/routes.ts.
//
// This is half of the founder's #1 (canonical-id) test: the clubhouse href is built from a
// canonical league id in the /league/{id}/clubhouse shape. Passing the CANONICAL id yields
// the canonical path (the UUID trap is guarded at the wiring layer — see
// member-consent-clubhouse.test.ts). One tested place for the path shape, reused by the
// consent affordance (Change B).
import { describe, it, expect } from "vitest";
import { clubhouseHref } from "@/lib/nav/routes";

describe("clubhouseHref — the canonical clubhouse path", () => {
  it("builds /league/{canonicalId}/clubhouse", () => {
    expect(clubhouseHref("70985")).toBe("/league/70985/clubhouse");
  });

  it("is a relative same-origin path (no origin, no protocol — no open-redirect surface)", () => {
    const href = clubhouseHref("70985");
    expect(href.startsWith("/league/")).toBe(true);
    expect(href.endsWith("/clubhouse")).toBe(true);
    expect(href).not.toMatch(/^https?:|^\/\//); // not absolute, not protocol-relative
    expect(href).not.toMatch(/\/\/+/); // no doubled slashes
  });
});
