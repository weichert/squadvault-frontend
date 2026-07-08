// src/lib/trophy-room/case-view-bands.test.ts
// TROPHY ROOM pivot — Step 2 (tests-first). The pure Case View seam contract (G1 rulings
// D-BANDS / D-PLINTH / D-LOWER, 2026-07-07). Node env, no I/O, no DOM (the hall-cases /
// viewer-holdings idiom). RED until Step 3 lands `case-view-bands.ts`; the contract tests
// activate once the seam exists (the shipped guarded-validation pattern).
//
// The seam this pins (Step 3 target: src/lib/trophy-room/case-view-bands.ts):
//   MARQUEE_BANDS = 5
//   selectMarquee(objects)            -> { marquee, total }  (held-first prefix, <= 5)
//   selectBandSlots(count)            -> number[] (which physical bands to occupy, spread; N1)
//   placeOnBands(marquee)             -> HallObject[][] (5 bands, adaptive spread, <=1 each; N1)
//   formatMarkValue(valueText)        -> percentage for a bare ratio, else verbatim (N4)
//   buildPlinth(champions)            -> { reigningName, reigningSeason, roll } | null
//   championshipCaseObjects(pkg)      -> [Belt, Ring] (never the League Trophy)
//   placardLine(object)               -> honest one-line placard text
//   truncatePlacard(text, max)        -> honest ellipsis, never a rewrite
//   CATEGORY_NOTES (optional)         -> static descriptive copy, never fact-bearing
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { categoryObjects, type HallObject } from "@/lib/trophy-room/hall-cases";

const ROOT = process.cwd();
const SEAM_REL = "src/lib/trophy-room/case-view-bands.ts";
const hasSeam = () => existsSync(path.join(ROOT, SEAM_REL));
// Guarded dynamic import (resolves only when Step 3 lands the file).
const loadSeam = () => import("@/lib/trophy-room/case-view-bands");

// Plain-data fixture: a displayed trophy object (the shipped HallObject shape).
const mk = (key: string, over: Partial<HallObject> = {}): HallObject => ({
  key,
  title: `Trophy ${key}`,
  winnerName: `Franchise ${key}`,
  season: null,
  coHolders: 0,
  art: { mode: "text", src: null },
  isHeld: false,
  category: "Live Records",
  ...over,
});

describe("Step-3 seam exists (tests-first: RED until implemented)", () => {
  it("the pure Case View seam lands by Step 3", () => {
    expect(hasSeam(), `${SEAM_REL} must exist`).toBe(true);
  });
});

describe("D-BANDS marquee — five large, the viewer's held first, nothing hidden", () => {
  it("marquee is min(5, N): never padded, never overflowing", async () => {
    if (!hasSeam()) return;
    const { selectMarquee, MARQUEE_BANDS } = await loadSeam();
    expect(MARQUEE_BANDS).toBe(5);
    const eight = Array.from({ length: 8 }, (_, i) => mk(`d${i}`));
    expect(selectMarquee(eight).marquee).toHaveLength(5);
    expect(selectMarquee(eight.slice(0, 3)).marquee).toHaveLength(3);
    expect(selectMarquee([]).marquee).toHaveLength(0);
  });

  it("held-first, then docket (input) order — stable within each tier, never ranked", async () => {
    if (!hasSeam()) return;
    const { selectMarquee } = await loadSeam();
    const objs = [
      mk("d0"),
      mk("d1"),
      mk("d2", { isHeld: true }),
      mk("d3"),
      mk("d4", { isHeld: true }),
      mk("d5"),
    ];
    const { marquee } = selectMarquee(objs);
    expect(marquee.map((o: HallObject) => o.key)).toEqual(["d2", "d4", "d0", "d1", "d3"]);
  });

  it("NO HIDDEN FACTS: the marquee is a strict prefix of the full record's own ordering — the affordance shows the same truth, complete", async () => {
    if (!hasSeam()) return;
    const { selectMarquee } = await loadSeam();
    const objs = [
      mk("d0"),
      mk("d1", { isHeld: true }),
      mk("d2"),
      mk("d3"),
      mk("d4"),
      mk("d5"),
      mk("d6", { isHeld: true }),
      mk("d7"),
    ];
    const { marquee, total } = selectMarquee(objs);
    // The full-record affordance reuses the SHIPPED category component, whose ordering is
    // categoryObjects (held-first). The marquee must be exactly its first five — same
    // trophies, same order, just the complete set one tap deeper.
    const full = categoryObjects(objs, "Live Records");
    expect(full).toHaveLength(8); // the complete category — every award, none dropped
    expect(marquee).toEqual(full.slice(0, 5));
    // "see all N": the affordance count is the COMPLETE category count.
    expect(total).toBe(8);
  });
});

