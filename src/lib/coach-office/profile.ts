// src/lib/coach-office/profile.ts
// Coach Office owner profile - Phase 2 (owner personalization).
// D-2 (founder, 2026-06-30): the profile is DERIVED from the existing `franchises`
// row plus constants. No `coach_office_profiles` table, no migration in Phase 2.
// coachId (the URL param) is a `canonical_franchise_id`; it resolves to at most one
// franchise row per league. Returns null on no match (an honest gap - the caller
// renders an empty/absent office rather than inventing one).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { League } from "@/lib/league";
import { COACH_OFFICE_HOTSPOTS_V1 } from "@/lib/coach-office/hotspots";

type AdminClient = SupabaseClient<Database>;

export type CoachOfficeProfile = {
  coachId: string; // canonical_franchise_id (the URL param)
  franchiseUuid: string; // internal: franchises.id, used to filter derived records
  teamName: string; // owner_display_name (the current nameplate)
  hotspotMapId: string; // the v1 manifest id (constant; no per-coach override in P2)
};

export async function resolveCoachOfficeProfile(
  admin: AdminClient,
  league: League,
  coachId: string,
): Promise<CoachOfficeProfile | null> {
  const { data } = (await admin
    .from("franchises")
    .select("id, owner_display_name")
    .eq("league_id", league.id)
    .eq("canonical_franchise_id", coachId)
    .maybeSingle()) as {
    data: { id: string; owner_display_name: string } | null;
  };

  if (!data) return null;

  return {
    coachId,
    franchiseUuid: data.id,
    teamName: data.owner_display_name,
    hotspotMapId: COACH_OFFICE_HOTSPOTS_V1.hotspot_map_id,
  };
}

// The nameplate is the owner's PUBLIC franchise identity (D-4a): the display name shown
// verbatim as a runtime data overlay (CO-R4 - never baked into the art). It is not a
// media likeness, voice, or attributed words, so it carries NO media-consent gate;
// gating a public team name would blank every office and narrow below the CO.3 reality
// baseline. Pure passthrough: nothing is transformed or invented; empty stays empty.
export function nameplateText(displayName: string): string {
  return displayName;
}
