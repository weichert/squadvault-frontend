// src/lib/coach-office/board.test.ts
// G2 obligations T3.* (board resolver populated + empty), T4.* (CO-R2 narrowing), and
// T6.4 (board display seam is data-driven). Pure functions + stubbed I/O; node env.
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { League } from "@/lib/league";
import type { CoachOfficeProfile } from "@/lib/coach-office/profile";
import type {
  CoachOfficeRelationship,
  CoachOfficeViewerContext,
} from "@/lib/coach-office/viewer-context";
import {
  resolveOfficeBoardNote,
  gateBoardNote,
  narrowBoardForViewer,
  boardDisplay,
  BOARD_EMPTY_TEXT,
  type BoardNote,
} from "@/lib/coach-office/board";

const NOTE: BoardNote = {
  body: "Team meeting moved to Thursday.",
  authorUserId: "author-uuid",
  authorName: "The Owner",
};

const ALL_RELATIONSHIPS: CoachOfficeRelationship[] = [
  "OWNER",
  "COMMISSIONER",
  "LEAGUE_MATE",
  "PUBLIC_OR_UNKNOWN",
];

function makeViewer(relationship: CoachOfficeRelationship): CoachOfficeViewerContext {
  return {
    viewerUserId: relationship === "PUBLIC_OR_UNKNOWN" ? null : "viewer-uuid",
    viewerCoachId: relationship === "OWNER" ? "office-coach" : "other-coach",
    officeCoachId: "office-coach",
    relationship,
    canViewPublicOffice: true,
    canViewOwnerOnlySurface: relationship === "OWNER",
    canViewRelationshipSurface: relationship !== "PUBLIC_OR_UNKNOWN",
  };
}

const dummyAdmin = {} as unknown as SupabaseClient<Database>;
const dummyLeague = { id: "league-uuid" } as unknown as League;
const dummyProfile = {
  coachId: "office-coach",
  franchiseUuid: "fr-uuid",
  teamName: "The Owner",
  hotspotMapId: "coach_office_hotspots_v1",
} as CoachOfficeProfile;

describe("resolveOfficeBoardNote — empty-by-default, no invention (T3.1, T3.2, T3.3)", () => {
  it("returns null with no landed source -> blank board (T3.1)", async () => {
    const viewer = makeViewer("OWNER");
    const note = await resolveOfficeBoardNote(dummyAdmin, dummyLeague, dummyProfile, viewer);
    expect(note).toBeNull();
  });

  it("is deterministic: identical inputs -> identical output (T3.2)", async () => {
    const viewer = makeViewer("LEAGUE_MATE");
    const a = await resolveOfficeBoardNote(dummyAdmin, dummyLeague, dummyProfile, viewer);
    const b = await resolveOfficeBoardNote(dummyAdmin, dummyLeague, dummyProfile, viewer);
    expect(a).toEqual(b);
    expect(a).toBeNull();
  });

  it("never fabricates a note (T3.3)", async () => {
    // Across every viewer class, the reader invents nothing from the absent source.
    for (const r of ALL_RELATIONSHIPS) {
      const note = await resolveOfficeBoardNote(
        dummyAdmin,
        dummyLeague,
        dummyProfile,
        makeViewer(r),
      );
      expect(note).toBeNull();
    }
  });
});

describe("gateBoardNote — CO-R1 fail-closed (T2 populated path support)", () => {
  it("note present + author grant -> note", () => {
    expect(gateBoardNote(NOTE, true)).toEqual(NOTE);
  });
  it("note present + NO grant -> null (fail-closed, regardless of any flag)", () => {
    expect(gateBoardNote(NOTE, false)).toBeNull();
  });
  it("no note + grant -> null (nothing to show, no invention)", () => {
    expect(gateBoardNote(null, true)).toBeNull();
  });
});

describe("narrowBoardForViewer — CO-R2 only ever narrows (T4.1, T4.2, T4.3)", () => {
  it("rendered board is a subset of the gated set for every relationship (T4.1)", () => {
    // A subset: the result is either the exact gated note or null — never a different or
    // fabricated note.
    for (const r of ALL_RELATIONSHIPS) {
      const gatedIn = gateBoardNote(NOTE, true);
      const out = narrowBoardForViewer(gatedIn, makeViewer(r));
      expect(out === null || out === gatedIn).toBe(true);
    }
  });

  it("anonymous visitor + gate closed -> null (T4.2)", () => {
    const gatedIn = gateBoardNote(NOTE, false); // author has no grant
    expect(narrowBoardForViewer(gatedIn, makeViewer("PUBLIC_OR_UNKNOWN"))).toBeNull();
  });

  it("no (viewer, grant) combination yields content when the gate is closed (T4.3)", () => {
    for (const r of ALL_RELATIONSHIPS) {
      const closed = gateBoardNote(NOTE, false);
      expect(narrowBoardForViewer(closed, makeViewer(r))).toBeNull();
      const noNote = gateBoardNote(null, true);
      expect(narrowBoardForViewer(noNote, makeViewer(r))).toBeNull();
    }
  });
});

describe("boardDisplay — data-driven text, no baking (T6.4)", () => {
  it("null note -> the blank-board empty state", () => {
    const d = boardDisplay(null);
    expect(d.isEmpty).toBe(true);
    expect(d.body).toBe(BOARD_EMPTY_TEXT);
    expect(d.attribution).toBeNull();
  });
  it("present note -> verbatim body + attribution (nothing transformed)", () => {
    const d = boardDisplay(NOTE);
    expect(d.isEmpty).toBe(false);
    expect(d.body).toBe(NOTE.body);
    expect(d.attribution).toBe(NOTE.authorName);
  });
});
