// src/app/league/[id]/archive/page.tsx
// Archive index — lists every surface with its current count.
// Public (no auth required); uses admin client server-side per established pattern.
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

// Server Component reading live Supabase state. Skip Next.js route segment
// caching so synced artifacts surface without a hard reload. See
// _observations/OBSERVATIONS_2026_05_28_LEAGUE_PAGES_FORCE_DYNAMIC.md in the
// engine repo for the full rationale.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Archive · ${id}` };
}

type LeagueRow = { id: string; name: string };

// One row per surface card. Surfaces with `href: null` show count but no link
// (e.g. F1 — Section 7 of Milestone 3 brief defers the chronicle surface).
type SurfaceCard = {
  artifactClass: "E1" | "A1" | "A2" | "A3" | "F1";
  title: string;
  description: string;
  href: string | null;
  emptyDetail: string;
};

const SURFACES: ReadonlyArray<SurfaceCard> = [
  {
    artifactClass: "E1",
    title: "Weekly Recaps",
    description: "The week-by-week record of every regular and post-season slate.",
    href: "recaps",
    emptyDetail: "The record opens with the first approved recap.",
  },
  {
    artifactClass: "A1",
    title: "Hall of Fame & Shame",
    description: "Champions, worst-record seasons, and the largest blowouts in league history.",
    href: "records",
    emptyDetail: "Awaiting first entry.",
  },
  {
    artifactClass: "A2",
    title: "Draft History Vault",
    description: "Bargains, busts, and the most expensive draft-day decisions.",
    href: "records",
    emptyDetail: "Awaiting first entry.",
  },
  {
    artifactClass: "A3",
    title: "Championship Timeline",
    description: "Playoff brackets, cross-season records, and the bridesmaid leaderboard.",
    href: "records",
    emptyDetail: "Awaiting first entry.",
  },
  {
    artifactClass: "F1",
    title: "Rivalry Chronicle",
    description: "Head-to-head histories between rival franchises.",
    href: null, // surface under construction this milestone
    emptyDetail: "Surface in preparation.",
  },
] as const;

async function fetchCountForClass(
  admin: ReturnType<typeof createAdminClient>,
  leagueUuid: string,
  artifactClass: string,
): Promise<number> {
  const { count, error } = await admin
    .from("artifacts")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueUuid)
    .eq("artifact_class", artifactClass)
    .eq("approval_state", "APPROVED")
    .eq("is_demo", false);
  if (error) return 0;
  return count ?? 0;
}

export default async function ArchiveIndexPage({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: leagueData } = await admin
    .from("leagues")
    .select("id, name")
    .eq("canonical_id", id)
    .maybeSingle() as { data: LeagueRow | null };

  if (!leagueData) notFound();
  const league = leagueData;

  const counts = await Promise.all(
    SURFACES.map((s) => fetchCountForClass(admin, league.id, s.artifactClass)),
  );
  const totalApproved = counts.reduce((a, b) => a + b, 0);

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-12">
          <Link
            href={`/league/${id}`}
            className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 hover:text-vault-text2 transition-colors"
          >
            ← {league.name}
          </Link>
          <h1
            className="font-ceremonial font-light text-vault-text mt-3"
            style={{ fontSize: "2.2rem", letterSpacing: "0.03em" }}
          >
            The Archive
          </h1>
          <div className="mt-3" style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }} />
          <p className="font-ui text-sm text-vault-text2 mt-4 max-w-2xl leading-relaxed">
            The permanent record of {league.name}. Every entry below has been entered into the record by
            the commissioner.
          </p>
        </div>

        {/* Page-level empty state, when nothing is approved anywhere yet */}
        {totalApproved === 0 ? (
          <div className="vault-card text-center py-16">
            <p
              className="font-ceremonial font-light text-vault-text2 italic"
              style={{ fontSize: "1.25rem" }}
            >
              The archive begins with the first approved artifact.
            </p>
            <p className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 mt-4">
              NOTHING ENTERED INTO THE RECORD YET
            </p>
          </div>
        ) : (
          <section>
            <p className="font-mono text-[9px] tracking-[0.15em] text-vault-text3 mb-6">
              SURFACES
            </p>
            <div className="space-y-3">
              {SURFACES.map((surface, i) => {
                const count = counts[i];
                const isLive = surface.href !== null;
                const cardContent = (
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className="font-mono text-[9px] tracking-[0.12em] px-2 py-0.5 rounded-sm"
                          style={{
                            background: "rgba(74, 124, 89, 0.1)",
                            color: "#4A7C59",
                            border: "1px solid rgba(74,124,89,0.6)",
                          }}
                        >
                          {surface.artifactClass}
                        </span>
                        <span className="font-mono text-[9px] tracking-[0.1em] text-vault-text3">
                          {count} {count === 1 ? "ENTRY" : "ENTRIES"}
                        </span>
                      </div>
                      <p
                        className={`font-ceremonial font-light text-vault-text ${
                          isLive ? "group-hover:text-vault-gold-dim transition-colors" : ""
                        }`}
                        style={{ fontSize: "1.35rem", letterSpacing: "0.01em" }}
                      >
                        {surface.title}
                      </p>
                      <p className="font-ui text-sm text-vault-text2 mt-1.5 leading-relaxed">
                        {surface.description}
                      </p>
                      {count === 0 && (
                        <p className="font-mono text-[9px] tracking-[0.1em] text-vault-text3 mt-2 italic">
                          {surface.emptyDetail}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 self-center">
                      {isLive ? (
                        <span
                          className="font-mono text-[9px] tracking-[0.12em] text-vault-text3"
                          aria-hidden
                        >
                          →
                        </span>
                      ) : (
                        <span className="font-mono text-[9px] tracking-[0.1em] text-vault-text3">
                          IN PREP
                        </span>
                      )}
                    </div>
                  </div>
                );

                return isLive ? (
                  <Link
                    key={surface.artifactClass}
                    href={`/league/${id}/archive/${surface.href}`}
                    className="block vault-card hover:border-vault-gold-dim transition-colors group"
                    style={{ textDecoration: "none" }}
                  >
                    {cardContent}
                  </Link>
                ) : (
                  <div
                    key={surface.artifactClass}
                    className="vault-card"
                    style={{ opacity: 0.7 }}
                  >
                    {cardContent}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
