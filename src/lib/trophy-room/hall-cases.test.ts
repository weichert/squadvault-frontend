// src/lib/trophy-room/hall-cases.test.ts
// TROPHY HALL v2 — Step 2 (tests-first). The pure placement + category + detail-receipt
// composition seam. Node env (no DOM). RED until Step 3 creates src/lib/trophy-room/hall-cases.ts.
//
// Founder's hardest-read tests pinned here:
//   (1) PLACEMENT PURITY — an object lands on its category's case, never a neighbour's, never
//       off-shelf. The furnished-room guarantee made mechanical.
//   (3) DETAIL OBJECT-ALIGNMENT — the receipt looked up for object X is X's receipt (extends the
//       v1 provenance-receipt alignment through the new detail layer).
import { describe, it, expect } from "vitest";
import type { LiveRecord } from "@/lib/trophy-room";
import {
  placeObjects,
  categoryObjects,
  buildReceiptsByKey,
  SLOTS_PER_SHELF,
  type HallObject,
  type HallCase,
} from "@/lib/trophy-room/hall-cases";

const TEXT = { mode: "text", src: null } as const;
const obj = (key: string, category: string, isHeld = false): HallObject => ({
  key,
  title: key,
  winnerName: "Someone",
  season: 2024,
  coHolders: 0,
  art: TEXT,
  isHeld,
  category,
});

const shelf = (y: number) => ({ x: 100, y, width: 200, height: 60 });
const CASES: HallCase[] = [
  { id: "case_live", category: "Live Records", label: "Live Records", zone: { x: 15, y: 150, width: 150, height: 400 }, shelves: [shelf(160), shelf(260)] },
  { id: "case_perm", category: "Permanent Records", label: "Permanent Records", zone: { x: 1200, y: 180, width: 115, height: 350 }, shelves: [shelf(200)] },
];

describe("placeObjects — placement purity (founder #1: furnished-room guarantee)", () => {
  const objects = [
    obj("TR-LRC-24", "Live Records"),
    obj("TR-LRC-25", "Live Records", true), // held
    obj("TR-LRC-30", "Live Records"),
    obj("TR-LRC-32", "Permanent Records"),
    obj("TR-XX-99", "Nonexistent Category"),
  ];
  const { placements, unplaced } = placeObjects(objects, CASES);

  it("every object on a case belongs to THAT case's category — never a neighbour's", () => {
    for (const p of placements) {
      for (const shelfObjs of p.shelves) {
        for (const o of shelfObjs) expect(o.category, `${o.key} on ${p.caseId}`).toBe(p.category);
      }
    }
  });

  it("never places an object off-shelf — no shelf exceeds SLOTS_PER_SHELF, no extra shelves", () => {
    for (const p of placements) {
      const caseDef = CASES.find((c) => c.id === p.caseId)!;
      expect(p.shelves.length).toBeLessThanOrEqual(caseDef.shelves.length);
      for (const shelfObjs of p.shelves) expect(shelfObjs.length).toBeLessThanOrEqual(SLOTS_PER_SHELF);
    }
  });

  it("surfaces the viewer's HELD object first in the case preview (reflective emphasis)", () => {
    const live = placements.find((p) => p.caseId === "case_live")!;
    const flat = live.shelves.flat();
    expect(flat[0]?.key).toBe("TR-LRC-25"); // the held one leads
  });

  it("an object whose category has NO case is reported as unplaced, never misplaced", () => {
    expect(unplaced.map((o) => o.key)).toEqual(["TR-XX-99"]);
    for (const p of placements) for (const s of p.shelves) expect(s.some((o) => o.key === "TR-XX-99")).toBe(false);
  });

  it("preview count is bounded by the case's slot capacity; total counts the whole group", () => {
    const live = placements.find((p) => p.caseId === "case_live")!;
    expect(live.totalCount).toBe(3); // all three Live Records
    expect(live.previewCount).toBeLessThanOrEqual(CASES[0].shelves.length * SLOTS_PER_SHELF);
    expect(live.previewCount).toBe(Math.min(3, CASES[0].shelves.length * SLOTS_PER_SHELF));
  });
});

describe("categoryObjects — the full group for the modal (held first)", () => {
  const objects = [obj("a", "Live Records"), obj("b", "Live Records", true), obj("c", "Permanent Records")];
  it("returns exactly the group's objects, the viewer's held first", () => {
    const g = categoryObjects(objects, "Live Records");
    expect(g.map((o) => o.key)).toEqual(["b", "a"]);
    expect(g.every((o) => o.category === "Live Records")).toBe(true);
  });
});

describe("buildReceiptsByKey — detail object-alignment (founder #3; extends the v1 seam)", () => {
  const rec = (docketId: string, name: string): LiveRecord => ({
    docketNumber: Number(docketId.replace(/\D/g, "")) || 0,
    docketId,
    trophyName: `Trophy ${docketId}`,
    qualification: "q",
    valueText: "",
    holders: [{ franchiseId: "0001", name, season: 2024 }],
    history: [],
  });
  const records = [rec("TR-LRC-24", "Alpha"), rec("TR-LRC-25", "Beta")];
  const byKey = buildReceiptsByKey(records);

  it("the receipt keyed by an object's docketId is THAT award's receipt, never a neighbour's", () => {
    expect(byKey["TR-LRC-24"].docketId).toBe("TR-LRC-24");
    expect(byKey["TR-LRC-24"].holders).toEqual(["Alpha"]);
    expect(byKey["TR-LRC-25"].docketId).toBe("TR-LRC-25");
    expect(byKey["TR-LRC-25"].holders).toEqual(["Beta"]);
  });
});
