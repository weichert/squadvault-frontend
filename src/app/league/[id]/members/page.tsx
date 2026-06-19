// src/app/league/[id]/members/page.tsx
// Members directory - the index of franchise slots (Design Brief 7.5 / 7.1).
// Public surface; admin client server-side per the established pattern.
//
// Each card links to that franchise's Member Office at
// /league/[id]/members/[canonical_franchise_id] (D9=A). The label is the
// franchise's CURRENT name - its most recent season's team_name from
// franchise_season_names (fallback to owner_display_name) - so the directory
// stays era-correct without asserting anything about owners. The gold charter
// seal marks charter slots; owner identity is not a stored fact and is never
// shown.
//
// Replaces the pre-build empty-state stub. charter-row.tsx on the community
// page already links here.
import { createAdminClient } from "@/lib/supabase/server";
import { getLeague, getViewer } from "@/lib/league";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MemberInvitePanel, type InviteFranchise } from "@/components/members/member-invite-panel";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

type FranchiseRow = {
  canonical_franchise_id: string;
  owner_display_name: string;
  charter_member: boolean;
};

type SeasonNameRow = {
  canonical_franchise_id: string;
  season: number;
  team_name: string;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Members - ${id}` };
}

function CharterSeal() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="flex-shrink-0">
      <circle cx="6" cy="6" r="5.25" fill="none" stroke="var(--vault-gold-dim)" strokeWidth="1" />
      <circle cx="6" cy="6" r="1.75" fill="var(--vault-gold-dim)" />
    </svg>
  );
}

export default async function MembersPage({ params }: Props) {
  const { id } = await params;
  const league = await getLeague(id);
  if (!league) notFound();
  const admin = createAdminClient();
  const viewer = await getViewer(id);

  const { data: franchisesData } = (await admin
    .from("franchises")
    .select("canonical_franchise_id, owner_display_name, charter_member")
    .eq("league_id", league.id)
    .order("canonical_franchise_id", { ascending: true })) as { data: FranchiseRow[] | null };

  // Commissioner-only: the franchise uuids + current linkage state feed the invite
  // control. Fetched only when the viewer is the commissioner so the public surface and
  // its query are unchanged for everyone else.
  let inviteFranchises: InviteFranchise[] = [];
  if (viewer.isCommissioner) {
    const { data: linkRows } = (await admin
      .from("franchises")
      .select("id, canonical_franchise_id, owner_display_name, member_user_id")
      .eq("league_id", league.id)
      .order("canonical_franchise_id", { ascending: true })) as {
      data: { id: string; canonical_franchise_id: string; owner_display_name: string; member_user_id: string | null }[] | null;
    };
    inviteFranchises = (linkRows ?? []).map((f) => ({
      id: f.id,
      name: f.owner_display_name,
      linked: !!f.member_user_id,
    }));
  }

  const franchises = franchisesData ?? [];

  // Current name per slot = the most recent season's team_name. One pass over
  // the league's season-names, keeping the max-season name for each slot.
  const { data: seasonNamesData } = (await admin
    .from("franchise_season_names")
    .select("canonical_franchise_id, season, team_name")
    .eq("league_id", league.id)) as { data: SeasonNameRow[] | null };

  const currentNameByCfid = new Map<string, string>();
  const latestSeasonByCfid = new Map<string, number>();
  for (const r of seasonNamesData ?? []) {
    const seen = latestSeasonByCfid.get(r.canonical_franchise_id) ?? -1;
    if (r.season > seen) {
      latestSeasonByCfid.set(r.canonical_franchise_id, r.season);
      currentNameByCfid.set(r.canonical_franchise_id, r.team_name);
    }
  }

  return (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">

        <div className="mb-12">
          <h1
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: "2.2rem", letterSpacing: "0.03em" }}
          >
            Members
          </h1>
          <div className="mt-3" style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }} />
          <p className="font-ui text-sm text-vault-text2 mt-4 max-w-2xl leading-relaxed">
            Every franchise in {league.name}. Each office holds that franchise&apos;s full record and trophies.
          </p>
        </div>

        {franchises.length === 0 ? (
          /* Principled silence per section 9 anti-pattern. */
          <div className="vault-card text-center py-16">
            <p
              className="font-ceremonial font-light text-vault-text2 italic"
              style={{ fontSize: "1.2rem" }}
            >
              The members area opens with the first founding session.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {franchises.map((f) => {
              const name =
                currentNameByCfid.get(f.canonical_franchise_id) ?? f.owner_display_name;
              return (
                <Link
                  key={f.canonical_franchise_id}
                  href={`/league/${id}/members/${f.canonical_franchise_id}`}
                  className="group block px-5 py-4 transition-colors"
                  style={{
                    background: "var(--vault-s1)",
                    border: "1px solid rgba(139, 112, 53, 0.4)",
                    borderRadius: 4,
                    textDecoration: "none",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="font-ceremonial text-vault-text group-hover:text-vault-gold-dim transition-colors"
                      style={{ fontSize: "1.2rem", letterSpacing: "0.01em" }}
                    >
                      {name}
                    </span>
                    {f.charter_member && <CharterSeal />}
                  </div>
                  {f.charter_member && (
                    <span
                      className="font-mono text-vault-text3 block mt-1"
                      style={{ fontSize: "8px", letterSpacing: "0.15em" }}
                    >
                      CHARTER MEMBER
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {viewer.isCommissioner && inviteFranchises.length > 0 && (
          <MemberInvitePanel franchises={inviteFranchises} />
        )}

      </div>
    </main>
  );
}
