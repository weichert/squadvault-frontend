// src/lib/trophy-room/provenance-receipt.test.ts
// TROPHY HALL — Step 2 (tests-first). The CRITICAL values-demonstration test (brief
// section 4 + successor note 8): the provenance toggle REVEALS the fact layer and is
// NEVER a second source of truth. The receipt the toggle shows for each object must be
// a FAITHFUL PURE FUNCTION of the shipped resolver output + the shipped two-tier
// provenance module — it invents nothing and drops nothing. Node env, pure seam.
// RED until Step 3 creates src/lib/trophy-room/provenance-receipt.ts.
import { describe, it, expect } from "vitest";
import { PROVENANCE_LABEL } from "@/lib/trophy-provenance";
import type { LiveRecord } from "@/lib/trophy-room";
import { buildReceipt, resolveObjectReceipt } from "@/lib/trophy-room/provenance-receipt";

// A shipped resolver record (loadLiveRecords output shape), used verbatim as the fact source.
const record: LiveRecord = {
  docketNumber: 24,
  docketId: "TR-LRC-24-2024",
  trophyName: "The Cavallini Standard",
  qualification: "Highest all-time winning percentage.",
  valueText: ".734",
  holders: [{ franchiseId: "0001", name: "Cavallini Cru", season: null }],
  history: [
    { season: 2011, names: ["Early Leader"], valueText: ".700" },
    { season: 2019, names: ["Cavallini Cru"], valueText: ".734" },
  ],
};

describe("buildReceipt — reveals the fact layer, faithfully (brief section 4)", () => {
  it("carries the fact id (docketId) verbatim — the receipt's fact reference", () => {
    expect(buildReceipt(record, "CANONICAL").docketId).toBe("TR-LRC-24-2024");
  });

  it("uses the SHIPPED two-tier provenance label — never a re-labelling", () => {
    // CANONICAL derived record -> 'ENTERED INTO THE RECORD' (Source Facts Verified tier).
    expect(buildReceipt(record, "CANONICAL").provenanceLabel).toBe(PROVENANCE_LABEL.CANONICAL);
    // The Belt's custody ledger -> 'COMMISSIONER ATTESTED' (Not Canonical tier).
    expect(buildReceipt(record, "COMMISSIONER_ATTESTED").provenanceLabel).toBe(PROVENANCE_LABEL.COMMISSIONER_ATTESTED);
  });

  it("reflects every holder from the fact layer, and NO holder it did not contain (no invention)", () => {
    const r = buildReceipt(record, "CANONICAL");
    expect(r.holders).toEqual(record.holders.map((h) => h.name));
  });

  it("reflects the full mark-movement / history chain, in fact-layer order (no drop, no reorder)", () => {
    const r = buildReceipt(record, "CANONICAL");
    expect(r.history.map((h) => h.season)).toEqual([2011, 2019]);
    // each history line's value comes from the fact layer, not re-derived
    expect(r.history.map((h) => h.valueText)).toEqual([".700", ".734"]);
  });

  it("adds no field that is not a projection of the source (the toggle holds no data of its own)", () => {
    const r = buildReceipt(record, "CANONICAL") as Record<string, unknown>;
    // exactly the receipt projection keys — a guard against the receipt growing an
    // independent source of truth.
    expect(Object.keys(r).sort()).toEqual(["docketId", "history", "holders", "provenanceLabel"].sort());
  });
});

describe("object <-> receipt alignment (G2 added test — guards the off-by-one)", () => {
  // A displayed object carrying award_id X must resolve to X's OWN receipt — proving the
  // toggle shows the right trophy's receipt, not a neighbour's (faithfulness alone does not
  // catch a mis-indexed lookup where the correct receipt is built for the wrong object).
  const byId: Record<string, LiveRecord> = {
    "13": { docketNumber: 13, docketId: "TR-LRC-13", trophyName: "The Signal Caller",
      qualification: "Highest started-QB total in a season.", valueText: "410 points",
      holders: [{ franchiseId: "0003", name: "QB Whisperer", season: 2018 }], history: [] },
    "14": { docketNumber: 14, docketId: "TR-LRC-14", trophyName: "The Workhorse",
      qualification: "Highest started-RB total in a season.", valueText: "388 points",
      holders: [{ franchiseId: "0007", name: "Ground Game", season: 2019 }], history: [] },
  };

  it("resolveObjectReceipt(objectId) returns THAT object's receipt, not another's", () => {
    expect(resolveObjectReceipt("13", byId, "CANONICAL").docketId).toBe("TR-LRC-13");
    expect(resolveObjectReceipt("14", byId, "CANONICAL").docketId).toBe("TR-LRC-14");
    // the aligned receipt's holders/name trace to the SAME award, never the neighbour's
    expect(resolveObjectReceipt("13", byId, "CANONICAL").holders).toEqual(["QB Whisperer"]);
    expect(resolveObjectReceipt("14", byId, "CANONICAL").holders).toEqual(["Ground Game"]);
  });
});
