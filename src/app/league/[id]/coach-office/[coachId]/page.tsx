// src/app/league/[id]/coach-office/[coachId]/page.tsx
// Coach Office - Phase 2 (owner personalization).
//   Spec package: docs/coach_office/final_spec_package_v1/
//   Brief: _observations/session_brief_2026_06_30_coach_office_phase2_owner_personalization.md
//
// Renders the coach's real nameplate/team (derived from the franchises row, D-2 -
// no coach_office_profiles table) and wires the Trophy Case + Ring Box hotspots to
// content DERIVED off the league championship record (lib/trophy-room.ts), filtered
// to this coach. Board, Framed Photos, and Cardboard Cutout stay placeholders (later
// phases). Reads only; nothing invented; coachId (canonical_franchise_id) is resolved
// from data, never hard-coded. Base scene remains the D-4 placeholder.
import { getLeague, getViewer } from "@/lib/league";
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { COACH_OFFICE_HOTSPOTS_V1 } from "@/lib/coach-office/hotspots";
import { resolveCoachOfficeProfile } from "@/lib/coach-office/profile";
import {
  resolveCoachChampionships,
  resolveCoachHeldRecords,
} from "@/lib/coach-office/resolvers";
import { resolveCoachOfficeViewerContext } from "@/lib/coach-office/viewer-context";
import { OfficeShell } from "@/components/coach-office/office-shell";
import { TrophyCaseView } from "@/components/coach-office/trophy-case-view";
import { RingBoxView } from "@/components/coach-office/ring-box-view";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; coachId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Coach Office - ${id}` };
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

  // The coach's championships (derived, era-correct, never invented) power both the
  // Ring Box (rings) and the Trophy Case (trophies). Phase 2b adds the traveling/annual/
  // permanent records the coach currently holds to the Trophy Case.
  const [championships, heldRecords] = await Promise.all([
    resolveCoachChampionships(admin, league, profile.franchiseUuid),
    resolveCoachHeldRecords(admin, league, profile.franchiseUuid),
  ]);

  // Phase 3: resolve the viewer's relationship to this office (OWNER / COMMISSIONER /
  // LEAGUE_MATE / PUBLIC_OR_UNKNOWN). The context is threaded into the shell for future
  // phases ONLY - nothing below branches on it, and no content is filtered by it yet.
  const viewer = await getViewer(id);
  const viewerContext = await resolveCoachOfficeViewerContext(
    admin,
    league,
    viewer,
    profile,
  );

  // Content map keyed by hotspot_id. Only the owner-personalized hotspots get a body;
  // the rest fall back to the placeholder modal.
  const content = {
    trophy_case: (
      <TrophyCaseView championships={championships} heldRecords={heldRecords} />
    ),
    championship_ring_box: <RingBoxView rings={championships} />,
  };

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header - Cormorant display title + gold rule; real team nameplate. */}
        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-[0.15em] text-vault-text3">
            COACH OFFICE
          </p>
          <h1
            className="font-ceremonial font-light text-vault-text mt-2"
            style={{ fontSize: "2.2rem", letterSpacing: "0.03em" }}
          >
            {profile.teamName}
          </h1>
          <div
            className="mt-3"
            style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }}
          />
        </div>

        <OfficeShell
          map={COACH_OFFICE_HOTSPOTS_V1}
          content={content}
          viewerContext={viewerContext}
        />
      </div>
    </main>
  );
}
