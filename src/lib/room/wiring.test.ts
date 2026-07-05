// src/lib/room/wiring.test.ts
// G2 obligation T7.1 — the pure wiring seam extracted from RoomScene so the W.2->CO
// `detail` extension is node-testable without a DOM. Also guards that route/pending/
// inert classification is unchanged (clubhouse regression is the existing
// manifest.test.ts, T7.2). Node env.
import { describe, it, expect } from "vitest";
import type { RoomHotspot } from "@/lib/room/types";
import { hotspotKind, detailContentKey, requiredContentKeys } from "@/lib/room/wiring";

function h(id: string, wiring: RoomHotspot["wiring"]): RoomHotspot {
  return {
    id,
    label: id,
    aria_label: id,
    zone: { x: 0, y: 0, width: 1, height: 1 },
    wiring,
    plate: null,
    depth_band: 0,
  };
}

const detail = h("d", { type: "detail", contentKey: "trophy_case", title: "Trophy Case" });
const route = h("r", { type: "route", href: "/league/{id}/x", gated: false });
const pending = h("p", { type: "pending", title: "T", body: "B" });
const inert = h("i", { type: "inert" });

describe("hotspotKind (T7.1)", () => {
  it("classifies each wiring type, detail included", () => {
    expect(hotspotKind(detail)).toBe("detail");
    expect(hotspotKind(route)).toBe("route");
    expect(hotspotKind(pending)).toBe("pending");
    expect(hotspotKind(inert)).toBe("inert");
  });
});

describe("detailContentKey (T7.1)", () => {
  it("names the content key only for a detail hotspot", () => {
    expect(detailContentKey(detail)).toBe("trophy_case");
    expect(detailContentKey(route)).toBeNull();
    expect(detailContentKey(pending)).toBeNull();
    expect(detailContentKey(inert)).toBeNull();
  });
});

describe("requiredContentKeys (T7.1)", () => {
  it("collects one key per detail hotspot, in order, skipping non-detail", () => {
    const list = [
      h("a", { type: "detail", contentKey: "trophy_case", title: "T" }),
      route,
      h("b", { type: "detail", contentKey: "board", title: "T" }),
      inert,
      h("c", { type: "detail", contentKey: "ring_box", title: "T" }),
    ];
    expect(requiredContentKeys(list)).toEqual(["trophy_case", "board", "ring_box"]);
  });
});
