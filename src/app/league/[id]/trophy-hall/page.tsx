// src/app/league/[id]/trophy-hall/page.tsx
// TROPHY ROOM — SquadVault's illustrated trophy room, pivoted to the baked Living Room
// (the G1/G2 rulings). A pure PRESENTATION of the trophy fact layer: the baked master is the
// navigational scene (its painted trophies are ambience, not facts); every FACT renders at
// runtime — case labels over painted plaques, the League Trophy + reigning champion on the
// plinth (D-PLINTH), and the category's real trophies large on the Case View's five measured
// bands (D-BANDS). The provenance toggle reveals the SAME fact layer, and the full record
// (/trophy-room) stays one tap deeper (D-NAV; the re-homed reading-chair guarantee). The room
// creates no fact and places no trophy the resolver did not return; honest emptiness where a
// fact is absent. The existing /trophy-room fact page persists unchanged.
import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { getLeague, getViewer } from "@/lib/league";
import type { RoomManifest } from "@/lib/room/types";
import { RoomScene } from "@/components/room/room-scene";
import { ProvenanceToggle } from "@/components/room/provenance-toggle";
import { TrophyHallInteractive, type BeltDetail } from "@/components/trophy-room/trophy-hall-interactive";
import { buildReceiptsByKey, type HallObject } from "@/lib/trophy-room/hall-cases";
import {
  buildPlinth,
  championshipCaseObjects,
  type CaseViewGeometry,
  type Rect,
  type RoomCaseZone,
} from "@/lib/trophy-room/case-view-bands";
import {
  loadChampionshipPackage,
  loadLiveRecords,
  loadSeasonAwards,
  loadPlayerAndAuctionAwards,
  loadGeneratedAwards,
  loadFoundersSeal,
  TROPHY_BELT_ID,
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
  return { title: `Trophy Room - ${id}` };
}

