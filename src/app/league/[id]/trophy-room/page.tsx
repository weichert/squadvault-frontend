// src/app/league/[id]/trophy-room/page.tsx
// Trophy Room - the league-level ceremonial surface for championship entries.
// Public surface; uses admin client server-side per established pattern.
//
// v1 SCOPE: CHAMPIONSHIP entries only.
// PHYSICAL_TROPHY, COMMISSIONER_ATTESTED (entry_type), and SHAME_RECORD are
// deferred until the commissioner-entry surface exists. Design Brief section
// 7.6 also calls for championship score and a one-line note per card; the
// schema carries neither, and the seed titles serve the note role.
//
// See engine _observations/OBSERVATIONS_2026_05_30_TROPHY_ROOM_UI_SHIPMENT.md
// for the five-decision scope record.
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { TrustBar } from "@/components/ui/trust-bar";
import type { TrophyProvenance } from "@/lib/supabase/types";

// Server Component reading live Supabase state. Skip Next.js route segment
// caching so newly-entered trophy entries surface without a hard reload. See
// _observations/OBSERVATIONS_2026_05_28_LEAGUE_PAGES_FORCE_DYNAMIC.md in the
// engine repo for the established pattern.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Trophy Room - ${id}` };
}

type LeagueRow = { id: string; name: string };

type ChampionshipRow = {
  id: string;
  season: number | null;
  title: string;
  description: string | null;
  provenance: TrophyProvenance;
  franchise_id: string | null;
};

type FranchiseRow = {
  id: string;
  owner_display_name: string;
};

// Provenance label text per Design Brief sections 2.5 and 7.6.
// Always visible on every entry; does not disappear on hover/scroll
// (section 9 anti-pattern).
const PROVENANCE_LABEL: Record<TrophyProvenance, string> = {
  CANONICAL:             "ENTERED INTO THE RECORD",
  COMMISSIONER_ATTESTED: "COMMISSIONER ATTESTED",
  DEMO:                  "DEMO",
};

// Token colors per Design Brief section 2.4 mapped to provenance.
const PROVENANCE_STYLE: Record<
  TrophyProvenance,
  { color: string; borderColor: string }
> = {
  CANONICAL:             { color: "#8B7035", borderColor: "rgba(139, 112, 53, 0.5)" },
  COMMISSIONER_ATTESTED: { color: "#3B7A7A", borderColor: "rgba(59, 122, 122, 0.5)" },
  DEMO:                  { color: "#8B6E2A", borderColor: "rgba(139, 110, 42, 0.5)" },
};

export default async function TrophyRoomPage({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: leagueData } = await admin
    .from("leagues")
    .select("id, name")
    .eq("canonical_id", id)
    .maybeSingle() as { data: LeagueRow | null };

  if (!leagueData) notFound();
  const league = leagueData;

  // Fetch championship entries, season descending. Two-query pattern (entries
  // then franchises by id) mirrors the recap archive - avoids PostgREST
  // embedding semantics and keeps the typing straightforward.
  const { data: entriesData } = await admin
    .from("trophy_room_entries")
    .select("id, season, title, description, provenance, franchise_id")
    .eq("league_id", league.id)
    .eq("entry_type", "CHAMPIONSHIP")
    .order("season", { ascending: false }) as { data: ChampionshipRow[] | null };

  const entries = entriesData ?? [];

  // Resolve franchise display names in one round trip.
  const franchiseIds = Array.from(
    new Set(
      entries
        .map((e) => e.franchise_id)
        .filter((fid): fid is string => fid !== null),
    ),
  );

  const franchiseNameById = new Map<string, string>();
  if (franchiseIds.length > 0) {
    const { data: franchisesData } = await admin
      .from("franchises")
      .select("id, owner_display_name")
      .in("id", franchiseIds) as { data: FranchiseRow[] | null };

    for (const f of franchisesData ?? []) {
      franchiseNameById.set(f.id, f.owner_display_name);
    }
  }

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Header - back to community page; Cormorant display title; gold rule */}
        <div className="mb-12">
          <Link
            href={`/league/${id}`}
            className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 hover:text-vault-text2 transition-colors"
          >
            {"\u2190"} {league.name}
          </Link>
          <h1
            className="font-ceremonial font-light text-vault-text mt-3"
            style={{ fontSize: "2.2rem", letterSpacing: "0.03em" }}
          >
            Trophy Room
          </h1>
          <div
            className="mt-3"
            style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }}
          />
          <p className="font-ui text-sm text-vault-text2 mt-4 max-w-2xl leading-relaxed">
            Championship entries in {league.name}, chronologically. Every entry below carries its
            provenance - entered into the record or commissioner attested.
          </p>
        </div>

        {entries.length === 0 ? (
          /* Empty state - principled silence per section 9 anti-pattern */
          <div className="vault-card text-center py-16">
            <p
              className="font-ceremonial font-light text-vault-text2 italic"
              style={{ fontSize: "1.2rem" }}
            >
              The trophy room opens with the first championship entry.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => {
              const provStyle = PROVENANCE_STYLE[entry.provenance];
              const provLabel = PROVENANCE_LABEL[entry.provenance];
              const franchiseName = entry.franchise_id
                ? franchiseNameById.get(entry.franchise_id) ?? null
                : null;

              return (
                <article
                  key={entry.id}
                  className="overflow-hidden"
                  style={{
                    background: "var(--vault-s1)",
                    border: "1px solid rgba(139, 112, 53, 0.4)",
                    borderRadius: 4,
                  }}
                >
                  <div className="px-8 pt-8 pb-6">
                    {/* Season - large display year (Cormorant per section 7.6) */}
                    <h2
                      className="font-ceremonial font-light text-vault-text"
                      style={{
                        fontSize: "3rem",
                        letterSpacing: "0.02em",
                        lineHeight: 1,
                        margin: 0,
                      }}
                    >
                      {entry.season ?? "-"}
                    </h2>

                    {/* Champion franchise name */}
                    {franchiseName && (
                      <p
                        className="font-ceremonial text-vault-text mt-5"
                        style={{ fontSize: "1.45rem", letterSpacing: "0.01em" }}
                      >
                        {franchiseName}
                      </p>
                    )}

                    {/* Title - the trophy name, italicized Cormorant per typography spec 3.2 */}
                    <p
                      className={`font-ceremonial italic text-vault-text2 ${franchiseName ? "mt-2" : "mt-5"}`}
                      style={{ fontSize: "1.1rem", letterSpacing: "0.01em", lineHeight: 1.4 }}
                    >
                      {entry.title}
                    </p>

                    {/* Provenance badge - bottom-right per 5.2; always visible per 7.6 */}
                    <div className="flex justify-end mt-6">
                      <span
                        className="font-mono"
                        style={{
                          fontSize: "9px",
                          letterSpacing: "0.12em",
                          color: provStyle.color,
                          border: `1px solid ${provStyle.borderColor}`,
                          padding: "3px 8px",
                          borderRadius: 3,
                        }}
                      >
                        {provLabel}
                      </span>
                    </div>
                  </div>

                  {/* Trust bar - part of the artifact card, not floating (section 9 anti-pattern) */}
                  <TrustBar provenance={entry.provenance} />
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
