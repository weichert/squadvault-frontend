// src/lib/trophy-room/hall-cases.ts
// TROPHY HALL v2 — the pure placement + category + detail-receipt composition seam. No I/O, no
// DOM: all correctness is node-provable (the coach-office/resolvers idiom). The interactive room
// overlay and the page consume these; the shipped resolvers + provenance seams are CONSUMED, never
// rebuilt. HallObject moves here (the v1 flat gallery is retired, D-4).
import { resolveObjectReceipt, type Receipt } from "@/lib/trophy-room/provenance-receipt";
import type { LiveRecord } from "@/lib/trophy-room";

// A displayed trophy object (the shape the shelves + modals render). Single-holder display; the
// Championship Belt fits it (name-only, isHeld=false per D-C); the Ring/League Trophy are collective
// and stay in the record view (Option 1), never forced into this shape.
export type HallObject = {
  key: string; // stable id (docket id)
  title: string; // trophy name — the runtime overlay text
  winnerName: string | null; // era-correct holder (rendered outside the plate)
  season: number | null; // holder season (data-driven; never baked)
  coHolders: number; // additional tied holders, a fact ("shared"), never a score
  art: { mode: "illustrated"; src: string } | { mode: "text"; src: null };
  isHeld: boolean; // reflective accent (precomputed via the viewer-holdings seam)
  category: string; // shipped taxonomy group (== a case's category)
};

export type HallShelf = { x: number; y: number; width: number; height: number }; // image px — a glass shelf
export type HallCase = {
  id: string;
  category: string; // the one taxonomy group this case holds (one-per-case, D-1)
  label: string;
  zone: { x: number; y: number; width: number; height: number }; // clickable case rect (image px)
  shelves: HallShelf[]; // top-to-bottom glass shelves objects rest on
};

// A case, populated: objects distributed across its physical shelves (one array per shelf, some may
// be empty), plus the preview/total counts (the shelf is a preview; the modal shows the full group).
export type CasePlacement = {
  caseId: string;
  category: string;
  shelves: HallObject[][]; // length == case.shelves.length; each <= SLOTS_PER_SHELF
  previewCount: number;
  totalCount: number;
};

export const SLOTS_PER_SHELF = 1; // one LARGE representative per shelf (G3 furnished-room tune; the
// narrow cases + the plates' own framing read best one-per-shelf; the case-click shows the full group)

// Reflective order: the viewer's HELD objects first (stable within held/unheld), never ranked.
function heldFirst(objects: HallObject[]): HallObject[] {
  return [...objects.filter((o) => o.isHeld), ...objects.filter((o) => !o.isHeld)];
}

// Shelf-PREVIEW order (G3): held first, then the illustrated plates (prime, large placements), then
// the rest — stable within each tier (Array.sort is stable). The modal still shows the full group.
function previewOrder(objects: HallObject[]): HallObject[] {
  const rank = (o: HallObject) => (o.isHeld ? 0 : 2) + (o.art.mode === "illustrated" ? 0 : 1);
  return [...objects].sort((a, b) => rank(a) - rank(b));
}

// The full group for a category modal (held first).
export function categoryObjects(objects: HallObject[], category: string): HallObject[] {
  return heldFirst(objects.filter((o) => o.category === category));
}

// Place objects ON shelves, one case per category. PURITY: an object only ever lands on the case
// whose category matches; it never exceeds a shelf's slots or a case's shelf count; a category with
// no case is returned in `unplaced` (reported, never misplaced).
export function placeObjects(
  objects: HallObject[],
  cases: HallCase[],
): { placements: CasePlacement[]; unplaced: HallObject[] } {
  const byCategory = new Set(cases.map((c) => c.category));
  const unplaced = objects.filter((o) => !byCategory.has(o.category));

  const placements = cases.map((c) => {
    const group = objects.filter((o) => o.category === c.category);
    const ordered = previewOrder(group); // held first, then illustrated (prime), then the rest
    const capacity = c.shelves.length * SLOTS_PER_SHELF;
    const preview = ordered.slice(0, capacity);
    // one slot-array per physical shelf (fill shelf-by-shelf; even distribution is a G3 tune).
    const shelves: HallObject[][] = c.shelves.map((_, i) => preview.slice(i * SLOTS_PER_SHELF, i * SLOTS_PER_SHELF + SLOTS_PER_SHELF));
    return { caseId: c.id, category: c.category, shelves, previewCount: preview.length, totalCount: group.length };
  });

  return { placements, unplaced };
}

// Detail receipts, OBJECT-ALIGNED via the shipped seam (consumed, not rebuilt). Keyed by docket id
// so the detail for object X resolves X's receipt. LiveRecord awards are CANONICAL (the Belt, which
// is COMMISSIONER_ATTESTED with a custody-chain receipt, is handled natively, not here — Option 1).
export function buildReceiptsByKey(records: LiveRecord[]): Record<string, Receipt> {
  const byId: Record<string, LiveRecord> = Object.fromEntries(records.map((r) => [r.docketId, r]));
  return Object.fromEntries(records.map((r) => [r.docketId, resolveObjectReceipt(r.docketId, byId, "CANONICAL")]));
}