describe("D-BANDS adaptive placement (N1) — bands follow content, spread with rhythm", () => {
  // Occupied-band indices (non-empty), preserving marquee order.
  const occupied = (bands: HallObject[][]) =>
    bands.map((b, i) => [i, b] as const).filter(([, b]) => b.length > 0);

  it("selectBandSlots spreads K bands evenly over the five physical shelves, centered", async () => {
    if (!hasSeam()) return;
    const { selectBandSlots } = await loadSeam();
    // Two trophies read as two WELL-SPACED bands (never two atop three empties) — the
    // Championship case; five is the identity.
    expect(selectBandSlots(2)).toEqual([1, 3]);
    expect(selectBandSlots(3)).toEqual([0, 2, 4]);
    expect(selectBandSlots(4)).toEqual([0, 1, 3, 4]);
    expect(selectBandSlots(5)).toEqual([0, 1, 2, 3, 4]);
    // Deterministic and in-frame: strictly ascending, each a valid band index.
    for (let k = 2; k <= 5; k++) {
      const s = selectBandSlots(k);
      expect(s).toHaveLength(k);
      for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1]);
      expect(Math.min(...s)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...s)).toBeLessThan(5);
    }
  });

  it("five trophies fill all five bands, top-to-bottom, one each", async () => {
    if (!hasSeam()) return;
    const { selectMarquee, placeOnBands } = await loadSeam();
    const five = Array.from({ length: 5 }, (_, i) => mk(`d${i}`));
    const bands5 = placeOnBands(selectMarquee(five).marquee);
    expect(bands5).toHaveLength(5);
    bands5.forEach((band: HallObject[], i: number) => {
      expect(band, `band ${i} holds exactly one`).toHaveLength(1);
      expect(band[0].key).toBe(`d${i}`);
    });
  });

  it("a short group renders max(N, 2) bands, spread — never clustered against empty shelves", async () => {
    if (!hasSeam()) return;
    const { selectMarquee, placeOnBands } = await loadSeam();
    // Two trophies (the Championship) -> two well-spaced bands, marquee order preserved.
    const two = [mk("a"), mk("b")];
    const bands2 = placeOnBands(selectMarquee(two).marquee);
    expect(bands2).toHaveLength(5);
    expect(occupied(bands2).map(([i]) => i)).toEqual([1, 3]);
    expect(occupied(bands2).map(([, b]) => b[0].key)).toEqual(["a", "b"]);
    // Three -> [0, 2, 4]; still one trophy each, no fact hidden or padded.
    const bands3 = placeOnBands(selectMarquee([mk("a"), mk("b"), mk("c")]).marquee);
    expect(occupied(bands3).map(([i]) => i)).toEqual([0, 2, 4]);
    expect(occupied(bands3).map(([, b]) => b[0].key)).toEqual(["a", "b", "c"]);
    expect(bands3.filter((b: HallObject[]) => b.length > 0)).toHaveLength(3);
  });

  it("never silently drops an object: more than five is a misuse, not a truncation", async () => {
    if (!hasSeam()) return;
    const { placeOnBands } = await loadSeam();
    const six = Array.from({ length: 6 }, (_, i) => mk(`d${i}`));
    expect(() => placeOnBands(six)).toThrow();
  });
});

describe("D-RATIO (N4) — ratio-class marks read as percentages; everything else verbatim", () => {
  it("a bare fraction becomes value*100 to two places with a percent sign", async () => {
    if (!hasSeam()) return;
    const { formatMarkValue } = await loadSeam();
    expect(formatMarkValue("0.8214")).toBe("82.14%"); // the Clairvoyant's accuracy
    expect(formatMarkValue(".734")).toBe("73.40%"); // a winning percentage
    expect(formatMarkValue("1.000")).toBe("100.00%");
    expect(formatMarkValue("0")).toBe("0"); // no decimal point -> not a ratio, untouched
  });

  it("a unit-bearing or out-of-range value is returned verbatim (no misread number)", async () => {
    if (!hasSeam()) return;
    const { formatMarkValue } = await loadSeam();
    expect(formatMarkValue("410 points")).toBe("410 points");
    expect(formatMarkValue("$500")).toBe("$500");
    expect(formatMarkValue("+.034 win pct")).toBe("+.034 win pct");
    expect(formatMarkValue("3.14")).toBe("3.14"); // above the unit interval -> not a ratio
    expect(formatMarkValue("")).toBe("");
  });
});

