// src/components/ui/trophy-preview.tsx
// Community page Trophy Room preview - three most recent championship
// entries as horizontal cards per Design Brief section 7.1. Server
// Component with its own data path.
//
// Renders null for leagues with zero championship entries per D9 (a) of
// the F3/F2 tighten session - silence over speculation per section 9; the
// Trophy Room surface itself has its empty state for users navigating
// there directly. The community page's own placeholder line covers the
// not-yet-populated case.
//
// Layout: scaled-down version of the Trophy Room surface card. Year-led
// (year is the dominant element), franchise + title stacked below, badge
// bottom-right, trust bar at base. Three cards in a 1-col / 3-col
// responsive grid (single column on mobile per section VIII mobile-first).
//
// Section title is itself a link to the full Trophy Room surface per
// D8 (a) - spare, no "See all" upsell chrome. Cream Cormorant with hover
// transition to gold-dim, matching the link affordance pattern from the
// archive index surface cards.
//
// FUTURE:
// - PROVENANCE_LABEL / PROVENANCE_STYLE are duplicated with
//   trophy-room/page.tsx. Worth extracting to a shared module when a
//   third surface needs them.
// - NULL-season entries (if any) sort first in DESC order per Postgres
//   default. Matches the Trophy Room surface's behavior; could revisit
//   with `nullsFirst: false` if it becomes a problem on real data.
// - The component takes leagueUuid as a prop so it skips the canonical-id
//   to internal-id resolution. Layout-level league context candidate
//   would obviate the prop.
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { TrustBar } from "@/components/ui/trust-bar";
import type { TrophyProvenance } from "@/lib/supabase/types";

interface Props {
  leagueId: string;    // canonical_id - used to build link to /league/[id]/trophy-room
  leagueUuid: string;  // internal leagues.id - used for trophy_room_entries.league_id join
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
  owner_display_name: string;
};

const PROVENANCE_LABEL: Record<TrophyProvenance, string> = {
  CANONICAL:             "ENTERED INTO THE RECORD",
  COMMISSIONER_ATTESTED: "COMMISSIONER ATTESTED",
  DEMO:                  "DEMO",
};

const PROVENANCE_STYLE: Record<
  TrophyProvenance,
  { color: string; borderColor: string }
> = {
  CANONICAL:             { color: "#8B7035", borderColor: "rgba(139, 112, 53, 0.5)" },
  COMMISSIONER_ATTESTED: { color: "#3B7A7A", borderColor: "rgba(59, 122, 122, 0.5)" },
  DEMO:                  { color: "#8B6E2A", borderColor: "rgba(139, 110, 42, 0.5)" },
};

export async function TrophyPreview({ leagueId, leagueUuid }: Props) {
  const admin = createAdminClient();

  // Three most recent championships, season DESC.
  const { data: entriesData } = await admin
    .from("trophy_room_entries")
    .select("id, season, title, description, provenance, franchise_id")
    .eq("league_id", leagueUuid)
    .eq("entry_type", "CHAMPIONSHIP")
    .order("season", { ascending: false })
    .limit(3) as { data: ChampionshipRow[] | null };

  const entries = entriesData ?? [];

  // Per D9 (a) - render nothing for zero championships.
  if (entries.length === 0) return null;

  // Resolve franchise display names in one round trip - same two-query
  // pattern as the Trophy Room surface.
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
    <section className="mb-16">
      {/* Section title is the link per D8 (a) - spare, no upsell chrome */}
      <Link
        href={`/league/${leagueId}/trophy-room`}
        className="group inline-block"
        style={{ textDecoration: "none" }}
      >
        <h2
          className="font-ceremonial font-light text-vault-text group-hover:text-vault-gold-dim transition-colors"
          style={{ fontSize: "1.5rem", letterSpacing: "0.03em" }}
        >
          Trophy Room
        </h2>
      </Link>
      <div
        className="mt-3 mb-6"
        style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }}
      />

      {/* Three cards in a grid - same article pattern as the full Trophy
          Room surface, scaled down. Year-led (year is the dominant lead).
          Single column on mobile; three columns at md+ per section VIII. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {entries.map((entry) => {
          const provStyle = PROVENANCE_STYLE[entry.provenance];
          const provLabel = PROVENANCE_LABEL[entry.provenance];
          const franchiseName = entry.franchise_id
            ? franchiseNameById.get(entry.franchise_id) ?? null
            : null;

          return (
            <article
              key={entry.id}
              className="overflow-hidden flex flex-col"
              style={{
                background: "var(--vault-s1)",
                border: "1px solid rgba(139, 112, 53, 0.4)",
                borderRadius: 4,
              }}
            >
              <div className="px-5 pt-6 pb-4 flex-1 flex flex-col">
                {/* Year - dominant lead per D7 (a) */}
                <h3
                  className="font-ceremonial font-light text-vault-text"
                  style={{
                    fontSize: "2.2rem",
                    letterSpacing: "0.02em",
                    lineHeight: 1,
                    margin: 0,
                  }}
                >
                  {entry.season ?? "-"}
                </h3>

                {/* Champion franchise name */}
                {franchiseName && (
                  <p
                    className="font-ceremonial text-vault-text mt-4"
                    style={{ fontSize: "1.1rem", letterSpacing: "0.01em" }}
                  >
                    {franchiseName}
                  </p>
                )}

                {/* Title - italicized Cormorant per typography spec 3.2 */}
                <p
                  className={`font-ceremonial italic text-vault-text2 ${
                    franchiseName ? "mt-1.5" : "mt-4"
                  }`}
                  style={{
                    fontSize: "0.85rem",
                    letterSpacing: "0.01em",
                    lineHeight: 1.4,
                  }}
                >
                  {entry.title}
                </p>

                {/* Provenance badge - bottom-right, always visible per 7.6.
                    flex-1 above + mt-auto here pins badge to bottom across
                    all three cards in the grid (equal heights). */}
                <div className="flex justify-end mt-auto pt-4">
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

              {/* Trust bar - part of the artifact card per section IX */}
              <TrustBar provenance={entry.provenance} />
            </article>
          );
        })}
      </div>
    </section>
  );
}
