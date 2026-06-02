// src/components/ui/charter-row.tsx
// Community page "Charter Members" row, per Design Brief section 7.1 - the
// founding members as small franchise name cards with a charter seal, so the
// community page reads as belonging to specific people. Server Component with
// its own data path, mirroring trophy-preview.tsx.
//
// Horizontal scroll on mobile per section VIII ("Charter member row horizontal
// scroll"). Renders null when no charter members are flagged - silence over
// speculation per section 9; the page's other blocks carry it.
//
// The seal mark reuses the small circular seal glyph idiom from docket-id.tsx
// (gold-dim ring + center dot) rather than introducing a new image asset.
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { getLeague } from "@/lib/league";

interface Props {
  leagueId: string; // canonical_id; internal id resolved via getLeague (cached)
}

type CharterMemberRow = {
  id: string;
  owner_display_name: string;
};

function CharterSeal() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="flex-shrink-0">
      <circle cx="6" cy="6" r="5.25" fill="none" stroke="var(--vault-gold-dim)" strokeWidth="1" />
      <circle cx="6" cy="6" r="1.75" fill="var(--vault-gold-dim)" />
    </svg>
  );
}

export async function CharterRow({ leagueId }: Props) {
  const league = await getLeague(leagueId);
  if (!league) return null;

  const admin = createAdminClient();

  const { data: charterData } = (await admin
    .from("franchises")
    .select("id, owner_display_name")
    .eq("league_id", league.id)
    .eq("charter_member", true)
    .order("owner_display_name", { ascending: true })) as {
    data: CharterMemberRow[] | null;
  };

  const members = charterData ?? [];
  if (members.length === 0) return null;

  return (
    <section className="mb-16">
      <Link
        href={`/league/${leagueId}/members`}
        className="group inline-block"
        style={{ textDecoration: "none" }}
      >
        <h2
          className="font-ceremonial font-light text-vault-text group-hover:text-vault-gold-dim transition-colors"
          style={{ fontSize: "1.5rem", letterSpacing: "0.03em" }}
        >
          Charter Members
        </h2>
      </Link>
      <div
        className="mt-3 mb-6"
        style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }}
      />

      {/* Horizontal scroll per section VIII; cards do not shrink. */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3"
            style={{
              background: "var(--vault-s1)",
              border: "1px solid rgba(139, 112, 53, 0.4)",
              borderRadius: 4,
            }}
          >
            <CharterSeal />
            <div className="flex flex-col">
              <span
                className="font-ceremonial text-vault-text"
                style={{ fontSize: "0.95rem", letterSpacing: "0.01em", whiteSpace: "nowrap" }}
              >
                {m.owner_display_name}
              </span>
              <span
                className="font-mono text-vault-text3"
                style={{ fontSize: "8px", letterSpacing: "0.15em" }}
              >
                CHARTER MEMBER
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
