// src/app/api/members/invite/route.test.ts
// Handler-level suite for the commissioner invite route (E2.3-minimal hardening,
// 2026-07-07). Drives POST() with mocked Supabase clients + isLeagueCommissioner and
// asserts the ratified acceptance criteria (Gate A):
//   T1  rate-limit GoTrue error   -> 429 + distinct message, logs invite:gotrue-refused
//   T2a link-insert failure       -> 502, logs invite:link-insert
//   T2b pointer-update failure    -> 502, logs invite:pointer-update
//   T3  redirectTo == callback-entry contract, built from the request origin (Gate B)
//   T4  re-invite of a linked pair -> success, NO second insert (idempotent)
//   T5  pointer failure leaves ZERO link rows (orphan window closed via admin delete)
//   T6  no console.error argument contains a full email (redaction holds)
// Mocks the two client factories + isLeagueCommissioner; the handler under test is the
// real one that ships. Written BEFORE implementation.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/av-room", () => ({
  isLeagueCommissioner: vi.fn(),
}));

import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { isLeagueCommissioner } from "@/lib/av-room";
import { POST } from "@/app/api/members/invite/route";

const O = "https://app.example";
const enc = encodeURIComponent;
const CANON = "70985";
const COMMISH = "commish-1";
const MEMBER = "member-9";
const FRANCHISE = "fr-1";
const LEAGUE_UUID = "lg-uuid";
const LINK_ID = "link-1";

// A chainable query-builder mock. Terminal methods (maybeSingle/single/limit) and the
// awaited chain (update/delete via `then`) resolve to per-table configured results; every
// insert/update/delete/eq is recorded on `calls` so tests can assert write ordering and
// the orphan-cleanup target id.
function makeClient(name: string, tables: Record<string, any>, calls: any[], auth?: any) {
  const from = vi.fn((table: string) => {
    const t = tables[table] ?? {};
    const b: any = {};
    b.select = vi.fn(() => b);
    b.insert = vi.fn((v: any) => {
      calls.push({ client: name, table, op: "insert", v });
      b._op = "insert";
      return b;
    });
    b.update = vi.fn((v: any) => {
      calls.push({ client: name, table, op: "update", v });
      b._op = "update";
      return b;
    });
    b.delete = vi.fn(() => {
      calls.push({ client: name, table, op: "delete" });
      b._op = "delete";
      return b;
    });
    b.eq = vi.fn((k: string, val: unknown) => {
      calls.push({ client: name, table, op: "eq", k, val, after: b._op });
      return b;
    });
    b.limit = vi.fn(() => Promise.resolve(t.limit ?? { data: [], error: null }));
    b.maybeSingle = vi.fn(() => Promise.resolve(t.maybeSingle ?? { data: null }));
    b.single = vi.fn(() => Promise.resolve(t.single ?? { data: null, error: null }));
    b.then = (onF: any, onR: any) =>
      Promise.resolve(t.then ?? { error: null }).then(onF, onR);
    return b;
  });
  return { from, auth, calls };
}

// Happy-path fixtures; each test overrides only the piece it exercises.
function fixtures(over: {
  invite?: { data?: any; error?: any };
  existingLink?: any; // authed franchise_member_links maybeSingle
  insert?: { data?: any; error?: any }; // authed franchise_member_links single
  pointer?: { error?: any }; // authed franchises then
  user?: any;
} = {}) {
  const adminCalls: any[] = [];
  const authedCalls: any[] = [];

  const invite = vi.fn(async () =>
    over.invite ?? { data: { user: { id: MEMBER } }, error: null },
  );
  const listUsers = vi.fn(async () => ({ data: { users: [] }, error: null }));

  const admin = makeClient(
    "admin",
    {
      franchises: {
        maybeSingle: {
          data: { id: FRANCHISE, league_id: LEAGUE_UUID, owner_display_name: "The Team" },
        },
      },
      franchise_member_links: { limit: { data: [], error: null }, then: { error: null } },
      leagues: { maybeSingle: { data: { canonical_id: CANON } } },
    },
    adminCalls,
  );
  (admin as any).auth = { admin: { inviteUserByEmail: invite, listUsers } };

  const authed = makeClient(
    "authed",
    {
      franchise_member_links: {
        maybeSingle: over.existingLink ?? { data: null },
        single: over.insert ?? { data: { id: LINK_ID }, error: null },
      },
      franchises: { then: over.pointer ?? { error: null } },
    },
    authedCalls,
  );
  (authed as any).auth = {
    getUser: vi.fn(async () => ({ data: { user: over.user ?? { id: COMMISH } } })),
  };

  (createServerClient as any).mockResolvedValue(authed);
  (createAdminClient as any).mockReturnValue(admin);
  (isLeagueCommissioner as any).mockResolvedValue(true);

  return { admin, authed, adminCalls, authedCalls, invite, listUsers };
}

