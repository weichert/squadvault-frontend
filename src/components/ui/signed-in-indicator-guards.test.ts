// src/components/ui/signed-in-indicator-guards.test.ts
// SIGNED-IN INDICATOR — Step 2 (tests-first). Source-scan guards (node env; the
// coach-office/no-bake idiom). RED until Step 3 creates the source. These pin the
// second area the founder reads hardest: NO auth-logic change + server-side resolution
// (which structurally forbids client-side tracking) + NO analytics, and the additive-nav
// guarantee.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const has = (rel: string) => existsSync(path.join(ROOT, rel));

// Source the indicator adds or modifies (Step 3). Tests-first: RED until these exist.
const NEW_SOURCE = [
  "src/lib/indicator/indicator-state.ts",
  "src/lib/indicator/viewer-franchise.ts",
  "src/components/ui/signed-in-indicator.tsx",
];
const INDICATOR_PRESENTATIONAL = "src/components/ui/signed-in-indicator.tsx";
const NAV = "src/components/ui/top-nav.tsx";
const LEAGUE_LIB = "src/lib/league.ts";

// Analytics / tracking / engagement primitives that must never appear (brief section 4).
const FORBIDDEN_ANALYTICS: RegExp[] = [
  /analytics/i,
  /\btrack\b/i,
  /sendBeacon/i,
  /\bbeacon\b/i,
  /gtag/i,
  /mixpanel/i,
  /\bsegment\b/i,
  /posthog/i,
  /\bpresence\b/i,
  /heartbeat/i,
  /who'?s online/i,
];

describe("no analytics / tracking / engagement mechanic (brief section 4)", () => {
  it("all new-source files exist by Step 3 (tests-first: RED until implemented)", () => {
    for (const f of NEW_SOURCE) expect(has(f), `${f} must exist`).toBe(true);
  });

  it("no analytics/tracking primitive in the indicator source", () => {
    for (const f of NEW_SOURCE) {
      if (!has(f)) continue;
      const src = read(f);
      for (const rx of FORBIDDEN_ANALYTICS) {
        expect(src, `${f} contains forbidden analytics primitive ${rx}`).not.toMatch(rx);
      }
    }
  });
});

describe("server-side resolution — the display is presentational, auth resolved upstream", () => {
  it("the indicator component imports NO auth/session/db — it receives pre-resolved state", () => {
    if (!has(INDICATOR_PRESENTATIONAL)) return; // checked once it lands (existence asserted above)
    const src = read(INDICATOR_PRESENTATIONAL);
    // presentational: no client-side auth read (that is what forbids any client tracking).
    expect(src, "must not read the session client-side").not.toMatch(/createServerClient|createClient|auth\.getUser|getViewer|@supabase/);
  });
});

describe("no auth-logic change — getViewer consumed unchanged (successor note 6)", () => {
  it("league.ts still exports getViewer with its { userId, isCommissioner } contract", () => {
    const src = read(LEAGUE_LIB);
    expect(src).toMatch(/export const getViewer\s*=/);
    expect(src).toMatch(/userId/);
    expect(src).toMatch(/isCommissioner/);
  });
});

describe("additive nav — byte-identical when the indicator prop is absent (D-1/no fork)", () => {
  it("TopNav exposes an optional `indicator?` prop, conditionally rendered", () => {
    const src = read(NAV);
    expect(src, "optional indicator prop").toMatch(/indicator\?:/);
    expect(src, "indicator rendered only when supplied").toMatch(/indicator\s*&&|indicator\s*\?/);
  });
});
