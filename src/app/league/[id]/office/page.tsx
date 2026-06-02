// src/app/league/[id]/office/page.tsx
// Commissioner Office — approval queue
import { createAdminClient } from "@/lib/supabase/server";
import { getLeague, getViewer } from "@/lib/league";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CommissionerOnly } from "@/components/ui/commissioner-only";

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
  return { title: `Commissioner Office · ${id}` };
}

type QueueItem = {
  id: string;
  artifact_type: string;
  artifact_class: string;
  season: number | null;
  week_index: number | null;
  approval_state: string;
  current_version: number;
  is_demo: boolean;
  updated_at: string;
};

function formatArtifactLabel(item: QueueItem): string {
  if (item.artifact_type === "WEEKLY_RECAP" && item.season && item.week_index) {
    return `Season ${item.season} · Week ${item.week_index}`;
  }
  return item.artifact_type.replace(/_/g, " ");
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function OfficePage({ params }: Props) {
  const { id } = await params;

  // Resolve viewer identity. getViewer is React.cache()'d alongside
  // getLeague, so the auth + commissioner check is a single shared cost
  // across this page and the layout.
  const viewer = await getViewer(id);
  if (!viewer.userId) {
    redirect(`/auth/login?redirect=/league/${id}/office`);
  }

  const league = await getLeague(id);
  if (!league) notFound();
  const admin = createAdminClient();

  // Role check: render Forbidden state for non-commissioners per
  // Design Brief section VIII visibility principle (room visible to all,
  // entry restricted by role). Anon users were redirected to login above.
  if (!viewer.isCommissioner) {
    return (
      <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="mb-10">
            <Link
              href={`/league/${id}`}
              className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 hover:text-vault-text2 transition-colors"
            >
              ← {league.name}
            </Link>
            <h1
              className="font-ui font-medium text-vault-text mt-3"
              style={{ fontSize: "1.5rem" }}
            >
              Commissioner Office
            </h1>
            <div className="mt-2" style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }} />
          </div>
          <CommissionerOnly leagueId={id} leagueName={league.name} />
        </div>
      </main>
    );
  }

  // Fetch approval queue — DRAFT and CHANGES_REQUESTED, ordered by created_at
  const { data: queue } = await admin
    .from("artifacts")
    .select("id, artifact_type, artifact_class, season, week_index, approval_state, current_version, is_demo, updated_at")
    .eq("league_id", league.id)
    .in("approval_state", ["DRAFT", "CHANGES_REQUESTED"])
    .order("updated_at", { ascending: false }) as { data: QueueItem[] | null };

  const items = queue ?? [];

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <Link
            href={`/league/${id}`}
            className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 hover:text-vault-text2 transition-colors"
          >
            ← {league.name}
          </Link>
          <h1
            className="font-ui font-medium text-vault-text mt-3"
            style={{ fontSize: "1.5rem" }}
          >
            Commissioner Office
          </h1>
          <div className="mt-2" style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }} />
        </div>

        {/* Queue section */}
        <section>
          <p className="font-mono text-[9px] tracking-[0.15em] text-vault-text3 mb-6">
            APPROVAL QUEUE
          </p>

          {items.length === 0 ? (
            <div className="vault-card text-center py-12">
              <p className="font-ceremonial font-light text-vault-text2 italic" style={{ fontSize: "1.2rem" }}>
                The record is current.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/league/${id}/approve/${item.id}`}
                  className="block vault-card hover:border-vault-gold-dim transition-colors group"
                  style={{ textDecoration: "none" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Type badge */}
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className="font-mono text-[9px] tracking-[0.12em] px-2 py-0.5 rounded-sm"
                          style={{
                            background: item.is_demo
                              ? "rgba(139, 110, 42, 0.1)"
                              : "rgba(74, 124, 89, 0.1)",
                            color: item.is_demo ? "#8B6E2A" : "#4A7C59",
                            border: `1px solid ${item.is_demo ? "rgba(139,110,42,0.6)" : "rgba(74,124,89,0.6)"}`,
                          }}
                        >
                          {item.is_demo ? "DEMO" : item.artifact_class}
                        </span>
                        <span className="font-mono text-[9px] tracking-[0.1em] text-vault-text3">
                          {item.artifact_type.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Label */}
                      <p className="font-ui text-sm text-vault-text group-hover:text-vault-gold-dim transition-colors">
                        {formatArtifactLabel(item)}
                      </p>

                      {/* Meta */}
                      <p className="font-mono text-[9px] tracking-[0.08em] text-vault-text3 mt-1">
                        Version {item.current_version} · {formatRelativeTime(item.updated_at)}
                      </p>
                    </div>

                    {/* State badge */}
                    <div className="shrink-0">
                      <span
                        className="font-mono text-[9px] tracking-[0.1em] px-2 py-0.5 rounded-sm"
                        style={{
                          background: item.approval_state === "CHANGES_REQUESTED"
                            ? "rgba(139, 112, 53, 0.1)"
                            : "rgba(138, 132, 120, 0.1)",
                          color: item.approval_state === "CHANGES_REQUESTED"
                            ? "#8B7035"
                            : "#8A8478",
                          border: `1px solid ${item.approval_state === "CHANGES_REQUESTED"
                            ? "rgba(139,112,53,0.6)"
                            : "rgba(138,132,120,0.6)"}`,
                        }}
                      >
                        {item.approval_state}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
