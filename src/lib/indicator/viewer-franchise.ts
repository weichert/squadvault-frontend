// src/lib/indicator/viewer-franchise.ts
// SIGNED-IN INDICATOR — the one additive read: the viewer's own franchise display name.
// Mirrors the room pattern (resolveCoachOfficeViewerContext reads franchises WHERE
// league_id AND member_user_id); this selects the display NAME instead of the canonical id.
// Display-only; touches no auth path and does not modify viewer-context.ts. Returns null
// when the signed-in viewer has no franchise here (the caller renders the honest fallback).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type AdminClient = SupabaseClient<Database>;

export async function resolveViewerFranchiseName(
  admin: AdminClient,
  leagueId: string,
  userId: string,
): Promise<string | null> {
  const { data } = (await admin
    .from("franchises")
    .select("owner_display_name")
    .eq("league_id", leagueId)
    .eq("member_user_id", userId)
    .maybeSingle()) as { data: { owner_display_name: string } | null };
  return data?.owner_display_name ?? null;
}
