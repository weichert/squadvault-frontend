// src/lib/trophy-room/case-view-bands.ts
// TROPHY ROOM pivot — the pure Case View seam (the G1/G2 Living Room rulings). No I/O, no DOM:
// the whole correctness surface is node-provable (the hall-cases / viewer-holdings idiom).
//
// D-BANDS: the Case View marquees five real trophies large (the viewer's held first, then
// docket order — the page's composition order), and the full-record affordance shows the
// COMPLETE category via the shipped category grid. The marquee is a strict PREFIX of that
// same held-first ordering, so nothing is hidden and nothing reorders between the views.
// D-PLINTH: the League Trophy (communal perpetual) takes the plinth — reigning champion up
// front, the full accumulated champion roll in the detail. The Ring (mint-and-keep) is a
// Championship-case shelf object; the League Trophy NEVER enters a case.
// D-LOWER: CATEGORY_NOTES is static descriptive copy — the nature of a category, never its
// quantity. No numerals (G2 ruling 1: counts in static copy drift into silent lies), no
// holders, no league identity. Facts live on placards with receipts; blank is the fallback.
import { TROPHY_BELT_ID, type ChampionEntry, type ChampionshipPackage } from "@/lib/trophy-room";
import type { HallObject } from "@/lib/trophy-room/hall-cases";

export const MARQUEE_BANDS = 5;

// UI keys for the two communal-record objects (display identity, not fact dockets — their
// facts live in the championship record they derive from).
export const TROPHY_RING_KEY = "TR-CP-RING";
export const LEAGUE_TROPHY_KEY = "TR-CP-LEAGUE-TROPHY";

// ── manifest geometry types (the case_view block; geometry is DATA, never in components) ──
export type Rect = { x: number; y: number; width: number; height: number };
export type CaseBand = { shelf: Rect; placard: Rect };
export type CaseViewGeometry = {
  image_width: number;
  image_height: number;
  header_plaque: Rect; // the category name's home
  lower_panel: Rect; // the D-LOWER note's home
  bands: CaseBand[]; // five, top-to-bottom (four lit shelves + the base counter)
};
// `zone` is the full clickable case rect; `header` (optional) is the case's painted top plaque
// rect where the runtime category title sits ON the case (N3 — never floating above it).
export type RoomCaseZone = { id: string; category: string; label: string; zone: Rect; header?: Rect };

// The marquee: the viewer's held first (stable), then the input (docket) order — the same
// held-first ordering the shipped category grid uses, so the marquee is its strict prefix.
export function selectMarquee(objects: HallObject[]): { marquee: HallObject[]; total: number } {
  const ordered = [...objects.filter((o) => o.isHeld), ...objects.filter((o) => !o.isHeld)];
  return { marquee: ordered.slice(0, MARQUEE_BANDS), total: objects.length };
}

// Adaptive band selection (N1): a case with N marquee trophies occupies max(N, 2) of the five
// physical bands, spread evenly so the trophies read as well-rhythmed rows rather than a cluster
// against empty shelves — the Championship's two must sit as two well-spaced bands, never two
// atop three empties. Centered spread: for K bands over the five slots, slot(i) =
// floor((i + 0.5) * total / K) — symmetric, deterministic, and the identity when K equals five.
export function selectBandSlots(count: number, total = MARQUEE_BANDS): number[] {
  const k = Math.min(Math.max(count, 0), total);
  return Array.from({ length: k }, (_, i) => Math.floor(((i + 0.5) * total) / k));
}

// One trophy per band, spread across the case (adaptive, N1). Short groups still lay out at least
// two bands of vertical structure; more than five is a CONTRACT VIOLATION and fails loudly (G2
// ruling 2) — a silent truncation here would hide a fact, the exact thing D-BANDS forbids.
// Selection (held-first, capped) happens upstream in selectMarquee.
export function placeOnBands(marquee: HallObject[]): HallObject[][] {
  if (marquee.length > MARQUEE_BANDS) {
    throw new Error(
      `placeOnBands received ${marquee.length} objects for ${MARQUEE_BANDS} bands — select the marquee upstream; never truncate here`,
    );
  }
  const bandCount = Math.min(Math.max(marquee.length, 2), MARQUEE_BANDS);
  const slots = selectBandSlots(bandCount);
  const bands: HallObject[][] = Array.from({ length: MARQUEE_BANDS }, () => []);
  marquee.forEach((o, i) => {
    bands[slots[i]] = [o];
  });
  return bands;
}

