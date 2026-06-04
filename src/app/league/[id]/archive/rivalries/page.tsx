// src/app/league/[id]/archive/rivalries/page.tsx
// Rivalry Chronicle archive (F1) — every APPROVED RIVALRY_CHRONICLE, newest
// first. Public; uses admin client server-side. The matchup label is derived
// from each chronicle's content_markdown header (no structured columns for the
// teams); see src/lib/chronicle.ts.
import { createAdminClient } from "@/lib/supabase/server";
import { getLeague } from "@/lib/league";
import { notFound } from "next/navigation";
import Link from "next/link";
import { parseRivalryTitle } from "@/lib/chronicle";
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
  return { title: `Rivalry Chronicle \u00B7 ${id}` };
}

type ChronicleRow = {
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

export default async function RivalryArchivePage({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();

  const league = await getLeague(id);
  if (!league) notFound();

  const { data: rowsData } = await admin
    .from("artifacts")
    .select("id, season, week_index, current_version, docket_id, approved_at")
    .eq("league_id", league.id)
    .eq("artifact_type", "RIVALRY_CHRONICLE")
    .eq("approval_state", "APPROVED")
    .eq("is_demo", false)
    .order("season", { ascending: false })
    .order("week_index", { ascending: false }) as { data: ChronicleRow[] | null };

  const rows = rowsData ?? [];

  // Derive each matchup label from its current-version content_markdown. One
  // batched query for every version row, then pick current_version per artifact
  // (versions vary per row, so a single .in() avoids an N+1 fan-out).
  const titleById = new Map<string, string | null>();
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const { data: versionsData } = await admin
      .from("artifact_versions")
      .select("artifact_id, version, content_markdown")
      .in("artifact_id", ids) as {
        data: { artifact_id: string; version: number; content_markdown: string }[] | null;
      };
    const byKey = new Map<string, string>();
    for (const v of versionsData ?? []) {
      byKey.set(`${v.artifact_id}:${v.version}`, v.content_markdown);
    }
    for (const r of rows) {
      const md = byKey.get(`${r.id}:${r.current_version}`);
      titleById.set(r.id, md ? parseRivalryTitle(md) : null);
    }
  }

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-12">
          <Link
            href={`/league/${id}/archive`}
            className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 hover:text-vault-text2 transition-colors"
          >
            {"\u2190"} The Archive
          </Link>
          <h1
            className="font-ceremonial font-light text-vault-text mt-3"
            style={{ fontSize: "2.2rem", letterSpacing: "0.03em" }}
          >
            Rivalry Chronicle
          </h1>
          <div className="mt-3" style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }} />
          <p className="font-ui text-sm text-vault-text2 mt-4 max-w-2xl leading-relaxed">
            Head-to-head histories between rival franchises, derived strictly from approved weekly
            recaps. Each is entered into the record by the commissioner before publication.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="vault-card text-center py-16">
            <p
              className="font-ceremonial font-light text-vault-text2 italic"
              style={{ fontSize: "1.2rem" }}
            >
              The record holds no rivalry chronicles yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const approvedDate = formatApprovedDate(row.approved_at);
              const title = titleById.get(row.id) ?? "Rivalry Chronicle";
              return (
                <Link
                  key={row.id}
                  href={`/league/${id}/archive/rivalries/${row.id}`}
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
                          F1
                        </span>
                        {row.season != null && (
                          <span className="font-mono text-[9px] tracking-[0.1em] text-vault-text3">
                            {row.season}
                          </span>
                        )}
                      </div>
                      <p className="font-ui text-base text-vault-text group-hover:text-vault-gold-dim transition-colors">
                        {title}
                      </p>
                      <p className="font-mono text-[10px] tracking-[0.08em] text-vault-text3 mt-1.5">
                        <span className="text-vault-gold">{row.docket_id ?? "\u2014"}</span>
                        {approvedDate && (
                          <>
                            <span className="text-vault-text3 mx-2">{"\u00B7"}</span>
                            <span>Entered: {approvedDate}</span>
                          </>
                        )}
                        <span className="text-vault-text3 mx-2">{"\u00B7"}</span>
                        <span>v{row.current_version}</span>
                      </p>
                    </div>
                    <span
                      className="shrink-0 self-center font-mono text-[9px] tracking-[0.12em] text-vault-text3"
                      aria-hidden
                    >
                      {"\u2192"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
