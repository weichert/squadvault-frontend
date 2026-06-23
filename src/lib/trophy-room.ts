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

// ── W.5 Increment 2 Wave 1 - Live Records (Group A) ──────────────────────────────────────────
// The 4 traveling-record plaques derivable from the existing synced championship/season record
// (franchise_season_records, migration 008): #24 The Cavallini Standard, #25 The Dynasty, #26 The
// Eternal Runner-Up, #30 The Floor. Each holder is a DERIVED read (C1, never stored), multi-valued
// on tie (C6). No manual custody ledger (that is the Belt's); a Live Record's holder is the current
// extreme value, and its "chain" is the leader-over-time history, replayed from completed seasons.

export type LiveRecordHolder = {
  franchiseId: string;
  name: string | null; // era-correct for season-specific records (The Floor); current name for all-time
  season: number | null; // the season for The Floor; null for all-time aggregates
};

export type LiveRecordHistoryEntry = {
  season: number; // the season at which this leader took/held the mark
  names: string[]; // the leader(s) as of that season (co-leaders listed)
  valueText: string;
};

export type LiveRecord = {
  docketNumber: number; // taxonomy artifact # (24/25/26/30)
  docketId: string; // TR-LRC-<#>-<season> (or TR-LRC-<#> when not season-bound)
  trophyName: string;
  qualification: string; // immutable definition - no baked-in holder
  valueText: string; // the current qualifying value, formatted
  holders: LiveRecordHolder[]; // multi-valued on tie
  history: LiveRecordHistoryEntry[]; // leader-over-time, oldest-first (drill-in)
};

export type LiveRecords = { records: LiveRecord[] };

type FsrRow = { franchise_id: string; season: number; wins: number; losses: number; ties: number; result: string };

function winPct(w: number, l: number, t: number): number | null {
  const g = w + l + t;
  return g > 0 ? w / g : null;
}
function fmtPct(p: number): string {
  const s = p.toFixed(3); // ".734" / "1.000"
  return p < 1 ? s.replace(/^0/, '') : s;
}
const EPS = 1e-9;

// The set of franchise ids that lead a per-franchise numeric score (max or min), among the eligible
// set, above/below a threshold. Multi-valued: returns every franchise tied at the extreme.
function leaders(
  score: Map<string, number>,
  eligible: Set<string> | null,
  dir: 'max' | 'min',
): { value: number; fids: string[] } | null {
  let best: number | null = null;
  for (const [fid, v] of Array.from(score)) {
    if (eligible && !eligible.has(fid)) continue;
    if (best === null || (dir === 'max' ? v > best + EPS : v < best - EPS)) best = v;
  }
  if (best === null) return null;
  const fids = Array.from(score)
    .filter(([fid, v]) => (!eligible || eligible.has(fid)) && Math.abs(v - best!) <= EPS)
    .map(([fid]) => fid);
  return { value: best, fids };
}

