// src/components/trophy-room/trophy-room-pivot-guards.test.ts
// TROPHY ROOM pivot — Step 2 (tests-first). Source-scan + manifest-geometry guards for the
// Living Room pivot (G1 rulings D-BANDS / D-NAV / D-LOWER / D-PLINTH / D-CASE-NAV,
// 2026-07-07). Node env, the v2-guards idiom. RED until Step 3. The shipped v2 suites
// (guards / no-gamification / manifest) remain law — this file ADDS the pivot's pins.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const has = (rel: string) => existsSync(path.join(ROOT, rel));

const PAGE = "src/app/league/[id]/trophy-hall/page.tsx";
const CASE_VIEW = "src/components/trophy-room/case-view.tsx";
const SEAM = "src/lib/trophy-room/case-view-bands.ts";
const MANIFEST = "public/trophy-hall/hotspots.json";
const TOP_NAV = "src/components/ui/top-nav.tsx";
const NEW_SOURCE = [CASE_VIEW, SEAM];

// The six shipped taxonomy groups the page composes (one baked case per group on the master).
const CATEGORIES = [
  "Annual Awards",
  "Live Records",
  "Permanent Records",
  "Positional Records",
  "Auction & Acquisition",
  "The Championship",
];

type Rect = { x: number; y: number; width: number; height: number };
const within = (r: Rect, w: number, h: number) =>
  r.x >= 0 && r.y >= 0 && r.x + r.width <= w && r.y + r.height <= h;

