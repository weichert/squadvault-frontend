// src/lib/coach-office/hotspots.ts
// Runtime source of Coach Office hotspot geometry. Transcribed verbatim from the
// manifest template (the source of truth):
//   docs/coach_office/final_spec_package_v1/Coach_Office_Hotspot_Map_Template_v1.json
//
// ALL hotspot coordinates live here (and in that template) - never in components.
// Components consume this data and compute positions from it (Phase 1 acceptance
// criterion 2). Editing an x/y below moves the hotspot; no component carries a
// coordinate literal.
import type { HotspotMap } from "./types";

export const COACH_OFFICE_HOTSPOTS_V1: HotspotMap = {
  hotspot_map_id: "coach_office_hotspots_v1",
  image_width: 1792,
  image_height: 1024,
  hotspots: [
    {
      hotspot_id: "trophy_case",
      surface: "coach_office_hero",
      label: "Trophy Case",
      x: 1200,
      y: 180,
      width: 360,
      height: 520,
      hover_behavior: "soft_glow",
      click_action: "open_trophy_case",
      content_source: "trophy_display_resolver",
      visitor_aware: false,
      mvp_required: true,
    },
    {
      hotspot_id: "championship_ring_box",
      surface: "coach_office_hero",
      label: "Championship Ring Box",
      x: 880,
      y: 660,
      width: 180,
      height: 110,
      hover_behavior: "soft_glow",
      click_action: "open_ring_box",
      content_source: "ring_box_resolver",
      visitor_aware: false,
      mvp_required: true,
    },
    {
      hotspot_id: "office_board",
      surface: "coach_office_hero",
      label: "Office Board",
      x: 640,
      y: 220,
      width: 360,
      height: 220,
      hover_behavior: "soft_glow",
      click_action: "open_board_detail",
      content_source: "board_message_resolver",
      visitor_aware: true,
      mvp_required: true,
    },
    {
      hotspot_id: "framed_photos",
      surface: "coach_office_hero",
      label: "Framed Photos",
      x: 240,
      y: 180,
      width: 330,
      height: 260,
      hover_behavior: "soft_glow",
      click_action: "open_photo_gallery",
      content_source: "photo_frame_resolver",
      visitor_aware: true,
      mvp_required: true,
    },
    {
      hotspot_id: "cardboard_cutout_slot",
      surface: "coach_office_hero",
      label: "Cardboard Cutout",
      x: 1040,
      y: 300,
      width: 160,
      height: 360,
      hover_behavior: "cursor_only",
      click_action: "open_cutout_detail",
      content_source: "cutout_resolver",
      visitor_aware: true,
      mvp_required: false,
    },
  ],
};
