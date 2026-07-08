// src/lib/members/invite.test.ts
// Unit suite for the pure invite helpers extracted from the commissioner invite route
// (src/app/api/members/invite/route.ts). These cover the branch-selection (F2 error
// classes), the redirect contract shape (F3, Gate B: callback-entry retained), and the
// email redaction used on every log path (F1 / test #6). Written BEFORE implementation
// per the ratified test list (Gate A, 2026-07-07). Explicit assertions only.
import { describe, it, expect } from "vitest";
import {
  classifyInviteError,
  buildInviteRedirect,
  redactEmail,
} from "@/lib/members/invite";

const enc = encodeURIComponent;

describe("classifyInviteError (F2 — distinct invite failure classes)", () => {
  it("429 status -> rate_limit, tag invite:gotrue-refused, 429", () => {
    const c = classifyInviteError({ status: 429, code: null, message: "too many" });
    expect(c.kind).toBe("rate_limit");
    expect(c.status).toBe(429);
    expect(c.tag).toBe("invite:gotrue-refused");
    expect(c.clientMessage.toLowerCase()).toContain("limit");
  });

  it("over_email_send_rate_limit code -> rate_limit even without 429 status", () => {
    const c = classifyInviteError({ status: 400, code: "over_email_send_rate_limit" });
    expect(c.kind).toBe("rate_limit");
    expect(c.status).toBe(429);
  });

  it("email_exists code -> already_registered (continues to resolve)", () => {
    const c = classifyInviteError({ status: 422, code: "email_exists" });
    expect(c.kind).toBe("already_registered");
  });

  it("'already been registered' message -> already_registered", () => {
    const c = classifyInviteError({
      message: "A user with this email address has already been registered",
    });
    expect(c.kind).toBe("already_registered");
  });

  it("unclassified error -> other, tag invite:gotrue-error, 502 (distinct from rate/registered)", () => {
    const c = classifyInviteError({ status: 500, code: "unexpected_failure", message: "boom" });
    expect(c.kind).toBe("other");
    expect(c.status).toBe(502);
    expect(c.tag).toBe("invite:gotrue-error");
  });

  it("null/undefined error -> other (never throws)", () => {
    expect(classifyInviteError(null).kind).toBe("other");
    expect(classifyInviteError(undefined).kind).toBe("other");
  });

  it("the three classes carry three distinct tags", () => {
    const tags = new Set([
      classifyInviteError({ status: 429 }).tag,
      classifyInviteError({ code: "email_exists" }).tag,
      classifyInviteError({ code: "x" }).tag,
    ]);
    expect(tags.size).toBe(3);
  });
});

describe("buildInviteRedirect (F3 — callback-entry contract, Gate B)", () => {
  it("wraps the consent path inside /auth/callback?redirect= on the given origin", () => {
    const url = buildInviteRedirect("https://app.example", "70985");
    expect(url).toBe(
      `https://app.example/auth/callback?redirect=${enc("/league/70985/consent")}`,
    );
  });

  it("uses the request origin verbatim (no build-inlined literal)", () => {
    expect(buildInviteRedirect("https://preview-abc.vercel.app", "acme")).toBe(
      `https://preview-abc.vercel.app/auth/callback?redirect=${enc("/league/acme/consent")}`,
    );
  });

  it("does NOT redirect straight to the consent page (would skip verifyOtp)", () => {
    const url = buildInviteRedirect("https://app.example", "70985");
    expect(url).toContain("/auth/callback?redirect=");
    expect(url).not.toBe("https://app.example/league/70985/consent");
  });
});

describe("redactEmail (F1 — never log a full address)", () => {
  it("keeps first local char + domain, masks the rest", () => {
    expect(redactEmail("steven.weichert@gmail.com")).toBe("s***@gmail.com");
  });

  it("never returns the full local part", () => {
    const r = redactEmail("commissioner@league.org");
    expect(r).not.toContain("commissioner");
    expect(r).toContain("@league.org");
  });

  it("degrades safely on a malformed address", () => {
    expect(redactEmail("not-an-email")).toBe("***");
    expect(redactEmail("")).toBe("***");
  });
});
