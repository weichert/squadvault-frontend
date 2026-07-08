// src/components/trophy-room/trophy-hall-v2-guards.test.ts
// TROPHY HALL v2 — Step 2 (tests-first). Source-scan guards (node env; the coach-office/no-bake
// idiom). RED until Step 3. Pins the founder's hardest-read guardrails: negative-gamification
// (extended), no-fact-layer/seam change, the D-4 retirement completeness guard, CO-R4 no-bake,
// and the Escape-stack behavior asserted structurally (RoomModal reuse) where node can reach it.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const has = (rel: string) => existsSync(path.join(ROOT, rel));

const INTERACTIVE = "src/components/trophy-room/trophy-hall-interactive.tsx";
const CASES_LIB = "src/lib/trophy-room/hall-cases.ts";
const CASES_JSON = "public/trophy-hall/hotspots.json";
const FLAT_GALLERY = "src/components/trophy-room/trophy-hall-gallery.tsx";
const NEW_SOURCE = [INTERACTIVE, CASES_LIB];

// Recursively walk src/ collecting .ts/.tsx files (for import-guard scans).
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

describe("Step-3 source exists (tests-first: RED until implemented)", () => {
  it("the interactive component + the cases seam land by Step 3", () => {
    for (const f of NEW_SOURCE) expect(has(f), `${f} must exist`).toBe(true);
  });
});

describe("negative gamification — extended to v2 (founder #5)", () => {
  const FORBIDDEN = [/\bX of Y\b/i, /\b\d+\s*of\s*\d+\b/, /\bprogress\b/i, /\bnext (?:trophy|award|unlock)\b/i, /\bunlock(?:ed|able)?\b/i, /\bearn(?:ed|able)?\b/i, /\bcollect (?:them all|all)\b/i, /\bleaderboard\b/i, /\bstreak\b/i, /\byou might (?:also )?(?:ask|like)\b/i, /\bsuggested\b/i];
  it("no gamification / engagement primitive in the v2 source", () => {
    for (const f of NEW_SOURCE) {
      if (!has(f)) continue;
      const src = read(f);
      for (const rx of FORBIDDEN) expect(src, `${f} contains ${rx}`).not.toMatch(rx);
    }
  });
});

describe("CO-R4 no-bake — enlarged art + shelves carry no baked labels", () => {
  const SURFACES = [INTERACTIVE, CASES_JSON];
  it("no baked season year and no baked league identity in the illustrated surfaces", () => {
    for (const f of SURFACES) {
      if (!has(f)) continue;
      const src = read(f);
      expect(src, `${f} bakes a season year`).not.toMatch(/\b(19|20)\d{2}\b/);
      expect(src, `${f} bakes 'Phony Football League'`).not.toMatch(/Phony Football League/);
    }
  });
});

describe("no fact-layer / seam change — v1 seams CONSUMED, not rebuilt (founder #8)", () => {
  it("the detail receipt consumes the shipped resolveObjectReceipt seam (does not redefine buildReceipt)", () => {
    if (!has(CASES_LIB)) return;
    const src = read(CASES_LIB);
    expect(src, "consumes the seam").toMatch(/resolveObjectReceipt|from ['"]@\/lib\/trophy-room\/provenance-receipt['"]/);
    // word-bounded so it forbids REDEFINING the seam's `buildReceipt` without false-matching the
    // composition helper `buildReceiptsByKey` (the ratified hall-cases API, which CONSUMES the seam).
    expect(src, "does not re-declare buildReceipt").not.toMatch(/function buildReceipt\b/);
  });
  it("the shipped seams + resolver files still export their contracts (unchanged)", () => {
    expect(read("src/lib/trophy-room/provenance-receipt.ts")).toMatch(/export function resolveObjectReceipt/);
    expect(read("src/lib/trophy-room/viewer-holdings.ts")).toMatch(/export function isHeldByViewer/);
    expect(read("src/lib/trophy-room.ts")).toMatch(/export async function loadGeneratedAwards/);
  });
});

describe("D-4 retirement completeness — the flat gallery is gone, no importers remain (mirror T7.5)", () => {
  it("the v1 flat gallery file is removed", () => {
    expect(has(FLAT_GALLERY), "trophy-hall-gallery.tsx should be retired").toBe(false);
  });
  it("no PRODUCTION source file imports the retired flat gallery (import specifier, not a mention)", () => {
    const isTest = (f: string) => /\.test\.tsx?$/.test(f);
    const importsIt = (src: string) =>
      /(?:from|import\()\s*['"][^'"]*trophy-hall-gallery['"]/.test(src);
    const offenders = srcFiles().filter((f) => !isTest(f) && importsIt(read(f)));
    expect(offenders, `still importing the retired flat gallery: ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("Escape-stack — the drill layers reuse the shipped accessible dialog (structural)", () => {
  it("the interactive component renders via the shipped RoomModal (Escape/focus-trap/restore inherited)", () => {
    if (!has(INTERACTIVE)) return;
    const src = read(INTERACTIVE);
    expect(src, "reuses RoomModal, no fork").toMatch(/RoomModal/);
    expect(src, "reuses the shipped provenance toggle in the detail").toMatch(/ProvenanceToggle/);
  });
});
