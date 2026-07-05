// src/lib/coach-office/office-manifest.test.ts
// G2 obligations T1.* + T7.3. Schema / order / well-formedness of the Coach Office room
// manifest (public/coach-office/hotspots.json), and that its `detail` content keys are
// exactly the set the office page supplies. Parallel to the clubhouse manifest.test.ts
// (which is hard-coded to the clubhouse file and does NOT cover the office). Pure: reads
// JSON + fs, node environment.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { RoomManifest, RoomHotspot } from "@/lib/room/types";
import { requiredContentKeys } from "@/lib/room/wiring";

const ROOT = process.cwd();
const manifest = JSON.parse(
  readFileSync(path.join(ROOT, "public", "coach-office", "hotspots.json"), "utf8"),
) as RoomManifest;

// Spatial reading order: left -> right across the clean CO-hero. Single source of tab
// order. (Updated with the 2026-07-05 hero swap: the trophy case moved to the right of
// the art, so the walk is now board -> ring box -> trophy case.)
const EXPECTED_ORDER = ["office_board", "championship_ring_box", "trophy_case"];

// v2, omitted from v1 (D-2). Must not appear.
const V2_HOTSPOTS = ["framed_photos", "cardboard_cutout_slot"];

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

describe("coach office manifest — shape (T1.1)", () => {
  it("has the required top-level fields at the clean CO-hero's dimensions", () => {
    expect(manifest.manifest_id).toBe("coach_office_hotspots_v1");
    expect(manifest.image_width).toBe(1448);
    expect(manifest.image_height).toBe(1086);
    expect(Array.isArray(manifest.hotspots)).toBe(true);
  });
});

describe("coach office manifest — count + order (T1.2, T1.3)", () => {
  it("has exactly three hotspots with unique ids (T1.2)", () => {
    expect(manifest.hotspots).toHaveLength(3);
    const ids = manifest.hotspots.map((h) => h.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("hotspot order equals the spatial reading order (T1.3)", () => {
    expect(manifest.hotspots.map((h) => h.id)).toEqual(EXPECTED_ORDER);
  });
});

describe("coach office manifest — each hotspot well-formed (T1.4)", () => {
  it.each(manifest.hotspots)("hotspot $id", (h: RoomHotspot) => {
    expect(typeof h.label).toBe("string");
    expect(h.label.length).toBeGreaterThan(0);
    expect(typeof h.aria_label).toBe("string");
    expect(h.aria_label.length).toBeGreaterThan(0);
    expect(isNum(h.depth_band) && h.depth_band >= 0 && h.depth_band <= 3).toBe(true);

    const z = h.zone;
    expect(isNum(z.x) && isNum(z.y) && isNum(z.width) && isNum(z.height)).toBe(true);
    expect(z.x).toBeGreaterThanOrEqual(0);
    expect(z.y).toBeGreaterThanOrEqual(0);
    expect(z.x + z.width).toBeLessThanOrEqual(manifest.image_width);
    expect(z.y + z.height).toBeLessThanOrEqual(manifest.image_height);

    // v1: every office hotspot is a `detail` (resolver-driven modal) with a non-empty
    // contentKey + title. (D-1 Option A extension.)
    expect(h.wiring.type).toBe("detail");
    if (h.wiring.type === "detail") {
      expect(h.wiring.contentKey.length).toBeGreaterThan(0);
      expect(h.wiring.title.length).toBeGreaterThan(0);
    }

    // interim art is master-drawn: no plates. If a plate ever lands it must be a shipped
    // /coach-office/*.webp that exists on disk.
    if (h.plate !== null) {
      expect(h.plate.src.startsWith("/coach-office/")).toBe(true);
      expect(h.plate.src.endsWith(".webp")).toBe(true);
      expect(existsSync(path.join(ROOT, "public", h.plate.src.replace(/^\//, "")))).toBe(true);
    }
  });
});

describe("coach office manifest — v2 hotspots omitted (T1.5)", () => {
  it("does not include framed_photos or cardboard_cutout_slot", () => {
    const ids = manifest.hotspots.map((h) => h.id);
    for (const v2 of V2_HOTSPOTS) expect(ids).not.toContain(v2);
  });
});

describe("coach office manifest — no baked league facts (T1.6)", () => {
  it("carries no 1984/EST year copy and no nameplate/board display string", () => {
    const strings: string[] = [];
    for (const h of manifest.hotspots) {
      strings.push(h.label, h.aria_label);
      if (h.wiring.type === "detail") strings.push(h.wiring.title);
    }
    for (const s of strings) {
      expect(s).not.toMatch(/1984/);
      expect(s).not.toMatch(/\bEst\.?\b/i);
    }
  });
});

describe("coach office manifest — content keys match the room's detail slots (T7.3)", () => {
  it("required content keys are exactly {trophy_case, board, ring_box}", () => {
    expect(requiredContentKeys(manifest.hotspots).sort()).toEqual(
      ["board", "ring_box", "trophy_case"],
    );
  });
});
