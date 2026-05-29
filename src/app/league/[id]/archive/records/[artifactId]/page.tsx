// src/app/league/[id]/archive/records/[artifactId]/page.tsx
// Single permanent record — A1/A2/A3 retrospective. Read-only view.
// Public; uses admin client server-side. No approval controls.
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { TrustBar } from "@/components/ui/trust-bar";
import { DocketId } from "@/components/ui/docket-id";
import type { Metadata } from "next";

// Server Component reading live Supabase state. Skip Next.js route segment
// caching so synced artifacts surface without a hard reload. See
// _observations/OBSERVATIONS_2026_05_28_LEAGUE_PAGES_FORCE_DYNAMIC.md in the
// engine repo for the full rationale.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; artifactId: string }>;
}

const CLASS_TITLES: Record<string, string> = {
  A1: "Hall of Fame & Shame",
  A2: "Draft History Vault",
  A3: "Championship Timeline",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { artifactId } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("artifacts")
    .select("artifact_class")
    .eq("id", artifactId)
    .maybeSingle() as { data: { artifact_class: string } | null };
  const title = data?.artifact_class ? CLASS_TITLES[data.artifact_class] : null;
  return { title: title ?? "Permanent Record" };
}

type LeagueRow = { id: string; name: string };

type ArtifactRow = {
  id: string;
  league_id: string;
  artifact_type: string;
  artifact_class: string;
  season: number | null;
  approval_state: string;
  current_version: number;
  is_demo: boolean;
  docket_id: string | null;
  approved_at: string | null;
};

export default async function RecordDetailPage({ params }: Props) {
  const { id, artifactId } = await params;
  const admin = createAdminClient();

  const { data: leagueData } = await admin
    .from("leagues")
    .select("id, name")
    .eq("canonical_id", id)
    .maybeSingle() as { data: LeagueRow | null };
  if (!leagueData) notFound();
  const league = leagueData;

  const { data: artifactData } = await admin
    .from("artifacts")
    .select(
      "id, league_id, artifact_type, artifact_class, season, approval_state, " +
      "current_version, is_demo, docket_id, approved_at",
    )
    .eq("id", artifactId)
    .maybeSingle() as { data: ArtifactRow | null };

  if (!artifactData) notFound();
  const artifact = artifactData;

  if (artifact.league_id !== league.id) notFound();
  if (artifact.artifact_type !== "SEASON_RETROSPECTIVE") notFound();
  if (artifact.approval_state !== "APPROVED" && artifact.approval_state !== "DISTRIBUTED") {
    notFound();
  }

  const { data: versionData } = await admin
    .from("artifact_versions")
    .select("content_markdown")
    .eq("artifact_id", artifact.id)
    .eq("version", artifact.current_version)
    .maybeSingle() as { data: { content_markdown: string } | null };
  if (!versionData) notFound();

  const surfaceTitle = CLASS_TITLES[artifact.artifact_class] ?? "Permanent Record";

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <Link
            href={`/league/${id}/archive/records`}
            className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 hover:text-vault-text2 transition-colors"
          >
            ← Permanent Records
          </Link>
          <div className="flex items-center gap-3 mt-4 mb-2">
            <span
              className="font-mono text-[9px] tracking-[0.12em] px-2 py-0.5 rounded-sm"
              style={{
                background: "rgba(74, 124, 89, 0.1)",
                color: "#4A7C59",
                border: "1px solid rgba(74,124,89,0.6)",
              }}
            >
              {artifact.artifact_class}
            </span>
            {artifact.season != null && (
              <span className="font-mono text-[9px] tracking-[0.1em] text-vault-text3">
                THROUGH {artifact.season}
              </span>
            )}
          </div>
          <h1
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: "2.1rem", letterSpacing: "0.03em" }}
          >
            {surfaceTitle}
          </h1>
          {artifact.docket_id && (
            <DocketId
              value={artifact.docket_id}
              isDemo={artifact.is_demo}
              enteredAt={artifact.approved_at ?? undefined}
            />
          )}
        </div>

        <TrustBar approvalState={artifact.approval_state as "APPROVED" | "DISTRIBUTED"} isDemo={artifact.is_demo} />

        <article
          className="vault-card mt-6"
          style={{
            background: "#1D1D23",
            border: "1px solid var(--vault-border)",
            padding: "2.25rem",
          }}
        >
          <div className="prose-artifact">
            <ReactMarkdown>{versionData.content_markdown}</ReactMarkdown>
          </div>
        </article>

        <div className="mt-6">
          <TrustBar approvalState={artifact.approval_state as "APPROVED" | "DISTRIBUTED"} isDemo={artifact.is_demo} />
        </div>

        <p className="font-mono text-[9px] tracking-[0.1em] text-vault-text3 mt-6 text-center">
          VERSION {artifact.current_version}
        </p>
      </div>
    </main>
  );
}
