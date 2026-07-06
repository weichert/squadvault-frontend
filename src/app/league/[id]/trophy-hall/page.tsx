// src/app/league/[id]/trophy-hall/page.tsx
// TROPHY HALL — SquadVault's fourth illustrated room (W.5 fact layer, shipped + live).
// A pure PRESENTATION of the trophy fact layer: the illustrated hall renders the shipped
// resolver output as trophy objects (viewer-relative, reflective), and the provenance toggle
// reveals the SAME fact layer — the shipped card/data renderings — so the beauty hides nothing.
// The room creates no fact and places no trophy the resolver did not return; where a fact is
// absent it shows honest emptiness. Reuses the room-agnostic RoomScene (objects overlay, no
// fork). The existing /trophy-room fact page persists unchanged. (Brief; principle memo 54062e7.)
import { promises as fs } from "fs";
import path from "path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { getLeague, getViewer } from "@/lib/league";
import type { RoomManifest } from "@/lib/room/types";
import { RoomScene } from "@/components/room/room-scene";
import { ProvenanceToggle } from "@/components/room/provenance-toggle";
import { TrophyHallGallery, type HallObject } from "@/components/trophy-room/trophy-hall-gallery";
import {
  loadChampionshipPackage,
  loadLiveRecords,
  loadSeasonAwards,
  loadPlayerAndAuctionAwards,
  loadGeneratedAwards,
  loadFoundersSeal,
  type LiveRecord,
} from "@/lib/trophy-room";
import {
  holderCanonical,
  isHeldByViewer,
  isFactBacked,
  resolveObjectArt,
} from "@/lib/trophy-room/viewer-holdings";
import { resolveObjectReceipt } from "@/lib/trophy-room/provenance-receipt";
import { ChampionshipPackage } from "@/components/trophy-room/championship-package";
import { LiveRecords } from "@/components/trophy-room/live-records";
import { SeasonAwards } from "@/components/trophy-room/season-awards";
import { PlayerAuctionAwards } from "@/components/trophy-room/player-auction-awards";
import { FoundersSeal } from "@/components/trophy-room/founders-seal";

