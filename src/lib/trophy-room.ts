// src/lib/trophy-room.ts
// W.5 Trophy Room - Championship Package read-model (spec engine
// OBSERVATIONS_2026_06_21_PHASE_11_W5_TROPHY_ROOM_SPECIFICATION_INC1.md, sections 4 + 8). Two data
// paths, kept distinct (spec D1):
//   - the Belt (traveling) reads the trophy_custody_events transfer LEDGER (migration 025); its
//     current holder is a DERIVED read (the latest event's to_franchise), NEVER stored (C1);
//   - the Ring (mint-and-keep) and the League Trophy (communal cumulative) are DERIVED reads off
//     the championship record (trophy_room_entries entry_type=CHAMPIONSHIP) - no custody events.
// All names are era-correct (franchise_season_names, migration 009): a champion renders under the
// team name AS IT EXISTED in the title season, never the current name. A gap (no holder, no era
// name) renders as silence, never a guess.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type AdminClient = SupabaseClient<Database>;

// The Belt's taxonomy/Docket catalog code (Docket scheme TR-<CAT>-<artifact#>; the Belt = TR-CP-1).
// The only Championship Package trophy with a custody ledger.
export const TROPHY_BELT_ID = 'TR-CP-1';

// PFL expansion - ATTESTED (C7 closed 2026-06-21, engine
// OBSERVATIONS_2026_06_21_PFL_EXPANSION_ATTESTATION_C7_CLOSURE.md). The only permitted expansion of
// "PFL" on a nameplate. Where a per-artifact fact is unattested, the nameplate is blank, never guessed.
export const PFL_EXPANSION = 'Phony Football League';

export type ChampionEntry = {
  season: number;
  franchiseId: string | null;
  eraName: string | null; // era-correct champion name, or null = honest gap
  title: string;
};

export type BeltTransfer = {
  season: number;
  week: number | null;
  fromName: string | null; // era-correct prior holder (null = origin event / honest gap)
  toName: string | null; // era-correct new holder
  occasion: string | null; // the heist narrative, rendered with relish; null = honest gap
  ratifiedAt: string;
};

export type ChampionshipPackage = {
  // The Belt (traveling individual): derived current holder + the full provenance chain.
  belt: {
    currentHolderName: string | null; // DERIVED: latest event's to_franchise; null = no events (blank, not guessed)
    currentSeason: number | null;
    transferCount: number; // DERIVED ordinal (the Nth transfer); 0 when no events
    chain: BeltTransfer[]; // newest-first
  };
  // The Ring (mint-and-keep) and the League Trophy (communal cumulative) both derive off the same
  // champion record; the Ring frames it as an accumulating set of individual rings, the League
  // Trophy as one perpetual cumulative name list. champions is newest-first.
  champions: ChampionEntry[];
};

export async function loadChampionshipPackage(
  admin: AdminClient,
  leagueUuid: string,
): Promise<ChampionshipPackage> {
  // 1. The championship record (the Ring + League Trophy source, and the league's title history).
  const { data: champRows } = (await admin
    .from('trophy_room_entries')
    .select('season, franchise_id, title')
    .eq('league_id', leagueUuid)
    .eq('entry_type', 'CHAMPIONSHIP')
    .order('season', { ascending: false })) as {
    data: { season: number | null; franchise_id: string | null; title: string }[] | null;
  };
  const champs = champRows ?? [];

  // 2. The Belt transfer ledger (newest-first; matches the migration 025 index order).
  const { data: beltRows } = (await admin
    .from('trophy_custody_events')
    .select('from_franchise, to_franchise, occasion, season, week, ratified_at')
    .eq('league_id', leagueUuid)
    .eq('trophy_id', TROPHY_BELT_ID)
    .order('season', { ascending: false })
    .order('week', { ascending: false, nullsFirst: false })
    .order('ratified_at', { ascending: false })) as {
    data: {
      from_franchise: string | null;
      to_franchise: string;
      occasion: string | null;
      season: number;
      week: number | null;
      ratified_at: string;
    }[] | null;
  };
  const beltEvents = beltRows ?? [];

  // 3. Resolve era-correct names. Gather every referenced franchise id, then build
  //    uuid -> canonical_franchise_id and (canonical:season) -> era name, exactly as the shipped
  //    trophy-room page does (two maps off one franchises round trip + the season-names table).
  const franchiseIds = Array.from(
    new Set(
      [
        ...champs.map((c) => c.franchise_id),
        ...beltEvents.map((e) => e.to_franchise),
        ...beltEvents.map((e) => e.from_franchise),
      ].filter((x): x is string => !!x),
    ),
  );
  const canonicalById = new Map<string, string>();
  const currentNameById = new Map<string, string>();
  if (franchiseIds.length > 0) {
    const { data: frRows } = (await admin
      .from('franchises')
      .select('id, canonical_franchise_id, owner_display_name')
      .in('id', franchiseIds)) as {
      data: { id: string; canonical_franchise_id: string; owner_display_name: string }[] | null;
    };
    for (const f of frRows ?? []) {
      canonicalById.set(f.id, f.canonical_franchise_id);
      currentNameById.set(f.id, f.owner_display_name);
    }
  }
  const eraNameByKey = new Map<string, string>();
  {
    const { data: snRows } = (await admin
      .from('franchise_season_names')
      .select('canonical_franchise_id, season, team_name')
      .eq('league_id', leagueUuid)) as {
      data: { canonical_franchise_id: string; season: number; team_name: string }[] | null;
    };
    for (const r of snRows ?? []) eraNameByKey.set(`${r.canonical_franchise_id}:${r.season}`, r.team_name);
  }

  // Era-correct name for a franchise in a given season: uuid -> canonical -> (canonical:season),
  // falling back to the current name only if a season name is absent (defensive). null if unknown.
  const eraName = (franchiseId: string | null, season: number | null): string | null => {
    if (!franchiseId) return null;
    const canonical = canonicalById.get(franchiseId);
    if (canonical && season != null) {
      const era = eraNameByKey.get(`${canonical}:${season}`);
      if (era) return era;
    }
    return currentNameById.get(franchiseId) ?? null;
  };

  const champions: ChampionEntry[] = champs.map((c) => ({
    season: c.season ?? 0,
    franchiseId: c.franchise_id,
    eraName: eraName(c.franchise_id, c.season),
    title: c.title,
  }));

  const chain: BeltTransfer[] = beltEvents.map((e) => ({
    season: e.season,
    week: e.week,
    fromName: eraName(e.from_franchise, e.season),
    toName: eraName(e.to_franchise, e.season),
    occasion: e.occasion,
    ratifiedAt: e.ratified_at,
  }));
  const latest = beltEvents[0] ?? null;

  return {
    belt: {
      currentHolderName: latest ? eraName(latest.to_franchise, latest.season) : null,
      currentSeason: latest ? latest.season : null,
      transferCount: beltEvents.length,
      chain,
    },
    champions,
  };
}
