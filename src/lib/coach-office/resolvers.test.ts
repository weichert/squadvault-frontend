// src/lib/coach-office/resolvers.test.ts
// G2 obligations T5.* — no-invention + determinism on the CONSUMED (CO.2-shipped)
// trophy/ring resolvers. The trophy-room read-model loaders are mocked (vi.mock) so the
// pure filtering is asserted without a DB and WITHOUT changing shipped source. Node env.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { League } from "@/lib/league";

vi.mock("@/lib/trophy-room", () => ({
  loadChampionshipPackage: vi.fn(),
  loadLiveRecords: vi.fn(),
  loadSeasonAwards: vi.fn(),
}));

import {
  loadChampionshipPackage,
  loadLiveRecords,
  loadSeasonAwards,
} from "@/lib/trophy-room";
import {
  resolveCoachChampionships,
  resolveCoachHeldRecords,
} from "@/lib/coach-office/resolvers";

const admin = {} as unknown as SupabaseClient<Database>;
const league = { id: "league-uuid" } as unknown as League;
const A = "franchise-A";
const B = "franchise-B";
const ABSENT = "franchise-Z";

type PkgReturn = Awaited<ReturnType<typeof loadChampionshipPackage>>;
type LiveReturn = Awaited<ReturnType<typeof loadLiveRecords>>;
type AwardsReturn = Awaited<ReturnType<typeof loadSeasonAwards>>;

const SOURCE_CHAMPIONS = [
  { franchiseId: A, season: 2011, title: "Title 2011", eraName: "Old Name" },
  { franchiseId: A, season: 2019, title: "Title 2019", eraName: "New Name" },
  { franchiseId: B, season: 2015, title: "Title 2015", eraName: "B Name" },
];

beforeEach(() => {
  vi.mocked(loadChampionshipPackage).mockResolvedValue({
    champions: SOURCE_CHAMPIONS,
  } as unknown as PkgReturn);
  vi.mocked(loadLiveRecords).mockResolvedValue({
    records: [
      { trophyName: "Longest Streak", qualification: "q", valueText: "v", holders: [{ franchiseId: A }] },
      { trophyName: "Not Held", qualification: "q", valueText: "v", holders: [{ franchiseId: B }] },
    ],
  } as unknown as LiveReturn);
  vi.mocked(loadSeasonAwards).mockResolvedValue({
    annual: [],
    permanentCards: [],
  } as unknown as AwardsReturn);
});

describe("resolveCoachChampionships — no invention (T5.1, T5.2, T5.3)", () => {
  it("a coach with zero titles -> [] (T5.1 empty state, not filler)", async () => {
    const out = await resolveCoachChampionships(admin, league, ABSENT);
    expect(out).toEqual([]);
  });

  it("output is a strict subset of the source, filtered to the franchise (T5.2)", async () => {
    const out = await resolveCoachChampionships(admin, league, A);
    // Only A's two titles, never B's, never a fabricated season/title.
    expect(out.map((c) => c.season).sort()).toEqual([2011, 2019]);
    const sourceSeasonsForA = SOURCE_CHAMPIONS.filter((c) => c.franchiseId === A).map((c) => c.season);
    for (const c of out) {
      expect(sourceSeasonsForA).toContain(c.season);
      // title + era-name come verbatim from the source, never invented.
      const src = SOURCE_CHAMPIONS.find((s) => s.franchiseId === A && s.season === c.season)!;
      expect(c.title).toBe(src.title);
      expect(c.teamName).toBe(src.eraName);
    }
  });

  it("is deterministic: identical inputs -> identical output (T5.3)", async () => {
    const a = await resolveCoachChampionships(admin, league, A);
    const b = await resolveCoachChampionships(admin, league, A);
    expect(a).toEqual(b);
  });
});

describe("resolveCoachHeldRecords — no invented records (T5.4)", () => {
  it("a franchise that holds none -> [] ", async () => {
    const out = await resolveCoachHeldRecords(admin, league, ABSENT);
    expect(out).toEqual([]);
  });

  it("returns only records this franchise currently holds", async () => {
    const out = await resolveCoachHeldRecords(admin, league, A);
    expect(out.map((r) => r.trophyName)).toEqual(["Longest Streak"]);
  });
});
