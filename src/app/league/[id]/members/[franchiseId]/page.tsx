// src/app/league/[id]/members/[franchiseId]/page.tsx
// Member Office - the per-franchise surface (Design Brief 7.5).
// Public surface; uses the admin client server-side per the established
// Clubhouse pattern (trophy-room/page.tsx, charter-row.tsx).
//
// [franchiseId] is the canonical_franchise_id ("0001".."0010") - readable and
// era-stable across name changes (D9=A). The franchise's UUID is resolved from
// it for the records / trophies joins.
//
// RECORD BOARD (D8=B): each season renders under its era-correct team name
// (the name AS IT EXISTED that season, from franchise_season_names). The name
// column changes down the page and tells the ownership-turnover story by
// itself - no dividers, no tenure annotations, no owner commentary. owner_name
// is not a stored fact (empty for all franchises); only team names are facts,
// so surfaces stay silent on owners per silence-over-speculation. No final
// rank column: never ingested, not exactly derivable (migration 008 comment).
//
// ARTIFACT HIGHLIGHTS (Design Brief 7.5) intentionally OMITTED for v1 (D11=A):
// no stored artifact<->franchise linkage fact exists, so "featured prominently"
// would be inference. Add when that linkage becomes a fact.
import { createAdminClient } from "@/lib/supabase/server";
import { getLeague } from "@/lib/league";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { TrustBar } from "@/components/ui/trust-bar";
import type { TrophyProvenance } from "@/lib/supabase/types";

// Server Component reading live Supabase state; skip route-segment caching so
// freshly-seeded rows surface without a hard reload (established pattern).
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; franchiseId: string }>;
}

type FranchiseRow = {
  id: string;
  canonical_franchise_id: string;
  owner_display_name: string;
  charter_member: boolean;
};

type RecordRow = {
  season: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  result: "" | "CHAMPION" | "RUNNER_UP";
};

type SeasonNameRow = { season: number; team_name: string };

type TrophyRow = {
  id: string;
  season: number | null;
  title: string;
  provenance: TrophyProvenance;
};

// W-L, or W-L-T when ties are present. Mirrors the engine record convention.
function formatRecord(w: number, l: number, t: number): string {
  return t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

const RESULT_LABEL: Record<"CHAMPION" | "RUNNER_UP", string> = {
  CHAMPION: "Champion",
  RUNNER_UP: "Runner-up",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, franchiseId } = await params;
  return { title: `Member Office ${franchiseId} - ${id}` };
}

