// src/components/consent/member-consent-clubhouse.test.ts
// NEW-MEMBER LANDING ROUTING — Step 2 (tests-first). Source-scan (node env; the
// coach-office/no-bake idiom) over the Change-B surface. RED until Step 3. These pin three
// of the founder's four hardest-read tests: the canonical-id trap, proceed-without-grant,
// and no-auto-bounce. (The definitive coercion-free / no-bounce UX is confirmed at G3; these
// structural guards prevent the regressions that would break silently.)
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const PANEL = "src/components/consent/member-consent-panel.tsx";
const CONSENT_PAGE = "src/app/league/[id]/consent/page.tsx";

describe("canonical-id trap — the clubhouse link uses the CANONICAL id, never the UUID (founder #1)", () => {
  it("consent/page.tsx passes the canonical id (params `id`) to the panel as canonicalId", () => {
    const src = read(CONSENT_PAGE);
    // `const { id } = await params` is the canonical id; it must be handed to the panel.
    expect(src, "panel receives canonicalId={id}").toMatch(/canonicalId=\{id\}/);
  });

  it("the panel builds the clubhouse href from the canonical id via clubhouseHref(canonicalId)", () => {
    const src = read(PANEL);
    expect(src, "uses the canonical-route seam").toMatch(/clubhouseHref\(\s*canonicalId\s*\)/);
  });

  it("the panel NEVER builds a clubhouse href from leagueId (the UUID -> 404 trap)", () => {
    const src = read(PANEL);
    expect(src, "no UUID clubhouse path").not.toMatch(/\/league\/\$\{leagueId\}\/clubhouse/);
    expect(src, "no clubhouseHref(leagueId)").not.toMatch(/clubhouseHref\(\s*leagueId\s*\)/);
  });
});

describe("proceed-without-grant — the door is coercion-free (founder #2; D-B2)", () => {
  it("the panel renders an 'Enter the Clubhouse' affordance", () => {
    expect(read(PANEL)).toMatch(/Enter the Clubhouse/);
  });

  it("no grant-count / grant-aggregation gate exists that could condition proceeding on a grant", () => {
    const src = read(PANEL);
    // W.6 is default-no; proceeding must never require a grant. Assert no coercion-gate logic.
    expect(src, "no grant-count gate").not.toMatch(/grantedCount|hasAnyGrant|Object\.values\(\s*current\s*\)/);
  });

  it("recording a grant is independent of the door — act() still POSTs the consent event", () => {
    // The affordance must not interfere with the grant write path.
    expect(read(PANEL)).toMatch(/fetch\(\s*['"]\/api\/consent\/events['"]/);
  });
});

describe("no-auto-bounce — recording a grant does NOT navigate away (founder #4; B1)", () => {
  it("act() keeps router.refresh() (state updates in place)", () => {
    expect(read(PANEL)).toMatch(/router\.refresh\(\)/);
  });

  it("the panel performs NO programmatic navigation (no router.push / router.replace)", () => {
    const src = read(PANEL);
    expect(src, "no router.push").not.toMatch(/router\.push\(/);
    expect(src, "no router.replace").not.toMatch(/router\.replace\(/);
  });
});
