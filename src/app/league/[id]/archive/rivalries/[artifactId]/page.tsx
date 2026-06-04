// src/app/league/[id]/archive/rivalries/[artifactId]/page.tsx
// Single rivalry chronicle (F1) — public read-only view of an APPROVED
// artifact. Public; uses admin client server-side. No approval controls.
// The public view strips the "## Trace" audit block (raw franchise IDs,
// canonical event fingerprints, deterministic fact-block hash) per the
// audience posture established for WEEKLY_RECAP; see src/lib/chronicle.ts.
import { createAdminClient } from "@/lib/supabase/server";
import { getLeague } from "@/lib/league";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { TrustBar } from "@/components/ui/trust-bar";
import { DocketId } from "@/components/ui/docket-id";
import { parseRivalryTitle, stripTraceBlock } from "@/lib/chronicle";
import type { Metadata } from "next";

// Server Component reading live Supabase state. Skip Next.js route segment
// caching so synced artifacts surface without a hard reload. See
// _observations/OBSERVATIONS_2026_05_28_LEAGUE_PAGES_FORCE_DYNAMIC.md in the
// engine repo for the full rationale.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; artifactId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { artifactId } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("artifact_versions")
    .select("content_markdown")
    .eq("artifact_id", artifactId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { content_markdown: string } | null };
  const title = data ? parseRivalryTitle(data.content_markdown) : null;
  return { title: title ?? "Rivalry Chronicle" };
}

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

export default async function RivalryDetailPage({ params }: Props) {
  const { id, artifactId } = await params;
  const league = await getLeague(id);
  if (!league) notFound();
  const admin = createAdminClient();

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

  // League scoping + type guard: the rivalries route only serves the synced
  // RIVALRY_CHRONICLE type (the engine RIVALRY_CHRONICLE_V1, mapped without the
  // _V1 suffix by scripts/sync_to_supabase.py per the Supabase CHECK constraint).
  if (artifact.league_id !== league.id) notFound();
  if (artifact.artifact_type !== "RIVALRY_CHRONICLE") notFound();
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

  const title = parseRivalryTitle(versionData.content_markdown) ?? "Rivalry Chronicle";
  // Public view: strip the audit Trace block, keep the Disclosures section.
  const body = stripTraceBlock(versionData.content_markdown);

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <Link
            href={`/league/${id}/archive/rivalries`}
            className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 hover:text-vault-text2 transition-colors"
          >
            {"\u2190"} Rivalry Chronicle
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
                {artifact.season}
              </span>
            )}
          </div>
          <h1
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: "2rem", letterSpacing: "0.03em" }}
          >
            {title}
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
            <ReactMarkdown>{body}</ReactMarkdown>
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
