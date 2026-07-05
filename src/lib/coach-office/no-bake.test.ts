// src/lib/coach-office/no-bake.test.ts
// G2 obligations T6.1 (no-hard-coding audit), T6.2 (year is data-driven, no baked
// 1984/EST), T6.3 (nameplate text is verbatim data). Source-scan + pure seam; node env.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { nameplateText } from "@/lib/coach-office/profile";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// The source this unit adds or rewrites (excluding tests). If any bakes a specific
// league/coach/team/joke it fails the QA checklist.
const NEW_SOURCE = [
  "src/lib/coach-office/board.ts",
  "src/lib/coach-office/consent.ts",
  "src/components/coach-office/board-message-view.tsx",
  "src/app/league/[id]/coach-office/[coachId]/page.tsx",
  "public/coach-office/hotspots.json",
];

// The office-facing surfaces where a baked league fact would actually ship as copy.
const OFFICE_FACING = [
  "src/app/league/[id]/coach-office/[coachId]/page.tsx",
  "public/coach-office/hotspots.json",
];

describe("no hard-coding audit (T6.1)", () => {
  it("no PFL / Steve / KP / Robb or hard-coded league identity in new source", () => {
    for (const f of NEW_SOURCE) {
      const src = read(f);
      expect(src, `${f} names PFL`).not.toMatch(/\bPFL\b/);
      expect(src, `${f} names Steve`).not.toMatch(/\bSteve\b/);
      expect(src, `${f} names KP`).not.toMatch(/\bKP\b/);
      expect(src, `${f} names Robb`).not.toMatch(/\bRobb\b/);
    }
  });
});

describe("year is data-driven, not baked (T6.2, CO-R4)", () => {
  it("no baked '1984' or 'EST/Est.' league-fact copy in office-facing surfaces", () => {
    for (const f of OFFICE_FACING) {
      const src = read(f);
      expect(src, `${f} bakes 1984`).not.toMatch(/1984/);
      expect(src, `${f} bakes an EST year`).not.toMatch(/\bEst\.?\b/i);
    }
  });
});

describe("nameplate text is verbatim data (T6.3, D-4a)", () => {
  it("returns the passed display name unchanged", () => {
    expect(nameplateText("Any Team Name")).toBe("Any Team Name");
    expect(nameplateText("The Owner")).toBe("The Owner");
  });
  it("empty display stays empty (no invented placeholder copy)", () => {
    expect(nameplateText("")).toBe("");
  });
});
