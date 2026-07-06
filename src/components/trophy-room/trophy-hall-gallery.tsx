// src/components/trophy-room/trophy-hall-gallery.tsx
// TROPHY HALL — the zone-anchored trophy-object gallery (RoomScene `objects` overlay). It
// composites the shipped fact layer into the hall's display surfaces: a hero on the central
// plinth, the league record arrayed across the flanking cases. Each object is illustrated
// (a landed plate) or a graceful text card (art still rolling out; the Oracle until its
// sundial art). Titles overlay at runtime (CO-R4); winner + year render outside the plate.
// The viewer's held trophies carry a subtle reflective accent — REFLECTIVE, a mark of what
// IS held, never a count, target, or progression (brief section 3; D-B zone-anchored, D-C).
//
// Presentational only: held-state and art-mode are precomputed by the page via the pure
// viewer-holdings seam. No coordinate pixel-registers to a painted object; placement is by
// display-surface ZONE, retunable at the G3 eyeball with zero API change.
import type { ReactNode } from "react";

export type HallObject = {
  key: string; // stable id (docket id)
  title: string; // trophy name — the runtime overlay text
  winnerName: string | null; // era-correct holder (rendered outside the plate)
  season: number | null; // holder season (data-driven; never baked)
  coHolders: number; // additional tied holders, for a quiet "+N" (a fact, not a score)
  art: { mode: "illustrated"; src: string } | { mode: "text"; src: null };
  isHeld: boolean; // reflective accent (precomputed via the pure seam)
  category: string; // shipped taxonomy group
};

const GOLD = "rgba(139, 112, 53, 0.5)";
const HELD_GLOW = "0 0 0 1px rgba(201, 168, 76, 0.85), 0 0 22px 2px rgba(201, 168, 76, 0.35)";

function Overlay({ o }: { o: HallObject }) {
  // Winner + year line: outside the plate, from data (manifest overlay policy). Co-holders
  // are stated as a fact ("shared"), never ranked.
  const line =
    o.winnerName != null
      ? `${o.winnerName}${o.season != null ? ` · ${o.season}` : ""}${o.coHolders > 0 ? ` · shared +${o.coHolders}` : ""}`
      : null;
  return (
    <>
      <p
        className="font-mono"
        style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--vault-gold, #C9A84C)", margin: "6px 0 0", textAlign: "center" }}
      >
        {o.title}
      </p>
      {line ? (
        <p className="font-ceremonial" style={{ fontSize: "0.8rem", color: "var(--vault-text2, #B8B2A8)", margin: "2px 0 0", textAlign: "center" }}>
          {line}
        </p>
      ) : (
        // Silence over speculation: no holder -> an honest empty line, never a guessed name.
        <p className="font-ceremonial italic" style={{ fontSize: "0.75rem", color: "var(--vault-text3, #514D47)", margin: "2px 0 0", textAlign: "center" }}>
          unclaimed
        </p>
      )}
    </>
  );
}

function ObjectCard({ o, hero = false }: { o: HallObject; hero?: boolean }) {
  const plateH = hero ? 168 : 92;
  return (
    <div
      style={{
        pointerEvents: "auto",
        width: hero ? 200 : 128,
        padding: "8px 8px 10px",
        borderRadius: 4,
        background: "rgba(20, 16, 12, 0.55)",
        border: `1px solid ${o.isHeld ? "rgba(201, 168, 76, 0.85)" : GOLD}`,
        boxShadow: o.isHeld ? HELD_GLOW : "none",
        backdropFilter: "blur(1px)",
      }}
      data-held={o.isHeld ? "true" : "false"}
    >
      {o.art.mode === "illustrated" ? (
        <img
          src={o.art.src}
          alt={o.title}
          draggable={false}
          style={{ display: "block", width: "auto", height: plateH, maxWidth: "100%", margin: "0 auto", objectFit: "contain" }}
        />
      ) : (
        // Graceful text card (art still rolling out / Oracle sundial pending): a dignified
        // plaque, never a broken image.
        <div
          style={{ height: plateH, display: "flex", alignItems: "center", justifyContent: "center", border: `1px dashed ${GOLD}`, borderRadius: 3 }}
        >
          <span className="font-ceremonial italic" style={{ fontSize: hero ? "1.1rem" : "0.85rem", color: "var(--vault-text2, #B8B2A8)", textAlign: "center", padding: "0 8px" }}>
            {o.title}
          </span>
        </div>
      )}
      <Overlay o={o} />
      {o.isHeld && (
        <p className="font-mono" style={{ fontSize: "8px", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--vault-gold, #C9A84C)", margin: "5px 0 0", textAlign: "center" }}>
          yours
        </p>
      )}
    </div>
  );
}

// Shelf placement is by display-surface ZONE (percent of the master), not per-object pixel
// registration. Left + right glass cases flank; the plinth carries the hero.
const ZONES = {
  plinth: { left: "50%", top: "56%", transform: "translate(-50%, -50%)" },
  leftCases: { left: "2.5%", top: "12%", width: "25%" },
  rightCases: { right: "2.5%", top: "12%", width: "25%" },
} as const;

function Shelf({ objects, side }: { objects: HallObject[]; side: "left" | "right" }) {
  const z = side === "left" ? ZONES.leftCases : ZONES.rightCases;
  return (
    <div style={{ position: "absolute", ...z, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", alignContent: "flex-start" }}>
      {objects.map((o) => (
        <ObjectCard key={o.key} o={o} />
      ))}
    </div>
  );
}

export function TrophyHallGallery({ objects, heroKey }: { objects: HallObject[]; heroKey: string | null }): ReactNode {
  const hero = objects.find((o) => o.key === heroKey) ?? objects[0] ?? null;
  const rest = objects.filter((o) => o !== hero);
  const mid = Math.ceil(rest.length / 2);
  const left = rest.slice(0, mid);
  const right = rest.slice(mid);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {hero && (
        <div style={{ position: "absolute", ...ZONES.plinth }}>
          <ObjectCard o={hero} hero />
        </div>
      )}
      <Shelf objects={left} side="left" />
      <Shelf objects={right} side="right" />
    </div>
  );
}
