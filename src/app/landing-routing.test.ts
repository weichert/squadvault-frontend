// src/app/landing-routing.test.ts
// NEW-MEMBER LANDING ROUTING — Step 2 (tests-first). Source-scan (node env). Change A
// (post-login -> clubhouse), consent-first preserved (founder #3), and data-home reachable.
// The Change-A assertions are RED until Step 3 edits page.tsx; the consent-first + data-home
// assertions PASS now and are GUARDS that must keep passing.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const HOME = "src/app/page.tsx";
const INVITE = "src/app/api/members/invite/route.ts";
const NAV = "src/components/ui/top-nav.tsx";

describe("Change A — post-login lands on the Clubhouse (RED until Step 3)", () => {
  const src = () => read(HOME);
  it("the authed-root redirect targets /league/{canonical}/clubhouse", () => {
    // page.tsx:21 today -> `/league/${CANONICAL_LEAGUE_ID}`; Step 3 appends /clubhouse.
    expect(src()).toMatch(/redirect\(`\/league\/\$\{CANONICAL_LEAGUE_ID\}\/clubhouse`\)/);
  });
  it("the splash sign-in link redirects to the clubhouse", () => {
    // page.tsx:48 today -> `/auth/login?redirect=/league/${CANONICAL_LEAGUE_ID}`.
    expect(src()).toMatch(/\/auth\/login\?redirect=\/league\/\$\{CANONICAL_LEAGUE_ID\}\/clubhouse/);
  });
});

describe("consent-first preserved — invite still routes first-login to /consent (founder #3; GUARD)", () => {
  it("the invite redirect targets /consent, NOT /clubhouse", () => {
    const src = read(INVITE);
    expect(src, "invite -> /consent").toMatch(/`\/league\/\$\{leagueRow\.canonical_id\}\/consent`/);
    expect(src, "invite must NOT route to the clubhouse").not.toMatch(/\/clubhouse/);
  });
});

describe("data home stays reachable — the Community tab still points at /league/[id] (GUARD)", () => {
  it("the nav exposes a bare /league/{id} destination (the data home)", () => {
    const src = read(NAV);
    // The 'Community' tab's href is the bare league route (top-nav.tsx).
    expect(src).toMatch(/href:\s*\(id\)\s*=>\s*`\/league\/\$\{id\}`/);
  });
});

describe("Change A-2 — the signed-in chip's Sign-in lands on the Clubhouse (G3 finding; RED until fix)", () => {
  // The signed-in indicator's anonymous "Sign in" chip is a post-login ENTRY POINT that
  // postdates the original trace; its signInHref must route to the Clubhouse via the canonical
  // seam (clubhouseHref(id)), not the bare data home /league/${id} (which landed the founder on
  // the ledger). `id` is the params CANONICAL id (no UUID 404). safeRedirectPath still validates.
  const LAYOUT = "src/app/league/[id]/layout.tsx";
  it("the chip's signInHref is built from clubhouseHref(id) (canonical seam)", () => {
    const src = read(LAYOUT);
    expect(src, "signInHref uses the canonical clubhouse seam").toMatch(/signInHref:\s*buildSignInHref\(\s*clubhouseHref\(\s*id\s*\)/);
  });
  it("the chip's signInHref does NOT target the bare data home /league/${id}", () => {
    const src = read(LAYOUT);
    expect(src, "no bare-league sign-in redirect").not.toMatch(/buildSignInHref\(\s*`\/league\/\$\{id\}`/);
  });
});
