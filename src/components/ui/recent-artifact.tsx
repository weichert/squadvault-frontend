// src/components/ui/recent-artifact.tsx
// Community page "The Record" block - the most recent public artifact, per
// Design Brief section 7.1 (headline, first two sentences, docket ID, trust
// bar, "read the full record" link). Server Component with its own data path,
// mirroring trophy-preview.tsx.
//
// Honors the audience split (recap-audience.ts): WEEKLY_RECAP artifacts render
// only the public shareable segment. An artifact whose shareable segment is a
// principled silence (audit-only, no public prose) is skipped in favor of the
// next most recent renderable one, so the front door never features audit
// content.
//
// When no renderable record exists yet, the block renders the section header
// plus a section-IX "communicate potential" line rather than nothing - this is
// the spot the old community-page placeholder occupied, now with the right tone.
//
// FUTURE:
// - Headline / sentence derivation is a light markdown strip; if the engine
//   later emits a structured headline field, read it directly.
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { getLeague } from "@/lib/league";
import { TrustBar } from "@/components/ui/trust-bar";
import { DocketId } from "@/components/ui/docket-id";
import { extractShareableSegment } from "@/lib/recap-audience";
import type { ApprovalState } from "@/lib/supabase/types";

interface Props {
  leagueId: string; // canonical_id; internal id resolved via getLeague (cached)
}

type ArtifactRow = {
  id: string;
  artifact_type: string;
  artifact_class: string;
  season: number | null;
  week_index: number | null;
  approval_state: ApprovalState;
  current_version: number;
  is_demo: boolean;
  docket_id: string | null;
  approved_at: string | null;
};

const CLASS_LABEL: Record<string, string> = {
  A1: "HALL OF FAME & SHAME",
  A2: "DRAFT HISTORY VAULT",
  A3: "CHAMPIONSHIP TIMELINE",
};

// Where "read the full record" points, by artifact shape.
function detailHref(leagueId: string, a: ArtifactRow): string {
  if (a.artifact_type === "WEEKLY_RECAP")
    return `/league/${leagueId}/archive/recaps/${a.id}`;
  if (a.artifact_class === "A1" || a.artifact_class === "A2" || a.artifact_class === "A3")
    return `/league/${leagueId}/archive/records/${a.id}`;
  return `/league/${leagueId}/archive`;
}

// Mono eyebrow context line for the featured card.
function eyebrow(a: ArtifactRow): string {
  if (a.artifact_type === "WEEKLY_RECAP" && a.week_index && a.season)
    return `WEEKLY RECAP \u00B7 WEEK ${a.week_index}, ${a.season}`;
  if (CLASS_LABEL[a.artifact_class]) return CLASS_LABEL[a.artifact_class];
  return "FROM THE RECORD";
}