// D-RATIO (N4): a ratio-class mark — winning percentage, the Clairvoyant's accuracy — is stored
// as a bare fraction and reads clearest as a percentage (0.8214 -> "82.14%"). DISPLAY formatting
// only: a bare decimal in the unit interval becomes value*100 to two places with a percent sign;
// anything carrying a unit ("410 points", "$500", "+.034 win pct") or outside the ratio range is
// returned verbatim. The stored valueText and the Provenance view are untouched (founder ruling).
export function formatMarkValue(valueText: string): string {
  const t = valueText.trim();
  if (!/^\d*\.\d+$/.test(t)) return valueText;
  const v = parseFloat(t);
  if (!Number.isFinite(v) || v < 0 || v > 1) return valueText;
  return `${(v * 100).toFixed(2)}%`;
}

// ── D-PLINTH: the League Trophy plinth model ──
export type PlinthModel = {
  reigningName: string | null; // newest champion's era-correct name; null = honest gap
  reigningSeason: number | null;
  roll: ChampionEntry[]; // every name the trophy has accumulated, newest-first
};

// champions is the shipped newest-first champion roll. No champions -> null (blank, not guessed).
export function buildPlinth(champions: ChampionEntry[]): PlinthModel | null {
  if (champions.length === 0) return null;
  const newest = champions[0];
  return { reigningName: newest.eraName, reigningSeason: newest.season, roll: champions };
}

// ── D-PLINTH negative: the Championship case holds the Belt and the Ring — NEVER the League
// Trophy (communal perpetual, plinth-only). Both are name-only objects (isHeld=false, D-C).
export function championshipCaseObjects(
  pkg: Pick<ChampionshipPackage, "belt" | "champions">,
): HallObject[] {
  const newest = pkg.champions[0] ?? null;
  const nameOnly = { coHolders: 0, art: { mode: "text", src: null } as const, isHeld: false, category: "The Championship" };
  return [
    {
      key: TROPHY_BELT_ID,
      title: "The Belt",
      winnerName: pkg.belt.currentHolderName,
      season: pkg.belt.currentSeason,
      ...nameOnly,
    },
    {
      key: TROPHY_RING_KEY,
      title: "The Ring",
      winnerName: newest?.eraName ?? null,
      season: newest?.season ?? null,
      ...nameOnly,
    },
  ];
}

// ── placard honesty ──
// The brass-placard line: holder, season, and the co-held truth ("shared +N" is a fact,
// never a score). No holder -> "unclaimed", never a guess.
export function placardLine(
  o: Pick<HallObject, "winnerName" | "season" | "coHolders">,
): string {
  if (o.winnerName == null) return "unclaimed";
  const season = o.season != null ? ` · ${o.season}` : "";
  const shared = o.coHolders > 0 ? ` · shared +${o.coHolders}` : "";
  return `${o.winnerName}${season}${shared}`;
}

// Honest truncation for long era-correct names: visible ellipsis, prefix preserved verbatim,
// never a rewrite. The full name always lives in the detail view.
export function truncatePlacard(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

// ── D-LOWER: static descriptive category notes — nature, never quantity (numeral-free per
// G2 ruling 1). A category may be omitted; the panel renders blank (the ratified fallback).
export const CATEGORY_NOTES: Record<string, string> = {
  "Annual Awards": "Awards for the season's superlatives, given each year.",
  "Live Records": "Traveling marks, held only until someone takes them.",
  "Permanent Records": "Marks set once and kept forever.",
  "Positional Records": "The finest single seasons ever posted at each position.",
  "Auction & Acquisition": "Records of the draft room and the auction table.",
  "The Championship": "The league title, and the hardware that travels with it.",
};