export default async function MemberOfficePage({ params }: Props) {
  const { id, franchiseId } = await params;
  const league = await getLeague(id);
  if (!league) notFound();
  const admin = createAdminClient();

  // The franchise slot, by canonical id within this league.
  const { data: franchiseData } = (await admin
    .from("franchises")
    .select("id, canonical_franchise_id, owner_display_name, charter_member")
    .eq("league_id", league.id)
    .eq("canonical_franchise_id", franchiseId)
    .maybeSingle()) as { data: FranchiseRow | null };

  if (!franchiseData) notFound();
  const franchise = franchiseData;

  // Era-correct names for this slot, keyed by season. Current banner = the most
  // recent season's name (fallback to owner_display_name only if absent).
  const { data: seasonNamesData } = (await admin
    .from("franchise_season_names")
    .select("season, team_name")
    .eq("league_id", league.id)
    .eq("canonical_franchise_id", franchiseId)) as { data: SeasonNameRow[] | null };

  const nameBySeason = new Map<number, string>();
  let latestNamedSeason = -1;
  for (const r of seasonNamesData ?? []) {
    nameBySeason.set(r.season, r.team_name);
    if (r.season > latestNamedSeason) latestNamedSeason = r.season;
  }
  const currentName =
    (latestNamedSeason >= 0 ? nameBySeason.get(latestNamedSeason) : undefined) ??
    franchise.owner_display_name;

  // Season records, by the franchise UUID. Most-recent first (matches the
  // site's descending convention on the archive and trophy room).
  const { data: recordsData } = (await admin
    .from("franchise_season_records")
    .select("season, wins, losses, ties, points_for, result")
    .eq("league_id", league.id)
    .eq("franchise_id", franchise.id)
    .order("season", { ascending: false })) as { data: RecordRow[] | null };

  const records = recordsData ?? [];
  const latestRecord = records[0] ?? null; // descending => [0] is most recent

  // Championship trophies for this slot (era-correct titles already in the row).
  const { data: trophyData } = (await admin
    .from("trophy_room_entries")
    .select("id, season, title, provenance")
    .eq("league_id", league.id)
    .eq("franchise_id", franchise.id)
    .eq("entry_type", "CHAMPIONSHIP")
    .order("season", { ascending: false })) as { data: TrophyRow[] | null };

  const trophies = trophyData ?? [];

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Back to the members directory */}
        <Link
          href={`/league/${id}/members`}
          className="font-ui text-sm text-vault-text2 hover:text-vault-gold-dim transition-colors"
          style={{ textDecoration: "none", letterSpacing: "0.04em" }}
        >
          &larr; Members
        </Link>

        {/* Hero - era-correct current name, current-season record, charter seal */}
        <header className="mt-6 mb-14">
          <h1
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: "2.5rem", letterSpacing: "0.02em", lineHeight: 1.05, margin: 0 }}
          >
            {currentName}
          </h1>

          {latestRecord && (
            <p className="font-ui text-vault-text2 mt-3" style={{ fontSize: "1.125rem" }}>
              {latestRecord.season} season&nbsp;&middot;&nbsp;
              {formatRecord(latestRecord.wins, latestRecord.losses, latestRecord.ties)}
            </p>
          )}

          {franchise.charter_member && (
            <div className="flex items-center gap-2 mt-4">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="flex-shrink-0">
                <circle cx="6" cy="6" r="5.25" fill="none" stroke="var(--vault-gold-dim)" strokeWidth="1" />
                <circle cx="6" cy="6" r="1.75" fill="var(--vault-gold-dim)" />
              </svg>
              <span
                className="font-mono text-vault-gold-dim"
                style={{ fontSize: "10px", letterSpacing: "0.12em" }}
              >
                CHARTER MEMBER
              </span>
            </div>
          )}

          <div className="mt-6" style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }} />
        </header>

        {/* Record board - editorial stat block, era-correct name per row (D8=B) */}
        <section className="mb-16">
          <h2
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: "1.5rem", letterSpacing: "0.03em" }}
          >
            Record
          </h2>
          <div className="mt-3 mb-6" style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }} />

          {records.length === 0 ? (
            <div className="vault-card text-center py-12">
              <p className="font-ceremonial font-light text-vault-text2 italic" style={{ fontSize: "1.1rem" }}>
                The record opens with the first completed season.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse" style={{ fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(139, 112, 53, 0.4)" }}>
                  <th className="font-mono text-vault-text2 text-left"  style={{ fontSize: "10px", letterSpacing: "0.12em", padding: "8px 12px", fontWeight: 400 }}>SEASON</th>
                  <th className="font-mono text-vault-text2 text-left"  style={{ fontSize: "10px", letterSpacing: "0.12em", padding: "8px 12px", fontWeight: 400 }}>TEAM</th>
                  <th className="font-mono text-vault-text2 text-right" style={{ fontSize: "10px", letterSpacing: "0.12em", padding: "8px 12px", fontWeight: 400 }}>RECORD</th>
                  <th className="font-mono text-vault-text2 text-right" style={{ fontSize: "10px", letterSpacing: "0.12em", padding: "8px 12px", fontWeight: 400 }}>POINTS&nbsp;FOR</th>
                  <th className="font-mono text-vault-text2 text-left"  style={{ fontSize: "10px", letterSpacing: "0.12em", padding: "8px 12px", fontWeight: 400 }}>RESULT</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  // Era-correct team name for this season; defensive fallback to
                  // the current name (should not fire for real 2010-2025 rows).
                  const teamName = nameBySeason.get(r.season) ?? currentName;
                  const rowBg = i % 2 === 0 ? "#141418" : "#1D1D23";
                  return (
                    <tr key={r.season} style={{ background: rowBg }}>
                      <td className="font-ceremonial text-vault-text" style={{ fontSize: "1.05rem", padding: "10px 12px" }}>
                        {r.season}
                      </td>
                      <td className="font-ui text-vault-text" style={{ fontSize: "0.95rem", padding: "10px 12px" }}>
                        {teamName}
                      </td>
                      <td className="font-ui text-vault-text text-right" style={{ fontSize: "0.95rem", padding: "10px 12px" }}>
                        {formatRecord(r.wins, r.losses, r.ties)}
                      </td>
                      <td className="font-ui text-vault-text2 text-right" style={{ fontSize: "0.95rem", padding: "10px 12px" }}>
                        {Number(r.points_for).toFixed(1)}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {r.result !== "" && (
                          <span
                            className="font-mono"
                            style={{
                              fontSize: "9px",
                              letterSpacing: "0.12em",
                              color: r.result === "CHAMPION" ? "var(--vault-gold)" : "var(--vault-text2)",
                              border: `1px solid ${r.result === "CHAMPION" ? "var(--vault-gold-dim)" : "rgba(138, 132, 120, 0.4)"}`,
                              padding: "2px 7px",
                              borderRadius: 3,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {RESULT_LABEL[r.result].toUpperCase()}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Trophy wall - render only if this slot has championships (silence
            over an empty "no trophies" state, per section 9 anti-pattern). */}
        {trophies.length > 0 && (
          <section className="mb-8">
            <h2
              className="font-ceremonial font-light text-vault-text"
              style={{ fontSize: "1.5rem", letterSpacing: "0.03em" }}
            >
              Trophies
            </h2>
            <div className="mt-3 mb-6" style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }} />

            <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
              {trophies.map((t) => (
                <article
                  key={t.id}
                  className="flex-shrink-0 overflow-hidden"
                  style={{
                    width: 200,
                    background: "var(--vault-s1)",
                    border: "1px solid rgba(139, 112, 53, 0.4)",
                    borderRadius: 4,
                  }}
                >
                  <div className="px-5 pt-5 pb-4">
                    <h3
                      className="font-ceremonial font-light text-vault-text"
                      style={{ fontSize: "2rem", letterSpacing: "0.02em", lineHeight: 1, margin: 0 }}
                    >
                      {t.season ?? "-"}
                    </h3>
                    <p
                      className="font-ceremonial italic text-vault-text2 mt-3"
                      style={{ fontSize: "0.95rem", letterSpacing: "0.01em", lineHeight: 1.4 }}
                    >
                      {t.title}
                    </p>
                  </div>
                  <TrustBar provenance={t.provenance} />
                </article>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
