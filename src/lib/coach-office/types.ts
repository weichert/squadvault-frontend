// src/lib/coach-office/types.ts
// Coach Office hotspot manifest types. These mirror the manifest schema in
//   docs/coach_office/final_spec_package_v1/Coach_Office_Hotspot_Map_Template_v1.json
// Phase 1 (static shell): geometry + placeholder routing only. The resolvers
// named by content_source / click_action are wired in later phases; Phase 1
// renders labeled placeholder modals and reads no content.

export type HotspotHoverBehavior = "soft_glow" | "cursor_only";

export type HotspotClickAction =
  | "open_trophy_case"
  | "open_ring_box"
  | "open_board_detail"
  | "open_photo_gallery"
  | "open_cutout_detail";

// One interactive region over the base scene. x/y/width/height are expressed in
// the manifest's own pixel space (image_width x image_height); consumers convert
// to percentages so the geometry stays resolution-independent and data-driven.
export type Hotspot = {
  hotspot_id: string;
  surface: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hover_behavior: HotspotHoverBehavior;
  click_action: HotspotClickAction;
  content_source: string;
  visitor_aware: boolean;
  mvp_required: boolean;
};

export type HotspotMap = {
  hotspot_map_id: string;
  image_width: number;
  image_height: number;
  hotspots: Hotspot[];
};