// Recursively walk src/ collecting .ts/.tsx files (the v2-guards scan helper).
function srcFiles(dir = "src"): string[] {
  const out: string[] = [];
  for (const name of readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    const st = statSync(path.join(ROOT, rel));
    if (st.isDirectory()) out.push(...srcFiles(rel));
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}
const isTest = (f: string) => /\.test\.tsx?$/.test(f);

describe("Step-3 source exists (tests-first: RED until implemented)", () => {
  it("the Case View component + the pure bands seam land by Step 3", () => {
    for (const f of NEW_SOURCE) expect(has(f), `${f} must exist`).toBe(true);
  });
});

describe("LOCKED assets — both pivot renders are in the repo (CO-R4-verified per MANIFEST)", () => {
  it("tr_master_web.webp (the baked room) and tr_case_frontal_web.webp (the Case View) ship", () => {
    expect(has("public/trophy-hall/tr_master_web.webp")).toBe(true);
    expect(has("public/trophy-hall/tr_case_frontal_web.webp")).toBe(true);
  });
});

describe("master swap — the baked room replaces the superseded empty-case master", () => {
  it("the page renders tr_master_web.webp, never th_master_web.webp", () => {
    const src = read(PAGE);
    expect(src, "page uses the pivot master").toMatch(/tr_master_web\.webp/);
    expect(src, "the superseded master must not render").not.toMatch(/th_master_web/);
  });

  it("no production source references the superseded th_master (supersession complete)", () => {
    const offenders = srcFiles().filter((f) => !isTest(f) && /th_master_web/.test(read(f)));
    expect(offenders, `still referencing the superseded master: ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("D-NAV + naming sweep — 'Trophy Room' everywhere a member reads, zero route changes", () => {
  it("no user-facing 'Trophy Hall' remains in production source (the sweep's completeness)", () => {
    // Title-case 'Trophy Hall' is the user-facing label form; route slugs stay lowercase
    // '/trophy-hall' (unchanged plumbing) and all-caps comment headers don't match.
    const offenders = srcFiles().filter((f) => !isTest(f) && /Trophy Hall/.test(read(f)));
    expect(offenders, `user-facing 'Trophy Hall' remains in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("routes are unchanged: both the room route and the fact page persist", () => {
    expect(has(PAGE), "the illustrated room stays at /trophy-hall").toBe(true);
    expect(has("src/app/league/[id]/trophy-room/page.tsx"), "the full record stays at /trophy-room").toBe(true);
  });

  it("the 'Trophy Room' nav tab targets the illustrated room (/trophy-hall)", () => {
    const src = read(TOP_NAV);
    // The tab entry: label 'Trophy Room' whose href builds a /trophy-hall path.
    const tab = src.match(/label:\s*"Trophy Room"[\s\S]{0,200}?href:[^\n]*\n/);
    expect(tab, "a 'Trophy Room' tab exists").toBeTruthy();
    expect(tab![0], "the tab fronts the room, the record is one tap deeper").toMatch(/trophy-hall/);
  });
});

describe("D-CASE-NAV — the Case View is an in-room overlay, never a routed sub-view", () => {
  it("no routed sub-view exists under /trophy-hall (the room spell is unbroken)", () => {
    const dir = path.join(ROOT, "src/app/league/[id]/trophy-hall");
    const entries = readdirSync(dir).filter((n) => statSync(path.join(dir, n)).isDirectory());
    expect(entries, "no sub-route directories under trophy-hall").toEqual([]);
  });

  it("the Case View reuses the shipped RoomModal contract and performs no router navigation", () => {
    if (!has(CASE_VIEW)) return; // RED via the existence suite until Step 3
    const src = read(CASE_VIEW);
    expect(src, "reuses the shipped accessible dialog (focus-trap/Escape/restore)").toMatch(/RoomModal/);
    expect(src, "an overlay, not a navigation").not.toMatch(/useRouter|router\.push/);
  });
});

describe("manifest v3 — the Case View's five measured bands are DATA (geometry never in code)", () => {
  type Band = { shelf: Rect; placard: Rect };
  type CaseViewGeom = {
    image_width: number;
    image_height: number;
    header_plaque: Rect;
    lower_panel: Rect;
    bands: Band[];
  };
  const manifest = () =>
    JSON.parse(read(MANIFEST)) as {
      image_width: number;
      image_height: number;
      case_view?: CaseViewGeom;
      cases?: { id: string; category: string; label: string; zone: Rect; shelves?: unknown }[];
      plinth?: { zone: Rect };
    };

  it("declares the frontal Case View geometry at the landed render's dimensions", () => {
    const cv = manifest().case_view;
    expect(cv, "manifest v3 carries a case_view block").toBeTruthy();
    // tr_case_frontal_web.webp is 1122x1402 (MANIFEST provenance table).
    expect(cv!.image_width).toBe(1122);
    expect(cv!.image_height).toBe(1402);
  });

  it("exactly five bands (four lit shelves + the base counter), top-to-bottom, in frame", () => {
    const cv = manifest().case_view;
    if (!cv) return;
    expect(cv.bands).toHaveLength(5);
    for (let i = 0; i < cv.bands.length; i++) {
      const b = cv.bands[i];
      expect(within(b.shelf, cv.image_width, cv.image_height), `band ${i} shelf in frame`).toBe(true);
      expect(within(b.placard, cv.image_width, cv.image_height), `band ${i} placard in frame`).toBe(true);
      // The brass placard sits on the band's front edge — never floating above its shelf.
      expect(b.placard.y >= b.shelf.y, `band ${i} placard at/below its shelf top`).toBe(true);
    }
    for (let i = 1; i < cv.bands.length; i++) {
      expect(
        cv.bands[i].shelf.y > cv.bands[i - 1].shelf.y,
        `bands ordered top-to-bottom at ${i}`,
      ).toBe(true);
    }
  });

  it("the header plaque (category name) and lower panel (D-LOWER note) are measured, in frame", () => {
    const cv = manifest().case_view;
    if (!cv) return;
    expect(within(cv.header_plaque, cv.image_width, cv.image_height)).toBe(true);
    expect(within(cv.lower_panel, cv.image_width, cv.image_height)).toBe(true);
    expect(cv.header_plaque.y, "header above the bands").toBeLessThan(cv.bands[0].shelf.y);
    const last = cv.bands[cv.bands.length - 1];
    expect(cv.lower_panel.y, "lower panel below the bands").toBeGreaterThan(last.shelf.y);
  });

  it("the room layer is navigational: one case zone per taxonomy group, per-shelf geometry SUPERSEDED", () => {
    const m = manifest();
    expect(m.cases, "case click zones present").toBeTruthy();
    const cats = (m.cases ?? []).map((c) => c.category).sort();
    expect(cats, "exactly the six shipped groups").toEqual([...CATEGORIES].sort());
    for (const c of m.cases ?? []) {
      expect(within(c.zone, m.image_width, m.image_height), `${c.id} zone in frame`).toBe(true);
      // The pivot bakes the room's trophies into the master art; live per-shelf placement
      // moved to the Case View. Room cases carry NO shelf geometry (the superseded v2 key).
      expect(c.shelves, `${c.id} must not carry superseded per-shelf geometry`).toBeUndefined();
    }
  });

  it("the plinth (League Trophy home) is a measured zone on the master", () => {
    const m = manifest();
    expect(m.plinth, "plinth zone present").toBeTruthy();
    expect(within(m.plinth!.zone, m.image_width, m.image_height)).toBe(true);
  });
});

describe("negative gamification — extended to the pivot source (standing law)", () => {
  const FORBIDDEN = [/\bX of Y\b/i, /\b\d+\s*of\s*\d+\b/, /\bprogress\b/i, /\bnext (?:trophy|award|unlock)\b/i, /\bunlock(?:ed|able)?\b/i, /\bearn(?:ed|able)?\b/i, /\bcollect (?:them all|all)\b/i, /\bleaderboard\b/i, /\bstreak\b/i, /\byou might (?:also )?(?:ask|like)\b/i, /\bsuggested\b/i];
  it("no gamification / engagement primitive in the pivot source", () => {
    for (const f of NEW_SOURCE) {
      if (!has(f)) continue;
      const src = read(f);
      for (const rx of FORBIDDEN) expect(src, `${f} contains ${rx}`).not.toMatch(rx);
    }
  });
});

describe("CO-R4 no-bake — the pivot surfaces carry no baked facts", () => {
  it("no baked season year and no baked league identity in the new component/seam/manifest", () => {
    for (const f of [...NEW_SOURCE, MANIFEST]) {
      if (!has(f)) continue;
      const src = read(f);
      expect(src, `${f} bakes a season year`).not.toMatch(/\b(19|20)\d{2}\b/);
      expect(src, `${f} bakes 'Phony Football League'`).not.toMatch(/Phony Football League/);
    }
  });
});