describe("D-PLINTH — the League Trophy plinth model (communal perpetual)", () => {
  const champions = [
    { season: 2025, franchiseId: "0002", eraName: "Paradis' Playmakers", title: "2025 Champion" },
    { season: 2024, franchiseId: "0005", eraName: "Weichert's Warmongers", title: "2024 Champion" },
    { season: 2023, franchiseId: null, eraName: null, title: "2023 Champion" },
  ];

  it("reigning champion = the newest entry; the detail carries the FULL champion roll, order preserved", async () => {
    if (!hasSeam()) return;
    const { buildPlinth } = await loadSeam();
    const p = buildPlinth(champions);
    expect(p).not.toBeNull();
    expect(p!.reigningName).toBe("Paradis' Playmakers");
    expect(p!.reigningSeason).toBe(2025);
    expect(p!.roll).toHaveLength(3); // every name the trophy has accumulated
    expect(p!.roll.map((c: { season: number }) => c.season)).toEqual([2025, 2024, 2023]);
  });

  it("honest gaps: a null era name stays null (blank, not guessed)", async () => {
    if (!hasSeam()) return;
    const { buildPlinth } = await loadSeam();
    const p = buildPlinth([champions[2]]);
    expect(p!.reigningName).toBeNull();
  });

  it("no champions -> no plinth content (blank, not guessed)", async () => {
    if (!hasSeam()) return;
    const { buildPlinth } = await loadSeam();
    expect(buildPlinth([])).toBeNull();
  });
});

describe("D-PLINTH negative — the Championship case holds Belt + Ring, NEVER the League Trophy", () => {
  it("championshipCaseObjects returns exactly the Belt and the Ring, name-only (D-C), in The Championship", async () => {
    if (!hasSeam()) return;
    const { championshipCaseObjects } = await loadSeam();
    const pkg = {
      belt: { currentHolderName: "Paradis' Playmakers", currentSeason: 2025, transferCount: 2, chain: [] },
      champions: [
        { season: 2025, franchiseId: "0002", eraName: "Paradis' Playmakers", title: "2025 Champion" },
      ],
    };
    const objs = championshipCaseObjects(pkg);
    expect(objs).toHaveLength(2);
    expect(objs.map((o: HallObject) => o.title).join(" ")).toMatch(/belt/i);
    expect(objs.map((o: HallObject) => o.title).join(" ")).toMatch(/ring/i);
    // The League Trophy is the plinth's communal perpetual — never a case shelf object.
    for (const o of objs) {
      expect(o.title, "League Trophy must not enter a case").not.toMatch(/league trophy/i);
      expect(o.isHeld, "name-only objects never light up (D-C)").toBe(false);
      expect(o.category).toBe("The Championship");
    }
  });
});

describe("placard honesty — multi-holder truth + honest truncation", () => {
  it("a co-held record says so on the placard (The Floor co-held renders truthfully)", async () => {
    if (!hasSeam()) return;
    const { placardLine } = await loadSeam();
    const line = placardLine(mk("d30", { winnerName: "Brandon Knows Ball", season: 2025, coHolders: 1 }));
    expect(line).toContain("Brandon Knows Ball");
    expect(line).toContain("2025");
    expect(line).toMatch(/shared \+1/);
  });

  it("a sole holder carries no shared marker; an unclaimed award says 'unclaimed', never a guess", async () => {
    if (!hasSeam()) return;
    const { placardLine } = await loadSeam();
    expect(placardLine(mk("d24", { winnerName: "Italian Cavallini", season: null }))).not.toMatch(/shared/);
    expect(placardLine(mk("dx", { winnerName: null, season: null }))).toBe("unclaimed");
  });

  it("truncation is honest: visible ellipsis, prefix preserved, never a silent rewrite", async () => {
    if (!hasSeam()) return;
    const { truncatePlacard } = await loadSeam();
    const long = "An Extremely Long Era-Correct Franchise Name That Cannot Fit";
    const cut = truncatePlacard(long, 24);
    expect(cut.length).toBeLessThanOrEqual(24);
    expect(cut.endsWith("…"), "truncation must be visible (ellipsis)").toBe(true);
    expect(long.startsWith(cut.slice(0, -1)), "prefix preserved verbatim").toBe(true);
    expect(truncatePlacard("Short Name", 24)).toBe("Short Name");
  });
});

describe("D-LOWER — the category note is descriptive, never fact-bearing", () => {
  it("if CATEGORY_NOTES ships, no note asserts a holder, a count, or a year (counts drift; facts live on placards)", async () => {
    if (!hasSeam()) return;
    const seam = await loadSeam();
    const notes = (seam as Record<string, unknown>).CATEGORY_NOTES as Record<string, string> | undefined;
    if (!notes) return; // blank is the ratified safe fallback
    for (const [cat, note] of Object.entries(notes)) {
      expect(typeof note, `${cat} note is copy`).toBe("string");
      expect(note.trim().length, `${cat} note is not empty (else omit the key)`).toBeGreaterThan(0);
      expect(note, `${cat} note carries a numeral (a count/year would drift)`).not.toMatch(/\d/);
      expect(note, `${cat} note bakes league identity`).not.toMatch(/Phony Football League/);
      expect(note, `${cat} note is one line`).not.toMatch(/\n/);
    }
  });
});