function post(body: unknown) {
  const req = { url: `${O}/api/members/invite`, json: async () => body } as any;
  return POST(req);
}

let errSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

const tagLogged = (tag: string) =>
  errSpy.mock.calls.some((a: unknown[]) => a[0] === tag);
const payloadFor = (tag: string) =>
  (errSpy.mock.calls.find((a: unknown[]) => a[0] === tag) ?? [])[1] as any;

describe("invite route — hardening (Gate A acceptance)", () => {
  it("T1: rate-limit -> 429 + distinct message, logs invite:gotrue-refused w/ upstream code", async () => {
    fixtures({
      invite: {
        data: null,
        error: { status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" },
      },
    });
    const res = await post({ email: "member@e.com", franchiseId: FRANCHISE });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(String(body.error).toLowerCase()).toContain("limit");
    expect(tagLogged("invite:gotrue-refused")).toBe(true);
    expect(JSON.stringify(payloadFor("invite:gotrue-refused"))).toContain(
      "over_email_send_rate_limit",
    );
  });

  it("T2a: link-insert failure -> 502, logs invite:link-insert", async () => {
    const { authedCalls } = fixtures({
      insert: { data: null, error: { code: "23505", message: "insert boom" } },
    });
    const res = await post({ email: "member@e.com", franchiseId: FRANCHISE });
    expect(res.status).toBe(502);
    expect(tagLogged("invite:link-insert")).toBe(true);
    // no pointer update after a failed insert
    expect(authedCalls.some((c) => c.table === "franchises" && c.op === "update")).toBe(false);
  });

  it("T2b: pointer-update failure -> 502, logs invite:pointer-update", async () => {
    fixtures({ pointer: { error: { code: "42501", message: "pointer boom" } } });
    const res = await post({ email: "member@e.com", franchiseId: FRANCHISE });
    expect(res.status).toBe(502);
    expect(tagLogged("invite:pointer-update")).toBe(true);
  });

  it("T3: redirectTo passed to inviteUserByEmail == callback-entry contract from request origin", async () => {
    const { invite } = fixtures();
    await post({ email: "member@e.com", franchiseId: FRANCHISE });
    expect(invite).toHaveBeenCalledTimes(1);
    expect(invite).toHaveBeenCalledWith("member@e.com", {
      redirectTo: `${O}/auth/callback?redirect=${enc(`/league/${CANON}/consent`)}`,
    });
  });

  it("T4: re-invite of an already-linked pair -> success, NO second insert", async () => {
    const { authedCalls } = fixtures({ existingLink: { data: { id: "existing-link" } } });
    const res = await post({ email: "member@e.com", franchiseId: FRANCHISE });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(authedCalls.some((c) => c.table === "franchise_member_links" && c.op === "insert")).toBe(
      false,
    );
  });

  it("T5: pointer-update failure leaves ZERO link rows (admin delete targets the inserted id)", async () => {
    const { adminCalls } = fixtures({ pointer: { error: { message: "pointer boom" } } });
    const res = await post({ email: "member@e.com", franchiseId: FRANCHISE });
    expect(res.status).toBe(502);
    // compensating delete issued on the admin (service-role) client — the only client that
    // can delete (no DELETE RLS policy on franchise_member_links) — targeting the row we
    // just inserted.
    const del = adminCalls.some((c) => c.table === "franchise_member_links" && c.op === "delete");
    const delId = adminCalls.some(
      (c) =>
        c.table === "franchise_member_links" &&
        c.op === "eq" &&
        c.after === "delete" &&
        c.val === LINK_ID,
    );
    expect(del).toBe(true);
    expect(delId).toBe(true);
  });

  it("T6: no console.error argument ever contains the full email (redaction holds)", async () => {
    fixtures({ pointer: { error: { message: "pointer boom" } } });
    const fullEmail = "steven.weichert@gmail.com";
    await post({ email: fullEmail, franchiseId: FRANCHISE });
    for (const call of errSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(fullEmail);
    }
  });
});