// Strip the markdown tokens that would read as noise in a short teaser.
function stripMarkdown(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")     // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")  // links -> text
    .replace(/^#{1,6}\s+/gm, "")               // heading markers
    .replace(/^\s*>\s?/gm, "")                 // blockquotes
    .replace(/[*_`]+/g, "")                     // emphasis / code ticks
    .replace(/\s+/g, " ")
    .trim();
}

// Derive a headline (first markdown heading, if any) and a two-sentence teaser.
function deriveHeadlineAndTeaser(shareable: string): {
  headline: string | null;
  teaser: string;
} {
  const headingMatch = shareable.match(/^#{1,6}\s+(.+)$/m);
  const headline = headingMatch ? stripMarkdown(headingMatch[1]) : null;
  const body = headingMatch ? shareable.replace(headingMatch[0], "") : shareable;
  const flat = stripMarkdown(body);
  const sentences = flat.match(/[^.!?]+[.!?]+/g) ?? (flat ? [flat] : []);
  const teaser = sentences.slice(0, 2).join(" ").trim();
  return { headline, teaser };
}

export async function RecentArtifact({ leagueId }: Props) {
  const league = await getLeague(leagueId);
  if (!league) return null;

  const admin = createAdminClient();

  // A small candidate window so a principled-silence latest entry does not
  // suppress a perfectly good slightly-older one. Newest first.
  const { data: artifactData } = (await admin
    .from("artifacts")
    .select(
      "id, artifact_type, artifact_class, season, week_index, approval_state, current_version, is_demo, docket_id, approved_at",
    )
    .eq("league_id", league.id)
    .in("approval_state", ["APPROVED", "DISTRIBUTED"])
    .eq("is_demo", false)
    .order("approved_at", { ascending: false })
    .limit(5)) as { data: ArtifactRow[] | null };

  const candidates = artifactData ?? [];

  let featured: ArtifactRow | null = null;
  let headline: string | null = null;
  let teaser = "";

  if (candidates.length > 0) {
    const ids = candidates.map((a) => a.id);
    const { data: versionData } = (await admin
      .from("artifact_versions")
      .select("artifact_id, version, content_markdown")
      .in("artifact_id", ids)) as {
      data:
        | { artifact_id: string; version: number; content_markdown: string }[]
        | null;
    };

    const contentByArtifact = new Map<string, string>();
    for (const a of candidates) {
      const v = (versionData ?? []).find(
        (r) => r.artifact_id === a.id && r.version === a.current_version,
      );
      if (v) contentByArtifact.set(a.id, v.content_markdown);
    }

    for (const a of candidates) {
      const content = contentByArtifact.get(a.id);
      if (!content) continue;
      const shareable = extractShareableSegment(content, a.artifact_type);
      if (!shareable) continue; // principled silence - skip
      const derived = deriveHeadlineAndTeaser(shareable);
      if (!derived.headline && !derived.teaser) continue;
      featured = a;
      headline = derived.headline;
      teaser = derived.teaser;
      break;
    }
  }

  return (
    <section className="mb-16">
      <Link
        href={`/league/${leagueId}/archive`}
        className="group inline-block"
        style={{ textDecoration: "none" }}
      >
        <h2
          className="font-ceremonial font-light text-vault-text group-hover:text-vault-gold-dim transition-colors"
          style={{ fontSize: "1.5rem", letterSpacing: "0.03em" }}
        >
          The Record
        </h2>
      </Link>
      <div
        className="mt-3 mb-6"
        style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }}
      />

      {featured ? (
        <article
          className="overflow-hidden flex flex-col"
          style={{
            background: "var(--vault-s2)",
            border: "1px solid var(--vault-border)",
            borderRadius: 4,
          }}
        >
          <div className="px-6 pt-6 pb-5">
            <p
              className="font-mono text-vault-text3"
              style={{ fontSize: "9px", letterSpacing: "0.18em" }}
            >
              {eyebrow(featured)}
            </p>

            {headline && (
              <h3
                className="font-ceremonial font-light text-vault-text mt-3"
                style={{ fontSize: "1.6rem", letterSpacing: "0.02em", lineHeight: 1.2 }}
              >
                {headline}
              </h3>
            )}

            {teaser && (
              <p
                className="font-ui text-vault-text2 mt-3"
                style={{ fontSize: "0.95rem", lineHeight: 1.7 }}
              >
                {teaser}
              </p>
            )}

            <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
              {featured.docket_id && (
                <DocketId
                  value={featured.docket_id}
                  enteredAt={featured.approved_at ?? undefined}
                />
              )}
              <Link
                href={detailHref(leagueId, featured)}
                className="font-mono text-vault-gold-dim hover:text-vault-gold transition-colors"
                style={{ fontSize: "10px", letterSpacing: "0.12em", textDecoration: "none" }}
              >
                READ THE FULL RECORD {"\u2192"}
              </Link>
            </div>
          </div>

          <TrustBar approvalState={featured.approval_state} />
        </article>
      ) : (
        <p
          className="font-ceremonial italic text-vault-text2"
          style={{ fontSize: "1.05rem", letterSpacing: "0.02em" }}
        >
          The archive begins with the first approved record.
        </p>
      )}
    </section>
  );
}
