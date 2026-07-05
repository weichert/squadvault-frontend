// src/app/league/[id]/coach-office/[coachId]/page.tsx
// Coach Office Room v1 (shell + resolvers).
//   Spec package: docs/coach_office/final_spec_package_v1/
//   Governing law: docs/coach_office/RATIFICATION_MEMO_2026_07_04.md (CO-R1..R4)
//   Brief: _observations/session_brief_coach_office_room_v1.md
//
// Instantiates the room-agnostic W.2 RoomScene (shipped b63e8da; reused, not forked -
// extended room-agnostically with `detail` wiring) over the interim Tahoe hero, driven
// by public/coach-office/hotspots.json. Three hotspots open resolver-driven modals:
//   - trophy_case  -> TrophyCaseView   (CONSUMED CO.2 resolvers; public league facts)
//   - ring_box     -> RingBoxView      (CONSUMED CO.2 resolvers; public league facts)
//   - board        -> BoardMessageView (NEW; member speech, CO-R1 fail-closed)
// The nameplate is the owner's public display name as a runtime overlay (D-4a, CO-R4).
// Reads only; nothing invented; coachId (canonical_franchise_id) resolved from data.
// framed_photos + cutout are v2 (D-2, out of scope). Zero engine changes.
import { getLeague, getViewer } from "@/lib/league";
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { promises as fs } from "fs";
import path from "path";
import type { RoomManifest } from "@/lib/room/types";
import { RoomScene } from "@/components/room/room-scene";
import { resolveCoachOfficeProfile, nameplateText } from "@/lib/coach-office/profile";
import {
  resolveCoachChampionships,
  resolveCoachHeldRecords,
} from "@/lib/coach-office/resolvers";
import { resolveCoachOfficeViewerContext } from "@/lib/coach-office/viewer-context";
import {
  resolveOfficeBoardNote,
  gateBoardNote,
  narrowBoardForViewer,
  BOARD_NOTE_CATEGORY,
} from "@/lib/coach-office/board";
import { memberHoldsGrant } from "@/lib/coach-office/consent";
import { TrophyCaseView } from "@/components/coach-office/trophy-case-view";
import { RingBoxView } from "@/components/coach-office/ring-box-view";
import { BoardMessageView } from "@/components/coach-office/board-message-view";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; coachId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Coach Office - ${id}` };
}

// Hotspot geometry is the manifest's job, not the component's. Read it at request time
// and hand the parsed shape to the room-agnostic scene (mirrors the Clubhouse page).
async function loadOfficeManifest(): Promise<RoomManifest> {
  const p = path.join(process.cwd(), "public", "coach-office", "hotspots.json");
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw) as RoomManifest;
}

export default async function CoachOfficePage({ params }: Props) {
  const { id, coachId } = await params;

  const league = await getLeague(id);
  if (!league) notFound();

  const admin = createAdminClient();

  // Derive the office owner from the franchises row (D-2). No matching franchise ->
  // honest 404 rather than an invented office.
  const profile = await resolveCoachOfficeProfile(admin, league, coachId);
  if (!profile) notFound();

  // The coach's championships (derived, era-correct, never invented) power both the Ring
  // Box (rings) and the Trophy Case (trophies + the traveling/annual/permanent records
  // they currently hold). These are the owner's OWN public league facts (already public
  // in the Trophy Room) - no likeness/voice/attributed-words, so no consent gate.
  const [championships, heldRecords, manifest, viewer] = await Promise.all([
    resolveCoachChampionships(admin, league, profile.franchiseUuid),
    resolveCoachHeldRecords(admin, league, profile.franchiseUuid),
    loadOfficeManifest(),
    getViewer(id),
  ]);

  // Relationship of this viewer to the office (OWNER / COMMISSIONER / LEAGUE_MATE /
  // PUBLIC_OR_UNKNOWN) - CONSUMED from CO.3, never rebuilt. Drives CO-R2 narrowing.
  const viewerContext = await resolveCoachOfficeViewerContext(
    admin,
    league,
    viewer,
    profile,
  );

  // Board note pipeline: canonical read (empty in v1 - no landed source) -> CO-R1
  // fail-closed gate on the author's attributed_quotes grant -> CO-R2 narrowing per
  // viewer. The full constitutional pipeline is LIVE; v1 has no board data so the board
  // is honestly blank on every office, inventing nothing.
  const rawNote = await resolveOfficeBoardNote(admin, league, profile, viewerContext);
  const authorHasGrant = rawNote
    ? await memberHoldsGrant(admin, league.id, rawNote.authorUserId, BOARD_NOTE_CATEGORY)
    : false;
  const boardNote = narrowBoardForViewer(
    gateBoardNote(rawNote, authorHasGrant),
    viewerContext,
  );

  // Content nodes keyed by each `detail` hotspot's contentKey (manifest: trophy_case /
  // board / ring_box). The room is agnostic to what these are; it renders the clicked one.
  const content = {
    trophy_case: (
      <TrophyCaseView championships={championships} heldRecords={heldRecords} />
    ),
    ring_box: <RingBoxView rings={championships} />,
    board: <BoardMessageView note={boardNote} />,
  };

  return (
    <div style={{ position: "relative" }}>
      <RoomScene
        masterSrc="/coach-office/co_master_web.webp"
        masterAlt={`${profile.teamName} - coach office`}
        manifest={manifest}
        params={{ id, coachId }}
        content={content}
      />

      {/* Nameplate: runtime data overlay (CO-R4), the owner's public display name
          (D-4a - no consent gate). Interim placement top-left over a subtle scrim for
          legibility; a desk-plaque overlay lands with the clean CO-hero. Non-interactive
          so it never blocks a hotspot. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          padding: "1.25rem 1.5rem 2.5rem",
          zIndex: 50,
          pointerEvents: "none",
          background:
            "linear-gradient(135deg, rgba(20,16,12,0.72) 0%, rgba(20,16,12,0.32) 60%, rgba(20,16,12,0) 100%)",
        }}
      >
        <p className="font-mono text-[9px] tracking-[0.15em] text-vault-text3">
          COACH OFFICE
        </p>
        <h1
          className="font-ceremonial font-light text-vault-text mt-1"
          style={{ fontSize: "2rem", letterSpacing: "0.03em" }}
        >
          {nameplateText(profile.teamName)}
        </h1>
        <div
          className="mt-3"
          style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.5)" }}
        />
      </div>
    </div>
  );
}
