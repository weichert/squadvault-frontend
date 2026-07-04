// src/lib/room/types.ts
// Room-agnostic manifest shape for the layered parallax-room component family.
// The W.2 Clubhouse is the first instance; the Coach Office room will reuse the
// same RoomScene + this shape (a different manifest + master asset, no fork).
//
// Geometry is the manifest's job; components carry no coordinate literal. A Step-3
// vitest schema test validates each shipped manifest against this shape.

export type Wiring =
  // routes to an existing surface; {id} (and any {param}) in href is replaced from
  // the params map at render time. `gated` is informational only - the room never
  // gates; the destination page enforces its own bounce (consent is law there).
  | { type: "route"; href: string; gated: boolean }
  // a dignified pending state - opens a ceremonial modal, never a dead end/404.
  | { type: "pending"; title: string; body: string }
  // an inert character object - hover acknowledgment only, no navigation, not a
  // tab stop (it names no destination).
  | { type: "inert" };

// A transparent object plate placed over the master at its in-scene position.
// Coordinates are in master-image pixel space (manifest image_width/height).
export interface PlatePlacement {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoomZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoomHotspot {
  id: string;
  label: string;
  aria_label: string;
  zone: RoomZone;
  wiring: Wiring;
  // null where no clean plate has landed: the hotspot is drawn on the master, no
  // parallax, upgraded per-plate later with zero API change.
  plate: PlatePlacement | null;
  // 0 = deepest (hearth) ... 3 = foreground (desk). Drives parallax magnitude.
  depth_band: number;
}

// Optional runtime text surface (e.g. the clubhouse banner). The text itself is
// NEVER baked into the art - it is supplied at render time from data.
export interface RoomBanner {
  zone: RoomZone;
  align: "left" | "center" | "right";
}

export interface RoomManifest {
  manifest_id: string;
  note?: string;
  image_width: number;
  image_height: number;
  banner?: RoomBanner;
  hotspots: RoomHotspot[];
}
