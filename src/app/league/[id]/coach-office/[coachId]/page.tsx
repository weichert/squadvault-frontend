// src/app/league/[id]/coach-office/[coachId]/page.tsx
// Coach Office - Phase 1 static interactive shell.
//   Spec package: docs/coach_office/final_spec_package_v1/
//   Brief: _observations/session_brief_2026_06_30_coach_office_phase1_static_shell.md
//
// Phase 1 renders a NEUTRAL PLACEHOLDER scene with manifest-driven hotspots and
// placeholder modals. No personalization, no trophy/ring/media/board/egg/cutout
// data, no visitor filtering, no artwork, no nav integration. coachId is echoed
// as a placeholder identifier only - it is NOT resolved to franchise data in this
// phase. The only DB call is getLeague (existence + name), matching the
// force-dynamic Server Component pattern used across league surfaces.
import { getLeague } from "@/lib/league";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { COACH_OFFICE_HOTSPOTS_V1 } from "@/lib/coach-office/hotspots";
import { OfficeShell } from "@/components/coach-office/office-shell";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; coachId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, coachId } = await params;
  return { title: `Coach Office - ${coachId} - ${id}` };
}

export default async function CoachOfficePage({ params }: Props) {
  const { id, coachId } = await params;

  const league = await getLeague(id);
  if (!league) notFound();

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header - Cormorant display title + gold rule, matching sibling surfaces. */}
        <div className="mb-8">
          <h1
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: "2.2rem", letterSpacing: "0.03em" }}
          >
            Coach Office
          </h1>
          <div
            className="mt-3"
            style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }}
          />
          {/* Placeholder identifier only (Phase 1 does not resolve coachId to data). */}
          <p className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 mt-4">
            {coachId}
          </p>
        </div>

        <OfficeShell map={COACH_OFFICE_HOTSPOTS_V1} />
      </div>
    </main>
  );
}
