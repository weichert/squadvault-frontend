// src/app/league/[id]/archive/recaps/page.tsx
// Weekly recap archive — every APPROVED WEEKLY_RECAP, grouped by season descending.
// Public; uses admin client server-side.
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
  return { title: `Weekly Recaps · ${id}` };
}

type LeagueRow = { id: string; name: string };

type RecapRow = {
  id: string;
  season: number | null;
  week_index: number | null;
  current_version: number;
  docket_id: string | null;
  approved_at: string | null;
};

function formatApprovedDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default async function RecapArchivePage({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: leagueData } = await admin
    .from("leagues")
    .select("id, name")
    .eq("canonical_id", id)
    .maybeSingle() as { data: LeagueRow | null };
  if (!leagueData) notFound();
  const league = leagueData;

  const { data: recapsData } = await admin
    .from("artifacts")
    .select("id, season, week_index, current_version, docket_id, approved_at")
    .eq("league_id", league.id)
    .eq("artifact_type", "WEEKLY_RECAP")
    .eq("approval_state", "APPROVED")
    .eq("is_demo", false)
    .order("season", { ascending: false })
    .order("week_index", { ascending: false }) as { data: RecapRow[] | null };

  const recaps = recapsData ?? [];

  // Group by season — natural reading affordance and avoids a flat 200-row list.
  const bySeason = new Map<number, RecapRow[]>();
  for (const r of recaps) {
    if (r.season == null) continue;
    if (!bySeason.has(r.season)) bySeason.set(r.season, []);
    bySeason.get(r.season)!.push(r);
  }
  const seasonsDesc = Array.from(bySeason.keys()).sort((a, b) => b - a);

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-12">
          <Link
            href={`/league/${id}/archive`}
            className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 hover:text-vault-text2 transition-colors"
          >
            ← The Archive
          </Link>
          <h1
            className="font-ceremonial font-light text-vault-text mt-3"
            style={{ fontSize: "2.2rem", letterSpacing: "0.03em" }}
          >
            Weekly Recaps
          </h1>
          <div className="mt-3" style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }} />
          <p className="font-ui text-sm text-vault-text2 mt-4 max-w-2xl leading-relaxed">
            Every approved weekly recap, season by season. Each is entered into the record by the
            commissioner before publication.
          </p>
        </div>

        {recaps.length === 0 ? (
          <div className="vault-card text-center py-16">
            <p
              className="font-ceremonial font-light text-vault-text2 italic"
              style={{ fontSize: "1.2rem" }}
            >
              The record opens with the first approved recap.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {seasonsDesc.map((season) => {
              const seasonRecaps = bySeason.get(season)!;
              return (
                <section key={season}>
                  <div className="flex items-baseline justify-between mb-4">
                    <h2
                      className="font-ceremonial font-light text-vault-text"
                      style={{ fontSize: "1.45rem", letterSpacing: "0.02em" }}
                    >
                      {season}
                    </h2>
                    <span className="font-mono text-[9px] tracking-[0.12em] text-vault-text3">
                      {seasonRecaps.length} {seasonRecaps.length === 1 ? "ENTRY" : "ENTRIES"}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {seasonRecaps.map((recap) => {
                      const approvedDate = formatApprovedDate(recap.approved_at);
                      return (
                        <Link
                          key={recap.id}
                          href={`/league/${id}/archive/recaps/${recap.id}`}
                          className="block vault-card hover:border-vault-gold-dim transition-colors group"
                          style={{ textDecoration: "none" }}
                        >
                          <div className="flex items-start justify-between gap-4">
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
                                  E1
                                </span>
                                <span className="font-mono text-[9px] tracking-[0.1em] text-vault-text3">
                                  WEEK {recap.week_index?.toString().padStart(2, "0")}
                                </span>
                              </div>
                              <p
                                className="font-ui text-base text-vault-text group-hover:text-vault-gold-dim transition-colors"
                              >
                                Week {recap.week_index}, {recap.season}
                              </p>
                              <p className="font-mono text-[10px] tracking-[0.08em] text-vault-text3 mt-1.5">
                                <span className="text-vault-gold">{recap.docket_id ?? "—"}</span>
                                {approvedDate && (
                                  <>
                                    <span className="text-vault-text3 mx-2">·</span>
                                    <span>Entered: {approvedDate}</span>
                                  </>
                                )}
                                <span className="text-vault-text3 mx-2">·</span>
                                <span>v{recap.current_version}</span>
                              </p>
                            </div>
                            <span
                              className="shrink-0 self-center font-mono text-[9px] tracking-[0.12em] text-vault-text3"
                              aria-hidden
                            >
                              →
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
