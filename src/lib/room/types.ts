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
// NEVER baked into the art - it is supplied at render time from data and laid out
// on a curved baseline (SVG textPath) that follows the painted banner cloth. All
// geometry is in master-image pixel space (image_width/height), so it scales with
// the rendered stage exactly like the hotspot zones.
export interface RoomBanner {
  // SVG path the text baseline follows (image coords). Its gentle "smile" is what
  // makes the text sit on the draped cloth rather than across it.
  text_path: string;
  // rotation of the whole text block about `rotate_origin`. The cloth rises to the
  // right, so this is NEGATIVE (right side lifted); tuned against the master.
  rotate_deg: number;
  rotate_origin: { x: number; y: number };
  // font size + letter spacing in image user units (scale with the stage).
  font_size: number;
  letter_spacing: number;
  // how the text is anchored along the path: center | left | right.
  align: "left" | "center" | "right";
  // 0-100: how strongly the room's overhead light reads on the glyphs - a top
  // highlight fading to a bronze shadow at the letter bottoms. Applied as a
  // gradient FILL (not per-name art), so it holds for any league's text.
  light: number;
  // Fabric integration: the banner's OWN light/shadow (sampled from the master,
  // masked to the glyph shapes, blended over the text) so the letters pick up the
  // cloth's folds and sit IN the fabric instead of typed on top. Also per-name
  // agnostic - it reads the art, not the string. `fabric` is 0-100 strength.
  fabric: number;
  fabric_blend: "soft-light" | "overlay" | "multiply" | "none";
}

export interface RoomManifest {
  manifest_id: string;
  note?: string;
  image_width: number;
  image_height: number;
  banner?: RoomBanner;
  hotspots: RoomHotspot[];
}
