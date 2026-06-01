// src/app/league/[id]/members/page.tsx
// Members empty-state surface for v1.
//
// The Members tab in the top nav points to a principled empty state until
// the founding-session and member-office work lands. Language mirrors the
// Trophy Room empty state pattern - silence over speculation per Design
// Brief section 9 anti-pattern against "Nothing here yet" framings.
//
// When the actual Members surface is built (charter member row, record
// board, trophy wall per section 7.5), this stub is replaced wholesale.
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

type LeagueRow = { id: string; name: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Members - ${id}` };
}

export default async function MembersPage({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("leagues")
    .select("id, name")
    .eq("canonical_id", id)
    .maybeSingle() as { data: LeagueRow | null };

  if (!data) notFound();

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
          <div
            className="mt-3"
            style={{ width: 40, height: 1, background: "rgba(139, 112, 53, 0.4)" }}
          />
        </div>

        <div className="vault-card text-center py-16">
          <p
            className="font-ceremonial font-light text-vault-text2 italic"
            style={{ fontSize: "1.2rem" }}
          >
            The members area opens with the first founding session.
          </p>
        </div>

      </div>
    </main>
  );
}
