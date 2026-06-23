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

type FsrRow = { franchise_id: string; season: number; wins: number; losses: number; ties: number; result: string; points_against?: number | null; blowout_wins_60?: number | null };

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

  // W.5 Inc 2 Wave 2 columns (points_against + blowout_wins_60) - a SEPARATE, GRACEFUL read so the
  // Wave 1 records keep working before migration 027 is applied. The Iron Curtain + Executioner
  // render ONLY when the columns exist AND every row is populated (post-backfill); a missing column
  // (pre-027) or any null leaves them unrendered (silence over speculation, not a guessed value).
  let hasWave2 = false;
  {
    const { data: w2, error: w2err } = (await admin
      .from('franchise_season_records')
      .select('franchise_id, season, points_against, blowout_wins_60')
      .eq('league_id', leagueUuid)) as {
      data: { franchise_id: string; season: number; points_against: number | null; blowout_wins_60: number | null }[] | null;
      error: { code?: string } | null;
    };
    if (!w2err && w2 && w2.length > 0 && rows.length > 0) {
      const byKey = new Map(w2.map((r) => [`${r.franchise_id}:${r.season}`, r]));
      let allPresent = true;
      for (const r of rows) {
        const v = byKey.get(`${r.franchise_id}:${r.season}`);
        if (v && v.points_against != null && v.blowout_wins_60 != null) {
          r.points_against = v.points_against;
          r.blowout_wins_60 = v.blowout_wins_60;
        } else {
          allPresent = false;
        }
      }
      hasWave2 = allPresent;
    }
  }

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
    // per-franchise score from running totals; eligibility filter; direction; qualifier; formatter
    score: (s: RunState, fid: string) => number;
    eligible?: (s: RunState, fid: string) => boolean;
    dir?: 'max' | 'min'; // default max (most). 'min' for best-low records (Iron Curtain).
    qualifies?: (v: number) => boolean; // whether a leader value is a real record (default: > 0)
    fmt: (v: number) => string;
  }): LiveRecord {
    const dir = opts.dir ?? 'max';
    const qualifies = opts.qualifies ?? ((v: number) => v > EPS);
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
      const ld = leaders(score, elig, dir);
      if (ld && qualifies(ld.value)) {
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
    const ld = leaders(score, elig, dir);
    const holders = ld && qualifies(ld.value) ? allTimeHolders(ld.fids) : [];
    return {
      docketNumber: opts.docketNumber,
      docketId: latestSeason != null ? `TR-LRC-${opts.docketNumber}-${latestSeason}` : `TR-LRC-${opts.docketNumber}`,
      trophyName: opts.trophyName,
      qualification: opts.qualification,
      valueText: ld && qualifies(ld.value) ? opts.fmt(ld.value) : '',
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

  // W.5 Inc 2 Wave 2 - Group B (render only when the engine-derived columns are present + backfilled).
  if (hasWave2) {
    // #27 The Executioner - most wins by 60+ points (all decided games). Max.
    records.push(aggregateRecord({
      docketNumber: 27, trophyName: 'The Executioner',
      qualification: 'Most wins by 60 or more points.',
      score: (s, fid) => s.agg(fid).blowout60,
      fmt: (v) => `${v} blowout${v === 1 ? '' : 's'} (60+)`,
    }));
    // #28 The Iron Curtain - best (lowest) all-time regular-season points-allowed average. Min.
    records.push(aggregateRecord({
      docketNumber: 28, trophyName: 'The Iron Curtain',
      qualification: 'Best all-time points-allowed average (regular season).',
      score: (s, fid) => { const a = s.agg(fid); return a.regGames > 0 ? a.pa / a.regGames : Number.POSITIVE_INFINITY; },
      eligible: (s, fid) => s.agg(fid).regGames > 0,
      dir: 'min',
      qualifies: (v) => Number.isFinite(v) && v > 0,
      fmt: (v) => `${v.toFixed(1)} pts allowed/game`,
    }));
  }

  return { records };
}

// Running per-franchise totals, advanced one season at a time (the leader-over-time replay).
// pa/regGames/blowout60 are the W.5 Inc 2 Wave 2 accumulators (zero when those columns are absent).
// regGames = games minus a championship appearance (CHAMPION/RUNNER_UP play the one week >= champ
// week), the regular-season denominator for the Iron Curtain average.
type Agg = { w: number; l: number; t: number; titles: number; runnerUps: number; pa: number; regGames: number; blowout60: number };
class RunState {
  private m = new Map<string, Agg>();
  apply(seasonRows: FsrRow[]) {
    for (const r of seasonRows) {
      const a = this.m.get(r.franchise_id) ?? { w: 0, l: 0, t: 0, titles: 0, runnerUps: 0, pa: 0, regGames: 0, blowout60: 0 };
      a.w += r.wins; a.l += r.losses; a.t += r.ties;
      const isFinalist = r.result === 'CHAMPION' || r.result === 'RUNNER_UP';
      if (r.result === 'CHAMPION') a.titles += 1;
      if (r.result === 'RUNNER_UP') a.runnerUps += 1;
      a.pa += r.points_against ?? 0;
      a.blowout60 += r.blowout_wins_60 ?? 0;
      a.regGames += (r.wins + r.losses + r.ties) - (isFinalist ? 1 : 0);
      this.m.set(r.franchise_id, a);
    }
  }
  agg(fid: string): Agg { return this.m.get(fid) ?? { w: 0, l: 0, t: 0, titles: 0, runnerUps: 0, pa: 0, regGames: 0, blowout60: 0 }; }
  fids(): string[] { return Array.from(this.m.keys()); }
}

// ── W.5 Increment 3 Wave A - Grants / Fixed / Multi-list (spec engine
// OBSERVATIONS_2026_06_23_W5_INC3_SPECIFICATION.md, section 3) ────────────────────────────────
// 8 plaques, all DERIVED off franchise_season_records (no migration, no ledger). The per-season
// grants and the fixed records reuse the LiveRecord (single/multi-holder + history) shape; the two
// multi-lists (Back-to-Back, The Perfect Storm) use a list shape (one entry per row). Holders are
// derived reads (C1, never stored), multi-valued on tie (C6, via leaders()), era-correct where
// season-bound. The Sieve self-gates on points_against (graceful, like inc-2 Wave 2).

export type LiveRecordListEntry = { season: number; name: string | null; valueText: string };
export type LiveRecordList = {
  docketNumber: number;
  docketId: string;
  trophyName: string;
  qualification: string;
  entries: LiveRecordListEntry[]; // newest-first
};

export type SeasonAwards = {
  annual: LiveRecord[]; // #2, #5 (if lit), #8, #10, #11 - one per-season grant each
  permanentCards: LiveRecord[]; // #32 Inaugural Champion
  permanentLists: LiveRecordList[]; // #34 Back-to-Back, #35 The Perfect Storm
};

const fmtDelta = (v: number): string => `${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(3).replace(/^0/, '')}`;
const fmtRecord = (w: number, l: number, t: number): string => (t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`);

export async function loadSeasonAwards(admin: AdminClient, leagueUuid: string): Promise<SeasonAwards> {
  const { data: fsrData } = (await admin
    .from('franchise_season_records')
    .select('franchise_id, season, wins, losses, ties, points_for, result')
    .eq('league_id', leagueUuid)
    .order('season', { ascending: true })) as {
    data: { franchise_id: string; season: number; wins: number; losses: number; ties: number; points_for: number; result: string }[] | null;
  };
  const rows = (fsrData ?? []).map((r) => ({ ...r, points_against: null as number | null }));
  if (rows.length === 0) return { annual: [], permanentCards: [], permanentLists: [] };

  // The Sieve's points_against - graceful (inc-2 Wave 2). Lit only when present + populated.
  let hasPA = false;
  {
    const { data: pa, error } = (await admin
      .from('franchise_season_records')
      .select('franchise_id, season, points_against')
      .eq('league_id', leagueUuid)) as { data: { franchise_id: string; season: number; points_against: number | null }[] | null; error: { code?: string } | null };
    if (!error && pa && pa.length > 0) {
      const byKey = new Map(pa.map((r) => [`${r.franchise_id}:${r.season}`, r.points_against]));
      let allPresent = true;
      for (const r of rows) { const v = byKey.get(`${r.franchise_id}:${r.season}`); if (v != null) r.points_against = v; else allPresent = false; }
      hasPA = allPresent;
    }
  }

  // Era-name resolution (the loadLiveRecords pattern).
  const franchiseIds = Array.from(new Set(rows.map((r) => r.franchise_id)));
  const canonicalById = new Map<string, string>();
  const currentNameById = new Map<string, string>();
  {
    const { data: frRows } = (await admin
      .from('franchises')
      .select('id, canonical_franchise_id, owner_display_name')
      .in('id', franchiseIds)) as { data: { id: string; canonical_franchise_id: string; owner_display_name: string }[] | null };
    for (const f of frRows ?? []) { canonicalById.set(f.id, f.canonical_franchise_id); currentNameById.set(f.id, f.owner_display_name); }
  }
  const eraNameByKey = new Map<string, string>();
  {
    const { data: snRows } = (await admin
      .from('franchise_season_names')
      .select('canonical_franchise_id, season, team_name')
      .eq('league_id', leagueUuid)) as { data: { canonical_franchise_id: string; season: number; team_name: string }[] | null };
    for (const r of snRows ?? []) eraNameByKey.set(`${r.canonical_franchise_id}:${r.season}`, r.team_name);
  }
  const eraName = (fid: string, season: number): string | null => {
    const c = canonicalById.get(fid);
    if (c) { const e = eraNameByKey.get(`${c}:${season}`); if (e) return e; }
    return currentNameById.get(fid) ?? null;
  };

  const seasons = Array.from(new Set(rows.map((r) => r.season))).sort((a, b) => a - b);
  const latest = seasons[seasons.length - 1];
  const seasonRows = (s: number) => rows.filter((r) => r.season === s);
  const pctMap = (s: number) => new Map(seasonRows(s).map((r) => [r.franchise_id, winPct(r.wins, r.losses, r.ties)]).filter(([, v]) => v != null) as [string, number][]);

  // A per-season-max grant: latest holder + per-season history (the grant lineage).
  function maxGrant(docket: number, trophyName: string, qualification: string, metric: (r: typeof rows[number]) => number | null, fmt: (v: number) => string): LiveRecord {
    const scoreFor = (s: number) => new Map(seasonRows(s).map((r) => [r.franchise_id, metric(r)]).filter(([, v]) => v != null) as [string, number][]);
    const ld = leaders(scoreFor(latest), null, 'max');
    const holders: LiveRecordHolder[] = ld ? ld.fids.map((f) => ({ franchiseId: f, name: eraName(f, latest), season: latest })) : [];
    const history: LiveRecordHistoryEntry[] = [];
    for (const s of seasons.slice(0, -1)) { const l = leaders(scoreFor(s), null, 'max'); if (l) history.push({ season: s, names: l.fids.map((f) => eraName(f, s) ?? '(unknown)'), valueText: fmt(l.value) }); }
    return { docketNumber: docket, docketId: `TR-LRC-${docket}-${latest}`, trophyName, qualification, valueText: ld ? fmt(ld.value) : '', holders, history };
  }

  const annual: LiveRecord[] = [];

  // #2 The Bridesmaid Bouquet - this season's runner-up.
  {
    const rup = (s: number) => seasonRows(s).filter((r) => r.result === 'RUNNER_UP');
    const cur = rup(latest);
    annual.push({
      docketNumber: 2, docketId: `TR-LRC-2-${latest}`, trophyName: 'The Bridesmaid Bouquet',
      qualification: 'This season\'s runner-up.',
      valueText: cur.length ? `Runner-up (${latest})` : '',
      holders: cur.map((r) => ({ franchiseId: r.franchise_id, name: eraName(r.franchise_id, latest), season: latest })),
      history: seasons.slice(0, -1).flatMap((s) => { const r = rup(s); return r.length ? [{ season: s, names: r.map((x) => eraName(x.franchise_id, s) ?? '(unknown)'), valueText: 'runner-up' }] : []; }),
    });
  }
  // #5 The Sieve - most points allowed this season (tone-care; self-gates on points_against).
  if (hasPA) annual.push(maxGrant(5, 'The Sieve', 'Most points allowed in a single season.', (r) => r.points_against, (v) => `${v} points allowed`));
  // #8 The Climb (C4) - biggest year-over-year win-pct gain (franchises present both seasons).
  {
    const climbFor = (s: number) => { const cur = pctMap(s); const prev = pctMap(s - 1); const d = new Map<string, number>(); for (const [f, c] of Array.from(cur)) { const p = prev.get(f); if (p != null) d.set(f, c - p); } return d; };
    const ld = leaders(climbFor(latest), null, 'max');
    annual.push({
      docketNumber: 8, docketId: `TR-LRC-8-${latest}`, trophyName: 'The Climb',
      qualification: 'Biggest year-over-year improvement in winning percentage.',
      valueText: ld ? `${fmtDelta(ld.value)} win pct (year over year)` : '',
      holders: ld ? ld.fids.map((f) => ({ franchiseId: f, name: eraName(f, latest), season: latest })) : [],
      history: seasons.slice(1, -1).flatMap((s) => { const l = leaders(climbFor(s), null, 'max'); return l ? [{ season: s, names: l.fids.map((f) => eraName(f, s) ?? '(unknown)'), valueText: fmtDelta(l.value) }] : []; }),
    });
  }
  // #10 The Banner - best record this season.
  annual.push(maxGrant(10, 'The Banner', 'Best record in the regular season.', (r) => winPct(r.wins, r.losses, r.ties), (v) => fmtPct(v)));
  // #11 The Engine - most points scored this season.
  annual.push(maxGrant(11, 'The Engine', 'Most points scored in a single season.', (r) => r.points_for, (v) => `${v} points`));

  // #32 Inaugural Champion (fixed) - the 2010 champion.
  const permanentCards: LiveRecord[] = [];
  {
    const ic = rows.filter((r) => r.result === 'CHAMPION' && r.season === 2010);
    permanentCards.push({
      docketNumber: 32, docketId: 'TR-LRC-32-2010', trophyName: 'The Inaugural Champion',
      qualification: 'Won the first championship (2010).',
      valueText: ic.length ? '2010 champion' : '',
      holders: ic.map((r) => ({ franchiseId: r.franchise_id, name: eraName(r.franchise_id, 2010), season: 2010 })),
      history: [],
    });
  }

  const permanentLists: LiveRecordList[] = [];
  // #34 Back-to-Back (list) - champion in consecutive seasons.
  {
    const champ = new Map(rows.filter((r) => r.result === 'CHAMPION').map((r) => [r.season, r.franchise_id]));
    const entries: LiveRecordListEntry[] = [];
    for (const s of seasons) { const a = champ.get(s); const b = champ.get(s + 1); if (a && a === b) entries.push({ season: s, name: eraName(a, s), valueText: `${s}-${s + 1}` }); }
    entries.reverse();
    permanentLists.push({ docketNumber: 34, docketId: 'TR-LRC-34', trophyName: 'Back-to-Back', qualification: 'Won the championship in consecutive seasons.', entries });
  }
  // #35 The Perfect Storm (multi-list; tone-care) - every winless season.
  {
    const winless = rows.filter((r) => r.wins === 0);
    const entries: LiveRecordListEntry[] = winless
      .slice()
      .sort((a, b) => b.season - a.season)
      .map((r) => ({ season: r.season, name: eraName(r.franchise_id, r.season), valueText: `${fmtRecord(r.wins, r.losses, r.ties)} (${r.season})` }));
    permanentLists.push({ docketNumber: 35, docketId: 'TR-LRC-35', trophyName: 'The Perfect Storm', qualification: 'A winless season - every one, kept.', entries });
  }

  // W.5 Inc 3 Wave B1 - the weekly-score-derived awards from season_award_winners (graceful: table
  // absent -> these render nothing, Wave A unaffected). franchise_id is the engine canonical code.
  {
    const { data: saw, error } = (await admin
      .from('season_award_winners')
      .select('award_id, season, franchise_id, value')
      .eq('league_id', leagueUuid)) as { data: { award_id: string; season: number; franchise_id: string; value: number | null }[] | null; error: { code?: string } | null };
    if (!error && saw && saw.length > 0) {
      const currentNameByCanon = new Map<string, string>();
      for (const [uuid, canon] of Array.from(canonicalById)) { const n = currentNameById.get(uuid); if (n) currentNameByCanon.set(canon, n); }
      const eraNameCanon = (canon: string, season: number): string | null => eraNameByKey.get(`${canon}:${season}`) ?? currentNameByCanon.get(canon) ?? null;

      // #4 The Cannon + #12 The Black Rose - all-time max single value; per-season rows = history.
      const allTimeCard = (award: string, docket: number, trophyName: string, qualification: string, fmt: (v: number) => string): LiveRecord | null => {
        const aw = saw.filter((r) => r.award_id === award && r.value != null);
        if (aw.length === 0) return null;
        const best = Math.max(...aw.map((r) => r.value as number));
        const holders: LiveRecordHolder[] = aw.filter((r) => r.value === best).map((r) => ({ franchiseId: r.franchise_id, name: eraNameCanon(r.franchise_id, r.season), season: r.season }));
        const bySeason = new Map<number, { fids: string[]; value: number }>();
        for (const r of aw) { const cur = bySeason.get(r.season); const v = r.value as number; if (!cur || v > cur.value) bySeason.set(r.season, { fids: [r.franchise_id], value: v }); else if (v === cur.value) cur.fids.push(r.franchise_id); }
        const history: LiveRecordHistoryEntry[] = Array.from(bySeason.keys()).sort((a, b) => a - b).map((s) => { const e = bySeason.get(s)!; return { season: s, names: e.fids.map((f) => eraNameCanon(f, s) ?? '(unknown)'), valueText: fmt(e.value) }; });
        return { docketNumber: docket, docketId: `TR-LRC-${docket}`, trophyName, qualification, valueText: fmt(best), holders, history };
      };
      const cannon = allTimeCard('4', 4, 'The Cannon', 'The highest single-week score in league history.', (v) => `${v} points`);
      const rose = allTimeCard('12', 12, 'The Black Rose', 'The highest score in a losing effort.', (v) => `${v} points`);
      if (cannon) permanentCards.push(cannon);
      if (rose) permanentCards.push(rose);

      // #33 The One-Point Club (list; C6) - winners of championships decided by margin < 2.
      const opc = saw.filter((r) => r.award_id === '33').sort((a, b) => b.season - a.season);
      if (opc.length > 0) {
        const entries: LiveRecordListEntry[] = opc.map((r) => ({ season: r.season, name: eraNameCanon(r.franchise_id, r.season), valueText: `won by ${r.value} (${r.season})` }));
        permanentLists.push({ docketNumber: 33, docketId: 'TR-LRC-33', trophyName: 'The One-Point Club', qualification: 'Won a championship decided by less than two points.', entries });
      }
    }
  }

  return { annual, permanentCards, permanentLists };
}