// Live Supabase state; skip route-segment caching (the shipped trophy-room pattern).
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Trophy Hall - ${id}` };
}

// Only these three award slugs have landed illustrated art this cycle; everything else is a
// graceful text card (art still rolling out). The Oracle (docket 9) has facts but pending
// sundial art, so it maps to no slug -> text fallback.
const SLUG_BY_DOCKET: Record<number, string> = {
  3: "award_the_hammer",
  6: "award_the_benchwarmer",
  7: "award_the_clairvoyant",
};
const AVAILABLE_ART = new Set<string>(["award_the_hammer", "award_the_benchwarmer", "award_the_clairvoyant"]);

export default async function TrophyHallPage({ params }: Props) {
  const { id } = await params;
  const league = await getLeague(id);
  if (!league) notFound();
  const admin = createAdminClient();
  const viewer = await getViewer(id);

  // The shipped fact layer — identical calls to the fact page, so both layers are the same facts.
  const pkg = await loadChampionshipPackage(admin, league.id);
  const live = await loadLiveRecords(admin, league.id);
  const awards = await loadSeasonAwards(admin, league.id);
  const playerAuction = await loadPlayerAndAuctionAwards(admin, league.id);
  const generated = await loadGeneratedAwards(admin, league.id); // D-A read-only enumeration (3/6/7/9)
  const foundersSeal = await loadFoundersSeal(admin, league.id);

  // Viewer-relative composition (CO.3 approach; viewer-context.ts NOT modified). One additive
  // read yields BOTH the uuid->canonical holder map and the viewer's own canonical franchise.
  const uuidToCanonical = new Map<string, string>();
  let viewerCanonical: string | null = null;
  {
    const { data: frAll } = (await admin
      .from("franchises")
      .select("id, canonical_franchise_id, member_user_id")
      .eq("league_id", league.id)) as {
      data: { id: string; canonical_franchise_id: string; member_user_id: string | null }[] | null;
    };
    for (const f of frAll ?? []) {
      uuidToCanonical.set(f.id, f.canonical_franchise_id);
      if (viewer.userId && f.member_user_id === viewer.userId) viewerCanonical = f.canonical_franchise_id;
    }
  }

  // Resolver record -> displayed object, via the pure seam. no-fabrication: an award with no
  // fact is dropped (honest absence); art resolves illustrated-or-text.
  const toObject = (rec: LiveRecord, category: string): HallObject | null => {
    const present = rec.holders.length > 0 || rec.valueText !== "";
    if (!isFactBacked({ docketId: rec.docketId, present })) return null;
    const slug = SLUG_BY_DOCKET[rec.docketNumber];
    const art = slug ? resolveObjectArt(slug, AVAILABLE_ART) : ({ mode: "text", src: null } as const);
    const holderCanonicalIds = rec.holders
      .map((h) => holderCanonical(h, uuidToCanonical))
      .filter((x): x is string => x !== null);
    const top = rec.holders[0] ?? null;
    return {
      key: rec.docketId,
      title: rec.trophyName,
      winnerName: top?.name ?? null,
      season: top?.season ?? null,
      coHolders: Math.max(0, rec.holders.length - 1),
      art,
      isHeld: isHeldByViewer({ docketId: rec.docketId, holderCanonicalIds }, viewerCanonical),
      category,
    };
  };

  const objects: HallObject[] = [
    ...generated.map((r) => toObject(r, "Annual Awards")),
    ...live.records.map((r) => toObject(r, "Live Records")),
    ...awards.annual.map((r) => toObject(r, "Annual Awards")),
    ...awards.permanentCards.map((r) => toObject(r, "Permanent Records")),
    ...playerAuction.positional.map((r) => toObject(r, "Positional Records")),
    ...playerAuction.auction.map((r) => toObject(r, "Auction & Acquisition")),
  ].filter((x): x is HallObject => x !== null);

  // "Your hardware": the viewer's own held trophy takes the plinth; else the gallery's first.
  const heroKey = objects.find((o) => o.isHeld)?.key ?? null;

  // The manifest is data (geometry lives here, not in code) — the shipped room pattern.
  const manifest = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "public/trophy-hall/hotspots.json"), "utf8"),
  ) as RoomManifest;

  // Generated-award receipts for the provenance view, via the alignment seam (docket id keyed).
  const generatedById: Record<string, LiveRecord> = Object.fromEntries(
    generated.map((r) => [String(r.docketNumber), r]),
  );

  const illustrated = (
    <RoomScene
      masterSrc="/trophy-hall/th_master_web.webp"
      masterAlt="The Trophy Hall - a Tahoe hall of glass cases and a central plinth"
      manifest={manifest}
      params={{ id }}
      objects={<TrophyHallGallery objects={objects} heroKey={heroKey} />}
    />
  );

  const provenance = (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <p className="font-ui text-sm text-vault-text2 mb-8 max-w-2xl leading-relaxed">
          The record behind the hall. Every trophy above traces to a verified fact - entered into the
          record or commissioner attested - with its custody and history intact.
        </p>
        <FoundersSeal seal={foundersSeal} />
        <ChampionshipPackage pkg={pkg} />
        <LiveRecords live={live} />
        <SeasonAwards awards={awards} />
        <PlayerAuctionAwards awards={playerAuction} />

        {generated.length > 0 && (
          <section className="mb-12">
            <h2 className="font-mono" style={{ fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--vault-gold-dim)", marginBottom: 14 }}>
              Generated Awards
            </h2>
            <div className="space-y-4">
              {generated.map((r) => {
                const receipt = resolveObjectReceipt(String(r.docketNumber), generatedById, "CANONICAL");
                return (
                  <article key={receipt.docketId} style={{ background: "var(--vault-s1)", border: "1px solid rgba(139, 112, 53, 0.4)", borderRadius: 4, padding: "18px 24px" }}>
                    <p className="font-ceremonial text-vault-text" style={{ fontSize: "1.2rem" }}>{r.trophyName}</p>
                    <p className="font-ui text-vault-text2" style={{ fontSize: "0.85rem", marginTop: 4 }}>{r.qualification}</p>
                    {receipt.holders.length > 0 && (
                      // Ruling 1 (founder, G3): the generated-award numeric value has no
                      // confirmed unit, so we omit the bare figure and show award + winner
                      // only - silence over a misread number.
                      <p className="font-ceremonial text-vault-text" style={{ fontSize: "1rem", marginTop: 8 }}>
                        {receipt.holders.join(", ")}
                      </p>
                    )}
                    <p className="font-mono" style={{ fontSize: "9px", letterSpacing: "0.12em", color: "var(--vault-text3)", marginTop: 8 }}>
                      {receipt.docketId} · {receipt.provenanceLabel}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );

  return <ProvenanceToggle illustrated={illustrated} provenance={provenance} />;
}
