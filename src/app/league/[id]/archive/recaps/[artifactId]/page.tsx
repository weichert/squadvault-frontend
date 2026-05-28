// src/app/league/[id]/archive/recaps/[artifactId]/page.tsx
// Single weekly recap — commissioner-read-only view of an APPROVED artifact.
// Public; uses admin client server-side. No approval controls.
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { TrustBar } from "@/components/ui/trust-bar";
import { DocketId } from "@/components/ui/docket-id";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string; artifactId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { artifactId } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("artifacts")
    .select("season, week_index")
    .eq("id", artifactId)
    .maybeSingle() as { data: { season: number | null; week_index: number | null } | null };
  if (!data?.season || !data?.week_index) return { title: "Weekly Recap" };
  return { title: `Week ${data.week_index}, ${data.season}` };
}

type LeagueRow = { id: string; name: string };

type ArtifactRow = {
  id: string;
  league_id: string;
  artifact_type: string;
  artifact_class: string;
  season: number | null;
  week_index: number | null;
  approval_state: string;
  current_version: number;
  is_demo: boolean;
  docket_id: string | null;
  approved_at: string | null;
};

export default async function RecapDetailPage({ params }: Props) {
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
      "id, league_id, artifact_type, artifact_class, season, week_index, " +
      "approval_state, current_version, is_demo, docket_id, approved_at",
    )
    .eq("id", artifactId)
    .maybeSingle() as { data: ArtifactRow | null };

  if (!artifactData) notFound();
  const artifact = artifactData;

  // League scoping + type guard: the recaps route only serves WEEKLY_RECAP.
  if (artifact.league_id !== league.id) notFound();
  if (artifact.artifact_type !== "WEEKLY_RECAP") notFound();
  // Surface only entries that have been entered into the record.
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

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <Link
            href={`/league/${id}/archive/recaps`}
            className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 hover:text-vault-text2 transition-colors"
          >
            ← Weekly Recaps
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
            <span className="font-mono text-[9px] tracking-[0.1em] text-vault-text3">
              WEEK {artifact.week_index?.toString().padStart(2, "0")} · {artifact.season}
            </span>
          </div>
          <h1
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: "2rem", letterSpacing: "0.03em" }}
          >
            Week {artifact.week_index}, {artifact.season}
          </h1>
          {artifact.docket_id && (
            <DocketId
              value={artifact.docket_id}
              isDemo={artifact.is_demo}
              enteredAt={artifact.approved_at ?? undefined}
            />
          )}
        </div>

        {/* Trust bar — part of the artifact, not floating (Design Brief) */}
        <TrustBar approvalState={artifact.approval_state as "APPROVED" | "DISTRIBUTED"} isDemo={artifact.is_demo} />

        {/* Body */}
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

        {/* Footer trust bar — bracketing pattern reinforces the record */}
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
