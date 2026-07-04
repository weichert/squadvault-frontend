import { getLeague } from "@/lib/league";
import { LockedRoom } from "@/components/ui/locked-room";
import { notFound } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import type { Metadata } from "next";
import { RoomScene } from "@/components/room/room-scene";
import type { RoomManifest } from "@/lib/room/types";

// Live Supabase state; skip route segment caching (matches the league pages).
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const league = await getLeague(id);
  if (!league) return { title: "Clubhouse" };
  return {
    title: `${league.name} — Clubhouse`,
    description: `The ${league.name} clubhouse.`,
  };
}

// Hotspot geometry is the manifest's job, not the component's. Read it at request
// time and hand the parsed shape to the room-agnostic scene.
async function loadManifest(): Promise<RoomManifest> {
  const p = path.join(process.cwd(), "public", "clubhouse", "hotspots.json");
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw) as RoomManifest;
}

export default async function ClubhousePage({ params }: Props) {
  const { id } = await params;
  const league = await getLeague(id);
  if (!league) notFound();
  if (league.status === "founding") {
    return <LockedRoom leagueName={league.name} />;
  }
  const manifest = await loadManifest();
  // Banner text is data-driven and never baked into the art (brief 1).
  // e.g. "PFL Buddies · Est. 1984".
  const bannerText = `${league.name} · Est. ${league.founding_year}`;
  return (
    <RoomScene
      masterSrc="/clubhouse/w2_master_web.webp"
      masterAlt={`${league.name} clubhouse`}
      manifest={manifest}
      params={{ id }}
      bannerText={bannerText}
    />
  );
}
