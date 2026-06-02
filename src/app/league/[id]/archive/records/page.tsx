// src/app/league/[id]/archive/records/page.tsx
// Permanent records — three fixed cards: Hall of Fame & Shame (A1),
// Draft History Vault (A2), Championship Timeline (A3).
// Until the A1/A2/A3 filesystem-source sync milestone lands, each card renders
// its empty state. The cards themselves are permanent fixtures of the archive.
import { createAdminClient } from "@/lib/supabase/server";
import { getLeague } from "@/lib/league";
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
  return { title: `Permanent Records · ${id}` };
}


type RecordRow = {
  id: string;
  artifact_class: string;
  docket_id: string | null;
  approved_at: string | null;
  current_version: number;
};

type RecordCard = {
  artifactClass: "A1" | "A2" | "A3";
  title: string;
  description: string;
  emptyLine: string;
};

const RECORD_CARDS: ReadonlyArray<RecordCard> = [
  {
    artifactClass: "A1",
    title: "Hall of Fame & Shame",
    description:
      "Champions, worst-record seasons, and the largest blowouts in league history.",
    emptyLine: "The record opens with the first approved entry.",
  },
  {
    artifactClass: "A2",
    title: "Draft History Vault",
    description:
      "Bargains, busts, and the most expensive draft-day decisions across every season.",
    emptyLine: "The record opens with the first approved entry.",
  },
  {
    artifactClass: "A3",
    title: "Championship Timeline",
    description:
      "Playoff brackets, cross-season records, and the cross-era bridesmaid leaderboard.",
    emptyLine: "The record opens with the first approved entry.",
  },
] as const;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default async function RecordsArchivePage({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();

  const league = await getLeague(id);
  if (!league) notFound();

  // Permanent records map to artifact_type=SEASON_RETROSPECTIVE in Supabase.
  // We fetch every APPROVED retrospective for this league and pick the most
  // recent per class. (Once the filesystem-source sync lands, a class may
  // have at most one approved entry at a time — but the design tolerates more.)
  const { data: recordsData } = await admin
    .from("artifacts")
    .select("id, artifact_class, docket_id, approved_at, current_version")
    .eq("league_id", league.id)
    .eq("artifact_type", "SEASON_RETROSPECTIVE")
    .eq("approval_state", "APPROVED")
    .eq("is_demo", false)
    .order("approved_at", { ascending: false }) as { data: RecordRow[] | null };

  const records = recordsData ?? [];
  const mostRecentByClass = new Map<string, RecordRow>();
  for (const r of records) {
    if (!mostRecentByClass.has(r.artifact_class)) {
      mostRecentByClass.set(r.artifact_class, r);
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
            ← The Archive
          </Link>
          <h1
            className="font-ceremonial font-light text-vault-text mt-3"
            style={{ fontSize: "2.2rem", letterSpacing: "0.03em" }}
          >
            Permanent Records
          </h1>
          <div className="mt-3" style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }} />
          <p className="font-ui text-sm text-vault-text2 mt-4 max-w-2xl leading-relaxed">
            Cross-season records: champions, drafts, and brackets. Each surface is regenerated from
            canonical league events at the commissioner&apos;s election.
          </p>
        </div>

        <div className="space-y-4">
          {RECORD_CARDS.map((card) => {
            const entry = mostRecentByClass.get(card.artifactClass);
            const enteredAt = formatDate(entry?.approved_at ?? null);
            const hasEntry = entry !== undefined;

            const cardBody = (
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
                      {card.artifactClass}
                    </span>
                    {!hasEntry && (
                      <span className="font-mono text-[9px] tracking-[0.1em] text-vault-text3">
                        AWAITING FIRST ENTRY
                      </span>
                    )}
                  </div>
                  <p
                    className={`font-ceremonial font-light text-vault-text ${
                      hasEntry ? "group-hover:text-vault-gold-dim transition-colors" : ""
                    }`}
                    style={{ fontSize: "1.5rem", letterSpacing: "0.01em" }}
                  >
                    {card.title}
                  </p>
                  <p className="font-ui text-sm text-vault-text2 mt-2 leading-relaxed">
                    {card.description}
                  </p>
                  {hasEntry ? (
                    <p className="font-mono text-[10px] tracking-[0.08em] text-vault-text3 mt-3">
                      <span className="text-vault-gold">{entry.docket_id ?? "—"}</span>
                      {enteredAt && (
                        <>
                          <span className="text-vault-text3 mx-2">·</span>
                          <span>Entered: {enteredAt}</span>
                        </>
                      )}
                      <span className="text-vault-text3 mx-2">·</span>
                      <span>v{entry.current_version}</span>
                    </p>
                  ) : (
                    <p className="font-ceremonial italic text-vault-text3 mt-4" style={{ fontSize: "0.95rem" }}>
                      {card.emptyLine}
                    </p>
                  )}
                </div>
                <span
                  className="shrink-0 self-center font-mono text-[9px] tracking-[0.12em] text-vault-text3"
                  aria-hidden
                >
                  {hasEntry ? "→" : ""}
                </span>
              </div>
            );

            return hasEntry ? (
              <Link
                key={card.artifactClass}
                href={`/league/${id}/archive/records/${entry.id}`}
                className="block vault-card hover:border-vault-gold-dim transition-colors group"
                style={{ textDecoration: "none" }}
              >
                {cardBody}
              </Link>
            ) : (
              <div key={card.artifactClass} className="vault-card" style={{ opacity: 0.85 }}>
                {cardBody}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
