// src/app/league/[id]/approve/[artifactId]/page.tsx
// Server component: fetch artifact + version, gate to commissioner, render review UI
import { createAdminClient } from "@/lib/supabase/server";
import { createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { ArtifactReview } from "@/components/ui/artifact-review";
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
  const { id } = await params;
  return { title: `Review Artifact · ${id}` };
}

export default async function ApprovePage({ params }: Props) {
  const { id, artifactId } = await params;

  // Gate: commissioner session required
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?redirect=/league/${id}/approve/${artifactId}`);

  const admin = createAdminClient();

  // Verify commissioner
  const { data: league } = await admin
    .from("leagues")
    .select("id, name, commissioner_user_id")
    .eq("canonical_id", id)
    .maybeSingle() as {
      data: { id: string; name: string; commissioner_user_id: string | null } | null
    };

  if (!league) notFound();
  if (league.commissioner_user_id !== user.id) redirect(`/league/${id}`);

  // Fetch artifact
  const { data: artifact } = await admin
    .from("artifacts")
    .select("id, artifact_type, artifact_class, season, week_index, approval_state, current_version, is_demo, trust_bar_text, docket_id")
    .eq("id", artifactId)
    .eq("league_id", league.id)
    .maybeSingle() as {
      data: {
        id: string;
        artifact_type: string;
        artifact_class: string;
        season: number | null;
        week_index: number | null;
        approval_state: string;
        current_version: number;
        is_demo: boolean;
        trust_bar_text: string;
        docket_id: string | null;
      } | null
    };

  if (!artifact) notFound();

  // Fetch current version content
  const { data: version } = await admin
    .from("artifact_versions")
    .select("content_markdown")
    .eq("artifact_id", artifactId)
    .eq("version", artifact.current_version)
    .maybeSingle() as { data: { content_markdown: string } | null };

  if (!version) notFound();

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <ArtifactReview
        artifactId={artifact.id}
        leagueId={id}
        content={version.content_markdown}
        artifactType={artifact.artifact_type}
        season={artifact.season}
        weekIndex={artifact.week_index}
        isDemo={artifact.is_demo}
        version={artifact.current_version}
        trustBarText={artifact.trust_bar_text}
      />
    </main>
  );
}
