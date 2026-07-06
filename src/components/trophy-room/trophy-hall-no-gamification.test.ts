// src/components/trophy-room/trophy-hall-no-gamification.test.ts
// TROPHY HALL — Step 2 (tests-first). The NEGATIVE gamification test (brief sections
// 3/5/6; parent display brief section 3) + the CO-R4 no-bake audit. Source-scan idiom
// (mirrors coach-office/no-bake.test.ts); node env. RED until Step 3 creates the source.
//
// The hall highlights what IS held (reflective); it must never gamify what COULD be
// earned. This asserts no earned-count, no "X of Y", no progress/next primitive, and no
// leaderboard-of-most in the room's new source. CO-R4: no baked title/winner/year — the
// overlay text is runtime data from the manifest/resolver, never a string literal in art
// or component.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// The source this room adds/rewrites (excluding tests). Step 3 creates these; the test
// is authored first (tests-first) and stays RED until they exist.
const NEW_SOURCE = [
  "src/app/league/[id]/trophy-hall/page.tsx",
  "src/components/trophy-room/trophy-hall-gallery.tsx",
  "src/components/room/provenance-toggle.tsx",
  "src/lib/trophy-room/viewer-holdings.ts",
  "public/trophy-hall/hotspots.json",
];

// Engagement-loop / gamification primitives that must never appear in the room copy or logic.
const FORBIDDEN_GAMIFICATION: RegExp[] = [
  /\bX of Y\b/i,
  /\b\d+\s*of\s*\d+\b/, // "3 of 36"
  /\bprogress\b/i,
  /\bnext (?:trophy|award|unlock)\b/i,
  /\bunlock(?:ed|able)?\b/i,
  /\bearn(?:ed|able)?\b/i, // "trophies earned"
  /\bcollect (?:them all|all)\b/i,
  /\bleaderboard\b/i,
  /\bstreak\b/i, // no streaks (championship-package boundary)
  /\byou(?:'| a)re \d+/i, // "you're 2 away"
  /\baway from\b/i,
];

describe("negative gamification audit (brief section 3; parent display brief section 3)", () => {
  it("every new-source file exists by Step 3 (tests-first: RED until implemented)", () => {
    for (const f of NEW_SOURCE) {
      expect(existsSync(path.join(ROOT, f)), `${f} must exist`).toBe(true);
    }
  });

  it("no gamification / engagement-loop primitive in the room's new source", () => {
    for (const f of NEW_SOURCE) {
      if (!existsSync(path.join(ROOT, f))) continue; // scanned once the file lands
      const src = read(f);
      for (const rx of FORBIDDEN_GAMIFICATION) {
        expect(src, `${f} contains forbidden gamification primitive ${rx}`).not.toMatch(rx);
      }
    }
  });
});

describe("CO-R4 no-bake audit — overlay text is runtime data, never baked", () => {
  // The illustrated objects and gallery must not carry a hard-coded award title, winner
  // name, or year — those overlay at runtime from the manifest/resolver.
  const OVERLAY_SURFACES = [
    "src/components/trophy-room/trophy-hall-gallery.tsx",
    "public/trophy-hall/hotspots.json",
  ];
  it("no baked four-digit season and no baked league identity in the illustrated surfaces", () => {
    for (const f of OVERLAY_SURFACES) {
      if (!existsSync(path.join(ROOT, f))) continue;
      const src = read(f);
      expect(src, `${f} bakes a season year`).not.toMatch(/\b(19|20)\d{2}\b/);
      expect(src, `${f} bakes 'Phony Football League'`).not.toMatch(/Phony Football League/);
    }
  });
});
