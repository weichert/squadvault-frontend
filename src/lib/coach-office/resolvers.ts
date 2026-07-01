// src/lib/coach-office/resolvers.ts
// Coach Office owner-based resolvers - Phase 2. Deterministic, derive-only: a coach's
// trophies and rings come from the league CHAMPIONSHIP record (reused via
// lib/trophy-room.ts loadChampionshipPackage), filtered to this coach's franchise.
// Nothing is invented - a coach with no titles yields an empty list (empty state).
//
// Phase 2 scope: CHAMPIONSHIP trophies only. Phase 2b (deferred, see the Phase 2
// brief) adds the coach's held Live Records + Season Awards to the Trophy Case.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { League } from "@/lib/league";
import { loadChampionshipPackage } from "@/lib/trophy-room";

type AdminClient = SupabaseClient<Database>;

// One championship the coach holds -> one trophy in the case and one ring in the box.
export type CoachChampionship = {
  season: number;
  title: string;
  teamName: string | null; // era-correct champion name for that title season
};

// The coach's championships (newest-first), derived off the league championship record
// and filtered to their franchise uuid. Call once per render; the Trophy Case and Ring
// Box are two views over this one list.
export async function resolveCoachChampionships(
  admin: AdminClient,
  league: League,
  franchiseUuid: string,
): Promise<CoachChampionship[]> {
  const pkg = await loadChampionshipPackage(admin, league.id);
  return pkg.champions
    .filter((c) => c.franchiseId === franchiseUuid)
    .map((c) => ({ season: c.season, title: c.title, teamName: c.eraName }));
}