// Award art + copy are keyed by the trophy's TITLE — the shipped award catalog
// (public/trophy-hall/award-catalog.json, the manifest's projection: id, title, definition)
// is the single source of truth. Every award now has a landed plate (award_<id>.webp). Titles
// are normalized (case/punctuation-insensitive) so a resolver title matches the catalog; an
// unmatched title falls through to the graceful text state — never a wrong or fabricated plate.
const normalizeTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^the/, "");
type AwardCatalogEntry = {
  id: string;
  title: string;
  definition: string;
  lines?: string[];
  plaque?: { x: number; y: number; w: number; h: number };
  lightText?: boolean;
};

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

  // The award catalog — the manifest's shipped projection (id, title, definition). Art is a webp
  // per award id; the definition is the detail view's description. Consumed, never rebuilt.
  const catalog = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "public/trophy-hall/award-catalog.json"), "utf8"),
  ) as AwardCatalogEntry[];
  const slugByTitle = new Map(catalog.map((a) => [normalizeTitle(a.title), a.id]));
  const bySlug = new Map(catalog.map((a) => [a.id, a]));
  const availableArt = new Set(catalog.map((a) => a.id));
  // Resolve a trophy's plate + engraving data + description by its title; unmatched -> text state.
  const artFor = (title: string): Pick<HallObject, "art" | "description" | "plaque" | "titleLines" | "plaqueLight"> => {
    const slug = slugByTitle.get(normalizeTitle(title));
    const a = slug ? bySlug.get(slug) : undefined;
    return {
      art: slug ? resolveObjectArt(slug, availableArt) : ({ mode: "text", src: null } as const),
      description: a?.definition,
      plaque: a?.plaque,
      titleLines: a?.lines,
      plaqueLight: a?.lightText,
    };
  };

  // Resolver record -> displayed object PAIRED with its source record (the record feeds the
  // object-aligned detail receipt). no-fabrication: an award with no fact is dropped; art +
  // description resolve by title from the catalog (illustrated-or-text).
  const toPair = (rec: LiveRecord, category: string): { object: HallObject; record: LiveRecord } | null => {
    const present = rec.holders.length > 0 || rec.valueText !== "";
    if (!isFactBacked({ docketId: rec.docketId, present })) return null;
    const holderCanonicalIds = rec.holders
      .map((h) => holderCanonical(h, uuidToCanonical))
      .filter((x): x is string => x !== null);
    const top = rec.holders[0] ?? null;
    const object: HallObject = {
      key: rec.docketId,
      title: rec.trophyName,
      winnerName: top?.name ?? null,
      season: top?.season ?? null,
      coHolders: Math.max(0, rec.holders.length - 1),
      isHeld: isHeldByViewer({ docketId: rec.docketId, holderCanonicalIds }, viewerCanonical),
      category,
      ...artFor(rec.trophyName),
    };
    return { object, record: rec };
  };

  const pairs = [
    ...generated.map((r) => toPair(r, "Annual Awards")),
    ...live.records.map((r) => toPair(r, "Live Records")),
    ...awards.annual.map((r) => toPair(r, "Annual Awards")),
    ...awards.permanentCards.map((r) => toPair(r, "Permanent Records")),
    ...playerAuction.positional.map((r) => toPair(r, "Positional Records")),
    ...playerAuction.auction.map((r) => toPair(r, "Auction & Acquisition")),
  ].filter((x): x is { object: HallObject; record: LiveRecord } => x !== null);

  // The Championship case holds the Belt + the Ring (name-only, D-C); the League Trophy is
  // the plinth's communal perpetual and NEVER enters a case (D-PLINTH). The Belt keeps its
  // NATIVE custody receipt (Option 1: the BeltTransfer chain + ATTESTED + TR-CP-1).
  const belt: BeltDetail = {
    docketId: TROPHY_BELT_ID,
    currentHolderName: pkg.belt.currentHolderName,
    currentSeason: pkg.belt.currentSeason,
    transferCount: pkg.belt.transferCount,
    chain: pkg.belt.chain,
  };
  const plinth = buildPlinth(pkg.champions);

  // The Belt is a catalog award (its football plate + definition); the Ring has no single plate
  // (a minted set) -> honest text state via artFor's no-match path.
  const objects: HallObject[] = [
    ...pairs.map((p) => p.object),
    ...championshipCaseObjects(pkg).map((o) => ({ ...o, ...artFor(o.title) })),
  ];
  // Detail receipts, object-aligned via the shipped seam (LiveRecord awards; the Belt is native).
  const receiptsByKey = buildReceiptsByKey(pairs.map((p) => p.record));

  // The manifest is data (geometry lives here, not in code): case click zones + the plinth
  // zone on the master, and the Case View's five measured bands (the case_view block).
  const manifest = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "public/trophy-hall/hotspots.json"), "utf8"),
  ) as RoomManifest & { cases?: RoomCaseZone[]; plinth?: { zone: Rect }; case_view?: CaseViewGeometry };
  const cases: RoomCaseZone[] = manifest.cases ?? [];
  const caseView = manifest.case_view;

  // Generated-award receipts for the provenance view, via the alignment seam (docket id keyed).
  const generatedById: Record<string, LiveRecord> = Object.fromEntries(
    generated.map((r) => [String(r.docketNumber), r]),
  );

  const illustrated = (
    <div>
      <RoomScene
        masterSrc="/trophy-hall/tr_master_web.webp"
        masterAlt="The Trophy Room - a Tahoe room of six trophy cases, a whiskey corner, and the central plinth"
        manifest={manifest}
        params={{ id }}
        objects={
          caseView ? (
            <TrophyHallInteractive
              cases={cases}
              objects={objects}
              receiptsByKey={receiptsByKey}
              imageWidth={manifest.image_width}
              imageHeight={manifest.image_height}
              belt={belt}
              plinth={plinth}
              plinthZone={manifest.plinth?.zone ?? null}
              caseView={caseView}
            />
          ) : undefined
        }
      />
      {/* The full record, one tap deeper (D-NAV). This affordance re-homes the retired
          reading-chair hotspot's guarantee (G2 ruling 3): the room always reaches the
          complete record — the pin lives in trophy-hall-manifest.test.ts. */}
      <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
        <Link
          href={`/league/${id}/trophy-room`}
          className="font-mono"
          style={{ fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--vault-gold-dim, #8B7035)", textDecoration: "none", border: "1px solid rgba(139,112,53,0.4)", borderRadius: 3, padding: "6px 14px", display: "inline-block" }}
        >
          The full record →
        </Link>
      </div>
    </div>
  );

  const provenance = (
    <main style={{ background: "var(--vault-bg)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <p className="font-ui text-sm text-vault-text2 mb-8 max-w-2xl leading-relaxed">
          The record behind the room. Every trophy above traces to a verified fact - entered into the
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
