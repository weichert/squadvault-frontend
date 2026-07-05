// src/lib/room/manifest.test.ts
// Schema + wiring test for the shipped W.2 Clubhouse manifest
// (public/clubhouse/hotspots.json). Asserts the manifest is well-formed against
// the RoomManifest shape, that it is the SINGLE SOURCE of hotspot order (a spatial
// walk of the room), and that every route hotspot traces to a real app route
// directory (routes-trace-to-existing-surfaces, unchanged).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { RoomManifest, RoomHotspot } from "@/lib/room/types";

const ROOT = process.cwd();
const manifest = JSON.parse(
  readFileSync(path.join(ROOT, "public", "clubhouse", "hotspots.json"), "utf8"),
) as RoomManifest;

// Spatial reading order (G2 ruling): left->right, foreground before background.
// Active-Objects trim (2026-07-04): the four inert character objects (phone,
// guitar, boombox, hearth) were dropped; the laptop was added as a route to the
// league home. Every remaining hotspot has a destination or a dignified pending.
const EXPECTED_ORDER = [
  "trophy_case",
  "desk_lamp",
  "answering_machine",
  "laptop",
  "mantel",
  "corkboard",
  "safe",
];

// Route hotspot id -> the app route segment it must resolve to. "" = the league
// home (/league/[id], no segment).
const ROUTE_SEGMENTS: Record<string, string> = {
  trophy_case: "trophy-room",
  desk_lamp: "office",
  laptop: "",
  mantel: "av-room",
  safe: "vault",
};

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

describe("clubhouse manifest — shape", () => {
  it("has the required top-level fields", () => {
    expect(manifest.manifest_id).toBe("w2_clubhouse_hotspots_v1");
    expect(isNum(manifest.image_width) && manifest.image_width > 0).toBe(true);
    expect(isNum(manifest.image_height) && manifest.image_height > 0).toBe(true);
    expect(Array.isArray(manifest.hotspots)).toBe(true);
  });

  it("carries a curved banner (runtime text surface)", () => {
    expect(manifest.banner).toBeDefined();
    const b = manifest.banner!;
    expect(typeof b.text_path).toBe("string");
    expect(b.text_path.length).toBeGreaterThan(0);
    expect(isNum(b.rotate_deg)).toBe(true);
    expect(isNum(b.rotate_origin.x) && isNum(b.rotate_origin.y)).toBe(true);
    expect(isNum(b.font_size) && b.font_size > 0).toBe(true);
    expect(isNum(b.letter_spacing)).toBe(true);
    expect(["left", "center", "right"]).toContain(b.align);
    expect(isNum(b.light) && b.light >= 0 && b.light <= 100).toBe(true);
    expect(isNum(b.fabric) && b.fabric >= 0 && b.fabric <= 100).toBe(true);
    expect(["soft-light", "overlay", "multiply", "none"]).toContain(b.fabric_blend);
  });

  it("has exactly seven hotspots with unique ids", () => {
    expect(manifest.hotspots).toHaveLength(7);
    const ids = manifest.hotspots.map((h) => h.id);
    expect(new Set(ids).size).toBe(7);
  });
});

describe("clubhouse manifest — is the single source of order", () => {
  it("hotspot order equals the spatial reading order", () => {
    expect(manifest.hotspots.map((h) => h.id)).toEqual(EXPECTED_ORDER);
  });
});

describe("clubhouse manifest — each hotspot is well-formed", () => {
  it.each(manifest.hotspots)("hotspot $id", (h: RoomHotspot) => {
    expect(typeof h.label).toBe("string");
    expect(h.label.length).toBeGreaterThan(0);
    expect(typeof h.aria_label).toBe("string");
    expect(h.aria_label.length).toBeGreaterThan(0);
    expect(isNum(h.depth_band) && h.depth_band >= 0 && h.depth_band <= 3).toBe(true);

    // zone: four finite numbers, fully within the image bounds
    const z = h.zone;
    expect(isNum(z.x) && isNum(z.y) && isNum(z.width) && isNum(z.height)).toBe(true);
    expect(z.x).toBeGreaterThanOrEqual(0);
    expect(z.y).toBeGreaterThanOrEqual(0);
    expect(z.x + z.width).toBeLessThanOrEqual(manifest.image_width);
    expect(z.y + z.height).toBeLessThanOrEqual(manifest.image_height);

    // wiring: one of the three shapes
    if (h.wiring.type === "route") {
      expect(h.wiring.href).toContain("{id}");
      expect(typeof h.wiring.gated).toBe("boolean");
    } else if (h.wiring.type === "pending") {
      expect(h.wiring.title.length).toBeGreaterThan(0);
      expect(h.wiring.body.length).toBeGreaterThan(0);
    } else {
      expect(h.wiring.type).toBe("inert");
    }

    // plate: null, or a placement with a shipped webp under /clubhouse/
    if (h.plate !== null) {
      expect(h.plate.src.startsWith("/clubhouse/")).toBe(true);
      expect(h.plate.src.endsWith(".webp")).toBe(true);
      expect(existsSync(path.join(ROOT, "public", h.plate.src.replace(/^\//, "")))).toBe(true);
    }
  });
});

describe("clubhouse manifest — routes trace to existing surfaces", () => {
  it("every route hotspot resolves to a real app route directory", () => {
    for (const h of manifest.hotspots) {
      if (h.wiring.type !== "route") continue;
      const seg = ROUTE_SEGMENTS[h.id];
      expect(seg, `no expected segment for route hotspot ${h.id}`).toBeDefined();
      if (seg === "") {
        // league home: /league/[id] with no child segment.
        expect(h.wiring.href).toBe("/league/{id}");
        expect(existsSync(path.join(ROOT, "src", "app", "league", "[id]", "page.tsx"))).toBe(true);
      } else {
        expect(h.wiring.href).toBe(`/league/{id}/${seg}`);
        expect(existsSync(path.join(ROOT, "src", "app", "league", "[id]", seg))).toBe(true);
      }
    }
  });
});