export async function loadLiveRecords(admin: AdminClient, leagueUuid: string): Promise<LiveRecords> {
  const { data: fsrData } = (await admin
    .from('franchise_season_records')
    .select('franchise_id, season, wins, losses, ties, result')
    .eq('league_id', leagueUuid)
    .order('season', { ascending: true })) as { data: FsrRow[] | null };
  const rows = fsrData ?? [];

  // Name resolution (the loadChampionshipPackage pattern): era-correct for a given season, with the
  // current name as the all-time identity / defensive fallback.
  const franchiseIds = Array.from(new Set(rows.map((r) => r.franchise_id)));
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
  const eraName = (fid: string, season: number): string | null => {
    const c = canonicalById.get(fid);
    if (c) { const e = eraNameByKey.get(`${c}:${season}`); if (e) return e; }
    return currentNameById.get(fid) ?? null;
  };
  const currentName = (fid: string): string | null => currentNameById.get(fid) ?? null;

  const seasons = Array.from(new Set(rows.map((r) => r.season))).sort((a, b) => a - b);
  const latestSeason = seasons.length ? seasons[seasons.length - 1] : null;
  const allTimeHolders = (fids: string[]): LiveRecordHolder[] =>
    fids.map((fid) => ({ franchiseId: fid, name: currentName(fid), season: null }));

  // Running aggregates replayed season-by-season (oldest first) for the leader-over-time history.
  const records: LiveRecord[] = [];

  // Generic aggregate-record builder for #24/#25/#26 (all-time franchise aggregates).
  function aggregateRecord(opts: {
    docketNumber: number; trophyName: string; qualification: string;
    // per-franchise score from running totals; eligibility filter; value formatter
    score: (s: RunState, fid: string) => number;
    eligible?: (s: RunState, fid: string) => boolean;
    fmt: (v: number) => string;
  }): LiveRecord {
    const run = new RunState();
    const history: LiveRecordHistoryEntry[] = [];
    let prevKey = '';
    for (const season of seasons) {
      run.apply(rows.filter((r) => r.season === season));
      const score = new Map<string, number>();
      const elig = opts.eligible ? new Set<string>() : null;
      for (const fid of run.fids()) {
        score.set(fid, opts.score(run, fid));
        if (elig && opts.eligible!(run, fid)) elig.add(fid);
      }
      const ld = leaders(score, elig, 'max');
      if (ld && ld.value > EPS) {
        const key = `${ld.fids.slice().sort().join(',')}|${ld.value.toFixed(6)}`;
        if (key !== prevKey) {
          history.push({ season, names: ld.fids.map((f) => currentName(f) ?? '(unknown)'), valueText: opts.fmt(ld.value) });
          prevKey = key;
        }
      }
    }
    // current = final state
    const score = new Map<string, number>();
    const elig = opts.eligible ? new Set<string>() : null;
    for (const fid of run.fids()) { score.set(fid, opts.score(run, fid)); if (elig && opts.eligible!(run, fid)) elig.add(fid); }
    const ld = leaders(score, elig, 'max');
    const holders = ld && ld.value > EPS ? allTimeHolders(ld.fids) : [];
    return {
      docketNumber: opts.docketNumber,
      docketId: latestSeason != null ? `TR-LRC-${opts.docketNumber}-${latestSeason}` : `TR-LRC-${opts.docketNumber}`,
      trophyName: opts.trophyName,
      qualification: opts.qualification,
      valueText: ld && ld.value > EPS ? opts.fmt(ld.value) : '',
      holders,
      history,
    };
  }

  // #24 The Cavallini Standard - highest all-time winning percentage.
  records.push(aggregateRecord({
    docketNumber: 24, trophyName: 'The Cavallini Standard',
    qualification: 'Highest all-time winning percentage.',
    score: (s, fid) => { const a = s.agg(fid); return winPct(a.w, a.l, a.t) ?? -1; },
    eligible: (s, fid) => { const a = s.agg(fid); return a.w + a.l + a.t > 0; },
    fmt: (v) => fmtPct(v),
  }));

  // #25 The Dynasty - most championships.
  records.push(aggregateRecord({
    docketNumber: 25, trophyName: 'The Dynasty',
    qualification: 'Most championships.',
    score: (s, fid) => s.agg(fid).titles,
    fmt: (v) => `${v} ${v === 1 ? 'championship' : 'championships'}`,
  }));

  // #26 The Eternal Runner-Up - most runner-up finishes, no title.
  records.push(aggregateRecord({
    docketNumber: 26, trophyName: 'The Eternal Runner-Up',
    qualification: 'Most runner-up finishes without ever winning the title.',
    score: (s, fid) => s.agg(fid).runnerUps,
    eligible: (s, fid) => s.agg(fid).titles === 0,
    fmt: (v) => `${v} runner-up${v === 1 ? '' : 's'}, no title`,
  }));

  // #30 The Floor - the worst single-season record (tone-care; multi-valued on tie, C6).
  {
    type SeasonLow = { fid: string; season: number; w: number; l: number; t: number; pct: number };
    let worst: number | null = null;
    const lowHistory: LiveRecordHistoryEntry[] = [];
    const fmtFloor = (w: number, l: number, t: number) => (t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`);
    // replay seasons oldest-first; emit each time the all-time worst is broken.
    for (const season of seasons) {
      for (const r of rows.filter((x) => x.season === season)) {
        const p = winPct(r.wins, r.losses, r.ties);
        if (p === null) continue;
        if (worst === null || p < worst - EPS) {
          worst = p;
          lowHistory.push({ season, names: [eraName(r.franchise_id, season) ?? '(unknown)'], valueText: `${fmtFloor(r.wins, r.losses, r.ties)} (${season})` });
        }
      }
    }
    // current holders = all (franchise, season) rows at the all-time min pct
    const lows: SeasonLow[] = [];
    for (const r of rows) {
      const p = winPct(r.wins, r.losses, r.ties);
      if (p !== null) lows.push({ fid: r.franchise_id, season: r.season, w: r.wins, l: r.losses, t: r.ties, pct: p });
    }
    const minPct = lows.length ? Math.min(...lows.map((x) => x.pct)) : null;
    const floorHolders = minPct === null ? [] : lows.filter((x) => Math.abs(x.pct - minPct) <= EPS);
    const sample = floorHolders[0];
    records.push({
      docketNumber: 30,
      docketId: sample ? `TR-LRC-30-${sample.season}` : 'TR-LRC-30',
      trophyName: 'The Floor',
      qualification: 'The worst single-season record in league history.',
      valueText: sample ? fmtFloor(sample.w, sample.l, sample.t) : '',
      holders: floorHolders.map((x) => ({ franchiseId: x.fid, name: eraName(x.fid, x.season), season: x.season })),
      history: lowHistory,
    });
  }

  return { records };
}

// Running per-franchise totals, advanced one season at a time (the leader-over-time replay).
class RunState {
  private m = new Map<string, { w: number; l: number; t: number; titles: number; runnerUps: number }>();
  apply(seasonRows: { franchise_id: string; wins: number; losses: number; ties: number; result: string }[]) {
    for (const r of seasonRows) {
      const a = this.m.get(r.franchise_id) ?? { w: 0, l: 0, t: 0, titles: 0, runnerUps: 0 };
      a.w += r.wins; a.l += r.losses; a.t += r.ties;
      if (r.result === 'CHAMPION') a.titles += 1;
      if (r.result === 'RUNNER_UP') a.runnerUps += 1;
      this.m.set(r.franchise_id, a);
    }
  }
  agg(fid: string) { return this.m.get(fid) ?? { w: 0, l: 0, t: 0, titles: 0, runnerUps: 0 }; }
  fids(): string[] { return Array.from(this.m.keys()); }
}
