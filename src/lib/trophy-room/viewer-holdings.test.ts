// src/lib/trophy-room/viewer-holdings.test.ts
// TROPHY HALL — Step 2 (tests-first). Pure-seam contract for the viewer-relative,
// REFLECTIVE highlight and the no-fabrication guard. Node env (no DOM): the whole
// constitutional core lives in pure functions, exactly the coach-office/resolvers.ts
// idiom. RED until Step 3 creates src/lib/trophy-room/viewer-holdings.ts.
//
// Guarantees pinned here (brief sections 3, 5, 6; principle memo section 1):
//   - viewer-relative highlight is a pure function of "does the viewer's franchise
//     currently hold this award", across BOTH shipped id spaces;
//   - it is REFLECTIVE — held vs not-held only; no counting, ranking, or targeting;
//   - anonymous / no-franchise viewer sees zero highlights;
//   - name-only awards (Belt current holder, permanent lists) are NOT id-highlightable
//     in v1 (D-C, ratified) — they never receive a fabricated match;
//   - an object is displayable ONLY if a fact backs it (no fabricated winner);
//   - fallback: no ready art -> text-card, never broken.
import { describe, it, expect } from "vitest";
import type { LiveRecordHolder } from "@/lib/trophy-room";
import {
  holderCanonical,
  isHeldByViewer,
  selectViewerHoldings,
  isFactBacked,
  resolveObjectArt,
  type HallObjectIdentity,
} from "@/lib/trophy-room/viewer-holdings";

// ── Fixtures: the two shipped id spaces ─────────────────────────────────────────
// season_award_winners-derived holders carry the canonical CODE ('0001'); the
// franchise_season_records-derived holders carry a franchises.id UUID.
const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";
const uuidToCanonical = new Map<string, string>([
  [UUID_A, "0001"],
  [UUID_B, "0002"],
]);

const canonHolder = (canon: string): LiveRecordHolder => ({ franchiseId: canon, name: "Someone", season: 2024 });
const uuidHolder = (uuid: string): LiveRecordHolder => ({ franchiseId: uuid, name: "Someone", season: 2024 });

describe("holderCanonical — normalizes both id spaces to canonical (brief section 3)", () => {
  it("passes a canonical-code holder through unchanged (season_award_winners family)", () => {
    expect(holderCanonical(canonHolder("0001"), uuidToCanonical)).toBe("0001");
  });
  it("maps a UUID holder to its canonical code (franchise_season_records family)", () => {
    expect(holderCanonical(uuidHolder(UUID_B), uuidToCanonical)).toBe("0002");
  });
  it("returns null for an unknown id (no guess, honest gap)", () => {
    expect(holderCanonical(uuidHolder("nope"), uuidToCanonical)).toBeNull();
  });
});

describe("isHeldByViewer — reflective highlight predicate", () => {
  const mine: HallObjectIdentity = { docketId: "TR-LRC-24-2024", holderCanonicalIds: ["0001"] };
  const theirs: HallObjectIdentity = { docketId: "TR-LRC-25-2024", holderCanonicalIds: ["0002"] };
  const coheld: HallObjectIdentity = { docketId: "TR-LRC-30-2019", holderCanonicalIds: ["0002", "0001"] };

  it("fires for an award the viewer currently holds", () => {
    expect(isHeldByViewer(mine, "0001")).toBe(true);
  });
  it("does NOT fire for an award held by someone else", () => {
    expect(isHeldByViewer(theirs, "0001")).toBe(false);
  });
  it("fires on a co-held (tie) award where the viewer is one of the holders (C6)", () => {
    expect(isHeldByViewer(coheld, "0001")).toBe(true);
  });
  it("anonymous / no-franchise viewer (null) never lights up", () => {
    expect(isHeldByViewer(mine, null)).toBe(false);
    expect(isHeldByViewer(coheld, null)).toBe(false);
  });
  it("a name-only award (no holder ids resolved) never lights up (D-C limitation, no fabricated match)", () => {
    const nameOnly: HallObjectIdentity = { docketId: "TR-CP-1-2024", holderCanonicalIds: [] };
    expect(isHeldByViewer(nameOnly, "0001")).toBe(false);
  });
});

describe("selectViewerHoldings — the 'your hardware' reflective filter (brief section 3)", () => {
  const objs: HallObjectIdentity[] = [
    { docketId: "TR-LRC-24-2024", holderCanonicalIds: ["0001"] },
    { docketId: "TR-LRC-25-2024", holderCanonicalIds: ["0002"] },
    { docketId: "TR-LRC-30-2019", holderCanonicalIds: ["0002", "0001"] },
  ];
  it("returns exactly the viewer's held objects", () => {
    const mine = selectViewerHoldings(objs, "0001");
    expect(mine.map((o) => o.docketId)).toEqual(["TR-LRC-24-2024", "TR-LRC-30-2019"]);
  });
  it("returns [] for anonymous viewers (honest empty, never a goal/prompt)", () => {
    expect(selectViewerHoldings(objs, null)).toEqual([]);
  });
  it("returns [] when the viewer holds nothing (reflective empty state)", () => {
    expect(selectViewerHoldings(objs, "0009")).toEqual([]);
  });
});

describe("isFactBacked — no-fabrication guard (brief sections 5/6; seed-004 pre/post)", () => {
  it("an award with a fact present is displayable", () => {
    expect(isFactBacked({ docketId: "TR-LRC-13", present: true })).toBe(true);
  });
  it("an award absent in prod (seed-004 not yet applied) is NOT displayed — no fabricated winner", () => {
    expect(isFactBacked({ docketId: "TR-LRC-13", present: false })).toBe(false);
  });
  it("an award with no docket id is not displayable (honest empty)", () => {
    expect(isFactBacked({ docketId: null, present: true })).toBe(false);
  });
});

describe("resolveObjectArt — illustrated-or-fallback, never broken (parent display brief; Oracle)", () => {
  const art = new Set<string>(["award_the_hammer", "award_the_benchwarmer", "award_the_clairvoyant"]);
  it("uses the illustrated plate when ready art exists", () => {
    expect(resolveObjectArt("award_the_hammer", art)).toEqual({ mode: "illustrated", src: expect.stringContaining("award_the_hammer") });
  });
  it("falls back to a text card when art is absent (Oracle sundial pending)", () => {
    expect(resolveObjectArt("award_the_oracle", art)).toEqual({ mode: "text", src: null });
  });
});
