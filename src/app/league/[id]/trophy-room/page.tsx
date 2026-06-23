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
import { getLeague } from "@/lib/league";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TrustBar } from "@/components/ui/trust-bar";
import type { TrophyProvenance } from "@/lib/supabase/types";
import { PROVENANCE_LABEL, PROVENANCE_STYLE } from "@/lib/trophy-provenance";
import { loadChampionshipPackage } from "@/lib/trophy-room";
import { ChampionshipPackage } from "@/components/trophy-room/championship-package";

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
  canonical_franchise_id: string;
  owner_display_name: string;
};

type SeasonNameRow = {
  canonical_franchise_id: string;
  season: number;
  team_name: string;
};

// Provenance label/style: the shared module (lib/trophy-provenance), consumed by both this
// championship list and the Championship Package band so a trust label means the same everywhere
// (spec section 6; extraction flagged in the Trophy Room tighten memo). Always visible per the
// section 9 anti-pattern.

export default async function TrophyRoomPage({ params }: Props) {
  const { id } = await params;
  const league = await getLeague(id);
  if (!league) notFound();
  const admin = createAdminClient();

  // W.5 Championship Package - the featured custody-aware band (the Belt's derived holder + chain,
  // the Ring + League Trophy derived off the championship record). Distinct from the flat list below.
  const pkg = await loadChampionshipPackage(admin, league.id);

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

  // Resolve franchise names. Two maps off one franchises round trip:
  //   franchiseCanonicalById: uuid -> canonical_franchise_id (the era-name key)
  //   franchiseNameById:      uuid -> current name (defensive fallback only)
  const franchiseCanonicalById = new Map<string, string>();
  const franchiseNameById = new Map<string, string>();
  if (franchiseIds.length > 0) {
    const { data: franchisesData } = await admin
      .from("franchises")
      .select("id, canonical_franchise_id, owner_display_name")
      .in("id", franchiseIds) as { data: FranchiseRow[] | null };

    for (const f of franchisesData ?? []) {
      franchiseCanonicalById.set(f.id, f.canonical_franchise_id);
      franchiseNameById.set(f.id, f.owner_display_name);
    }
  }

  // Era-correct champion names: the team name AS IT EXISTED in the title
  // season (franchise_season_names, migration 009). A slot whose ownership
  // turned over renders each season under its true name rather than the
  // current name - e.g. slot 0010's 2016 title reads "SS Express", not the
  // current "Brandon Knows Ball". Keyed `${canonical_franchise_id}:${season}`.
  const seasonNameByKey = new Map<string, string>();
  {
    const { data: seasonNamesData } = await admin
      .from("franchise_season_names")
      .select("canonical_franchise_id, season, team_name")
      .eq("league_id", league.id) as { data: SeasonNameRow[] | null };

    for (const r of seasonNamesData ?? []) {
      seasonNameByKey.set(`${r.canonical_franchise_id}:${r.season}`, r.team_name);
    }
  }

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Header - back to community page; Cormorant display title; gold rule */}
        <div className="mb-12">
          <h1
            className="font-ceremonial font-light text-vault-text"
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

        {/* W.5 Championship Package - the featured custody band, above the chronological list. */}
        <ChampionshipPackage pkg={pkg} />

        <h2 className="font-mono" style={{ fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--vault-gold-dim)", marginBottom: 14 }}>
          Championship Record
        </h2>

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
              // Era-correct: uuid -> canonical_franchise_id -> (cfid, season)
              // name. Falls back to the current name only if a season name is
              // absent (should not occur for 2010-2025; defensive).
              const franchiseName = (() => {
                if (!entry.franchise_id) return null;
                const cfid = franchiseCanonicalById.get(entry.franchise_id);
                if (cfid && entry.season != null) {
                  const eraName = seasonNameByKey.get(`${cfid}:${entry.season}`);
                  if (eraName) return eraName;
                }
                return franchiseNameById.get(entry.franchise_id) ?? null;
              })();

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
