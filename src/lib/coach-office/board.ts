// src/lib/coach-office/board.ts
// Coach Office Board Message resolver + CO-R1/CO-R2 pipeline. A board note is MEMBER
// SPEECH (CO-R3): the office owner's current note, attributed to its author.
//
// v1 status (verified 2026-07-05): there is NO landed board-note canonical source (no
// table, no migration; the generated Database types carry none). Per no-invention this
// reader therefore returns null - an HONEST blank board on every office - and invents
// nothing. When a canonical board-note source lands (its own future unit, with its own
// migration + authoring/consent flow), the read goes in `resolveOfficeBoardNote`; the
// CO-R1 fail-closed gate and CO-R2 narrowing below are already specified and tested, so
// the note plugs in with the constitutional pipeline proven.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { League } from "@/lib/league";
import type { CoachOfficeProfile } from "@/lib/coach-office/profile";
import type { CoachOfficeViewerContext } from "@/lib/coach-office/viewer-context";

type AdminClient = SupabaseClient<Database>;

// One board note as the office presents it. `authorUserId` is who to consent-check
// (CO-R1); `authorName` is the resolved display name, present only alongside a note
// that has cleared the gate. Nothing here is ever fabricated.
export type BoardNote = {
  body: string;
  authorUserId: string;
  authorName: string | null;
};

// The landed consent category that governs attributed member words ("your words,
// attributed"). The board note's author must hold a CURRENT grant of this for the note
// to render (checked via consent.ts memberHoldsGrant).
export const BOARD_NOTE_CATEGORY = "attributed_quotes" as const;

// The blank-board line. UI chrome, not a league fact - no baked league/coach/team/joke
// content (CO-R4). All real board text is the member's own note, supplied at runtime.
export const BOARD_EMPTY_TEXT = "The board is clear.";

// CO-R1 fail-closed gate (pure). A note renders ONLY when it EXISTS and its author holds
// a current attributed_quotes grant. Absent note -> null; absent/false consent -> null;
// regardless of any spec or visibility flag. Consent is the outer gate and it wins.
export function gateBoardNote(
  note: BoardNote | null,
  authorHasGrant: boolean,
): BoardNote | null {
  if (!note) return null;
  if (!authorHasGrant) return null;
  return note;
}

// CO-R2 narrowing (pure). Relationship-aware rendering only ever SELECTS A SUBSET of the
// consent-cleared owner set; it never adds or invents. Starting from the already
// CO-R1-gated note, this returns that note or null - never a fabricated note, and never
// content the gate withheld. v1 carries no per-viewer visibility field on a note, so a
// gated note is part of the owner-approved public office for every viewer class; the
// seam takes the viewer so future per-relationship visibility narrows HERE with no
// change to callers.
export function narrowBoardForViewer(
  gated: BoardNote | null,
  _viewer: CoachOfficeViewerContext,
): BoardNote | null {
  return gated;
}

// Pure display seam (node-testable, CO-R4). What the board shows for a given note: a
// null note yields the blank-board line; a present note yields its VERBATIM body plus
// optional attribution. Text is entirely data-driven - nothing is transformed or baked.
export function boardDisplay(note: BoardNote | null): {
  body: string;
  attribution: string | null;
  isEmpty: boolean;
} {
  if (!note) return { body: BOARD_EMPTY_TEXT, attribution: null, isEmpty: true };
  return { body: note.body, attribution: note.authorName, isEmpty: false };
}

// Resolve the office owner's CURRENT board note from the canonical record. v1: no
// canonical board-note source exists in the schema, so this returns null (blank board)
// deterministically and invents nothing. Kept as the single seam where a future landed
// source is read - the caller then runs gateBoardNote (CO-R1) and narrowBoardForViewer
// (CO-R2) over the result.
export async function resolveOfficeBoardNote(
  _admin: AdminClient,
  _league: League,
  _profile: CoachOfficeProfile,
  _viewer: CoachOfficeViewerContext,
): Promise<BoardNote | null> {
  return null;
}
