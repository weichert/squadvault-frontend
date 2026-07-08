// src/lib/room/trophy-hall-manifest.test.ts
// TROPHY HALL — Step 2 (tests-first). Manifest-schema + reroute data contract (brief
// sections 3/G1.5; D-B zone-anchored, D-E RoomScene objects? optionality). Extends the
// shipped room/manifest.test.ts idiom (validate a manifest against RoomManifest). Node
// env, pure data reads. RED until Step 3 lands the hall manifest + the reroute.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RoomManifest, RoomHotspot } from "@/lib/room/types";

const ROOT = process.cwd();
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(path.join(ROOT, rel), "utf8")) as T;

const HALL_MANIFEST = "public/trophy-hall/hotspots.json";
const CLUBHOUSE_MANIFEST = "public/clubhouse/hotspots.json";

describe("trophy-hall manifest — valid RoomManifest, zone-anchored (D-B)", () => {
  it("exists by Step 3 (tests-first: RED until landed)", () => {
    expect(existsSync(path.join(ROOT, HALL_MANIFEST)), `${HALL_MANIFEST} must exist`).toBe(true);
  });

  it("conforms to the shipped RoomManifest shape (image dims + hotspots)", () => {
    if (!existsSync(path.join(ROOT, HALL_MANIFEST))) return; // validated once landed
    const m = readJson<RoomManifest>(HALL_MANIFEST);
    expect(typeof m.manifest_id).toBe("string");
    expect(m.image_width).toBeGreaterThan(0);
    expect(m.image_height).toBeGreaterThan(0);
    expect(Array.isArray(m.hotspots)).toBe(true);
    for (const h of m.hotspots as RoomHotspot[]) {
      expect(h.zone.width, `${h.id} zone within image`).toBeLessThanOrEqual(m.image_width);
      expect(h.zone.height, `${h.id} zone within image`).toBeLessThanOrEqual(m.image_height);
      // Zone-anchored display surfaces (D-B): objects are placed by manifest zones, never
      // pixel-registered cutouts — so no hotspot carries a `plate` in v1 (master-only lesson).
      expect(h.plate, `${h.id} must be zone-anchored, not a registered plate (D-B)`).toBeNull();
    }
  });

  it("the room still reaches the full record (re-homed from the retired reading-chair hotspot)", () => {
    // G2 ruling 3 (Living Room pivot): the baked master retired the reading-chair hotspot,
    // but the guarantee it pinned — the room provides a path to the complete record — is
    // constitutional and stays pinned. The path is now PAGE-LEVEL: the room page renders a
    // /trophy-room affordance (the full record, one tap deeper per D-NAV). This assertion
    // supersedes the old manifest route-hotspot check; it moved with the path's definition.
    const page = readFileSync(
      path.join(ROOT, "src/app/league/[id]/trophy-hall/page.tsx"),
      "utf8",
    );
    expect(page, "the room page links the full record").toMatch(/trophy-room[`'"]/);
  });
});

describe("clubhouse trophy-case hotspot reroutes to the hall (brief G1.5)", () => {
  it("the clubhouse trophy-case hotspot now targets /trophy-hall (data-only reroute)", () => {
    if (!existsSync(path.join(ROOT, CLUBHOUSE_MANIFEST))) return;
    const m = readJson<RoomManifest>(CLUBHOUSE_MANIFEST);
    const trophyCase = m.hotspots.find((h) => /trophy/i.test(h.id) || /trophy/i.test(h.label));
    expect(trophyCase, "clubhouse has a trophy-case hotspot").toBeTruthy();
    if (trophyCase && trophyCase.wiring.type === "route") {
      expect(trophyCase.wiring.href, "trophy-case reroutes to the hall").toContain("/trophy-hall");
    }
  });
});

describe("RoomScene objects? extension is additive (D-E)", () => {
  it("RoomScene renders its objects overlay ONLY when the prop is supplied (byte-identical when absent)", () => {
    const src = readFileSync(path.join(ROOT, "src/components/room/room-scene.tsx"), "utf8");
    // additive optional prop; existing callers (Clubhouse, Coach Office) pass nothing ->
    // the overlay is gated behind a truthiness check, leaving their render unchanged.
    expect(src, "objects? prop present").toMatch(/objects\?:/);
    expect(src, "objects overlay is conditionally rendered").toMatch(/objects\s*&&/);
  });
});
