// src/components/trophy-room/trophy-hall-interactive.tsx
// TROPHY ROOM — the interactive objects overlay (RoomScene `objects` layer), pivoted to the
// baked Living Room (the G1/G2 rulings). The room master carries its trophies IN THE ART; this
// layer is pure navigation over it: one click zone per painted case (runtime label over the
// painted header plaque — CO-R4, nothing baked) and the League Trophy on the central plinth
// (D-PLINTH: communal perpetual, reigning champion up front, the full champion roll in its
// detail; the Ring is a Championship-case object, never the plinth). A case click opens the
// frontal CASE VIEW overlay (D-CASE-NAV: RoomModal, never a route); a trophy click stacks the
// detail above it (Escape closes top-first, the shipped v2 contract). Details reuse the
// shipped RoomModal + ProvenanceToggle + object-aligned receipts — the fact layer is consumed,
// never rebuilt. Reflective viewer emphasis only — no counts, no progression.
"use client";

import { useState } from "react";
import { RoomModal } from "@/components/room/room-modal";
import { ProvenanceToggle } from "@/components/room/provenance-toggle";
import { categoryObjects, type HallObject } from "@/lib/trophy-room/hall-cases";
import {
  CATEGORY_NOTES,
  formatMarkValue,
  LEAGUE_TROPHY_KEY,
  TROPHY_RING_KEY,
  type CaseViewGeometry,
  type PlinthModel,
  type Rect,
  type RoomCaseZone,
} from "@/lib/trophy-room/case-view-bands";
import { CaseView, EnlargedTrophy, GOLD, LABEL } from "@/components/trophy-room/case-view";
import type { Receipt } from "@/lib/trophy-room/provenance-receipt";
import type { BeltTransfer } from "@/lib/trophy-room";

export type BeltDetail = {
  docketId: string; // TR-CP-1
  currentHolderName: string | null;
  currentSeason: number | null;
  transferCount: number;
  chain: BeltTransfer[]; // newest-first custody ledger
};

interface Props {
  cases: RoomCaseZone[]; // the painted cases' click zones (manifest data)
  objects: HallObject[];
  receiptsByKey: Record<string, Receipt>;
  imageWidth: number;
  imageHeight: number;
  belt?: BeltDetail | null;
  plinth: PlinthModel | null; // the League Trophy model; null = honest emptiness
  plinthZone: Rect | null; // the pedestal's manifest zone
  caseView: CaseViewGeometry; // the frontal render's five measured bands
}

const pct = (v: number, extent: number) => `${(v / extent) * 100}%`;

// ── the detail body for a LiveRecord-backed trophy: enlarged + overlay + history, toggle -> receipt ──
function LiveRecordDetail({ o, receipt }: { o: HallObject; receipt: Receipt | undefined }) {
  const winnerLine = o.winnerName != null ? `${o.winnerName}${o.season != null ? ` · ${o.season}` : ""}${o.coHolders > 0 ? ` · shared +${o.coHolders}` : ""}` : "unclaimed";
  const illustrated = (
    <div style={{ textAlign: "center" }}>
      <EnlargedTrophy o={o} />
      <p className="font-mono" style={{ ...LABEL, color: GOLD, marginTop: 12 }}>{o.title}</p>
      <p className="font-ceremonial" style={{ fontSize: "1.05rem", color: "var(--vault-text, #E8E2D4)", marginTop: 4 }}>{winnerLine}</p>
      {o.isHeld && <p className="font-mono" style={{ ...LABEL, color: GOLD, marginTop: 6 }}>yours</p>}
      {o.description && (
        <p className="font-ui" style={{ fontSize: "0.9rem", color: "var(--vault-text2, #B8B2A8)", lineHeight: 1.55, marginTop: 14, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>{o.description}</p>
      )}
      {receipt && receipt.history.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "left", maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
          <p className="font-mono" style={{ ...LABEL, marginBottom: 6 }}>How the mark moved</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {receipt.history.map((h, i) => (
              <li key={i} className="font-ui" style={{ fontSize: "0.8rem", color: "var(--vault-text2, #B8B2A8)", padding: "3px 0", borderTop: i === 0 ? "none" : "1px solid var(--vault-border)" }}>
                <span className="font-mono" style={{ color: "var(--vault-text3)" }}>{h.season}</span>  {formatMarkValue(h.valueText)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
  const provenance = receipt ? (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <p className="font-ceremonial" style={{ fontSize: "1.1rem", color: "var(--vault-text)" }}>{o.title}</p>
      {receipt.holders.length > 0 && <p className="font-ceremonial" style={{ fontSize: "0.95rem", color: "var(--vault-text2)", marginTop: 4 }}>{receipt.holders.join(", ")}</p>}
      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 12 }}>
        <span className="font-mono" style={{ fontSize: "9px", letterSpacing: "0.12em", color: "#8B7035", border: "1px solid rgba(139,112,53,0.5)", padding: "3px 8px", borderRadius: 3 }}>{receipt.provenanceLabel}</span>
      </div>
      <p className="font-mono" style={{ ...LABEL, marginTop: 10 }}>{receipt.docketId}</p>
    </div>
  ) : (
    <p className="font-ceremonial italic" style={{ color: "var(--vault-text2)" }}>The record doesn&rsquo;t hold that.</p>
  );
  return <ProvenanceToggle illustrated={illustrated} provenance={provenance} />;
}

// ── the Belt's NATIVE detail (Option 1): custody chain + ATTESTED two-tier badge + TR-CP-1 ──
function BeltDetailView({ belt }: { belt: BeltDetail }) {
  const holderLine = belt.currentHolderName ? `${belt.currentHolderName}${belt.currentSeason != null ? ` · ${belt.currentSeason}` : ""}` : "No holder recorded yet.";
  const illustrated = (
    <div style={{ textAlign: "center" }}>
      <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed rgba(139,112,53,0.5)", borderRadius: 4, margin: "0 auto", maxWidth: 320 }}>
        <span className="font-ceremonial italic" style={{ fontSize: "1.3rem", color: "var(--vault-text2)" }}>The Belt</span>
      </div>
      <p className="font-mono" style={{ ...LABEL, marginTop: 12 }}>Current holder (derived)</p>
      <p className="font-ceremonial" style={{ fontSize: "1.05rem", color: "var(--vault-text)", marginTop: 4 }}>{holderLine}</p>
      {belt.chain.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "left", maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
          <p className="font-mono" style={{ ...LABEL, marginBottom: 6 }}>How the mark moved</p>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {belt.chain.map((t, i) => (
              <li key={i} className="font-ui" style={{ fontSize: "0.8rem", color: "var(--vault-text2)", padding: "4px 0", borderTop: i === 0 ? "none" : "1px solid var(--vault-border)" }}>
                <span className="text-vault-text">{t.toName ?? "an unnamed franchise"}</span> held it from {t.season}{t.week != null ? ` W${t.week}` : ""}{t.fromName ? <> — taken from {t.fromName}</> : <> — first held</>}
                {t.occasion && <span className="italic" style={{ color: "var(--vault-text3)", display: "block", marginTop: 2 }}>&ldquo;{t.occasion}&rdquo;</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
  const provenance = (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <p className="font-ceremonial" style={{ fontSize: "1.1rem", color: "var(--vault-text)" }}>The Belt</p>
      <p className="font-ui" style={{ fontSize: "0.85rem", color: "var(--vault-text2)", marginTop: 4 }}>The traveling championship, passed to each new champion — a manually-ratified custody ledger.</p>
      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 12 }}>
        <span className="font-mono" style={{ fontSize: "9px", letterSpacing: "0.12em", color: "#3B7A7A", border: "1px solid rgba(59,122,122,0.5)", padding: "3px 8px", borderRadius: 3 }}>ATTESTED · Not Canonical</span>
      </div>
      <p className="font-mono" style={{ ...LABEL, marginTop: 10 }}>{belt.docketId}</p>
    </div>
  );
  return <ProvenanceToggle illustrated={illustrated} provenance={provenance} />;
}

// ── the champion-roll detail, shared by the League Trophy (plinth) and the Ring (case).
// Both derive off the same shipped champion record; the framing differs (communal perpetual
// vs mint-and-keep). Honest gaps render the shipped "an unnamed franchise" idiom.
function RollDetail({ title, framing, plinth }: { title: string; framing: string; plinth: PlinthModel | null }) {
  const illustrated = plinth ? (
    <div style={{ textAlign: "center" }}>
      <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed rgba(139,112,53,0.5)", borderRadius: 4, margin: "0 auto", maxWidth: 320 }}>
        <span className="font-ceremonial italic" style={{ fontSize: "1.3rem", color: "var(--vault-text2)" }}>{title}</span>
      </div>
      <p className="font-mono" style={{ ...LABEL, marginTop: 12 }}>Reigning champion</p>
      <p className="font-ceremonial" style={{ fontSize: "1.05rem", color: "var(--vault-text)", marginTop: 4 }}>
        {plinth.reigningName ?? "an unnamed franchise"}{plinth.reigningSeason != null ? ` · ${plinth.reigningSeason}` : ""}
      </p>
      <div style={{ marginTop: 16, textAlign: "left", maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
        <p className="font-mono" style={{ ...LABEL, marginBottom: 6 }}>The roll of champions</p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {plinth.roll.map((c, i) => (
            <li key={i} className="font-ui" style={{ fontSize: "0.8rem", color: "var(--vault-text2, #B8B2A8)", padding: "3px 0", borderTop: i === 0 ? "none" : "1px solid var(--vault-border)" }}>
              <span className="font-mono" style={{ color: "var(--vault-text3)" }}>{c.season}</span>  {c.eraName ?? "an unnamed franchise"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  ) : (
    <p className="font-ceremonial italic" style={{ color: "var(--vault-text2)" }}>The record doesn&rsquo;t hold that.</p>
  );
  const provenance = (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <p className="font-ceremonial" style={{ fontSize: "1.1rem", color: "var(--vault-text)" }}>{title}</p>
      <p className="font-ui" style={{ fontSize: "0.85rem", color: "var(--vault-text2)", marginTop: 4 }}>{framing}</p>
      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 12 }}>
        <span className="font-mono" style={{ fontSize: "9px", letterSpacing: "0.12em", color: "#8B7035", border: "1px solid rgba(139,112,53,0.5)", padding: "3px 8px", borderRadius: 3 }}>CANONICAL</span>
      </div>
      <p className="font-mono" style={{ ...LABEL, marginTop: 10 }}>Derived from the championship record</p>
    </div>
  );
  return <ProvenanceToggle illustrated={illustrated} provenance={provenance} />;
}

export function TrophyHallInteractive({ cases, objects, receiptsByKey, imageWidth, imageHeight, belt, plinth, plinthZone, caseView }: Props) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openTrophy, setOpenTrophy] = useState<HallObject | null>(null);
  const [returnTo, setReturnTo] = useState<"room" | "case">("room");

  const openDetail = (o: HallObject, from: "room" | "case") => { setReturnTo(from); setOpenTrophy(o); };
  const closeDetail = () => { setOpenTrophy(null); if (returnTo === "room") setOpenCategory(null); };

  const isBelt = (o: HallObject) => belt != null && o.key === belt.docketId;

  // The plinth's object — synthesized for the detail flow; never enters a case group.
  const leagueTrophy: HallObject = {
    key: LEAGUE_TROPHY_KEY,
    title: "League Trophy",
    winnerName: plinth?.reigningName ?? null,
    season: plinth?.reigningSeason ?? null,
    coHolders: 0,
    art: { mode: "text", src: null },
    isHeld: false,
    category: "The Championship",
  };

  const openCase = cases.find((c) => c.category === openCategory) ?? null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* Case click zones over the painted cases — the full-case hit target. */}
      {cases.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-label={`${c.label} — open the case`}
          onClick={() => setOpenCategory(c.category)}
          style={{ position: "absolute", left: pct(c.zone.x, imageWidth), top: pct(c.zone.y, imageHeight), width: pct(c.zone.width, imageWidth), height: pct(c.zone.height, imageHeight), background: "transparent", border: "none", cursor: "pointer", pointerEvents: "auto", padding: 0 }}
        />
      ))}
      {/* The runtime category title sits ON its case's painted header plaque (N3 — written on
          the case, never floating above it). Centered on the plaque; the click is handled by
          the full-case button beneath. CO-R4: the plaques are blank in the art. */}
      {cases.map((c) => {
        const h = c.header ?? c.zone;
        return (
          <span
            key={`${c.id}-label`}
            className="font-mono"
            style={{ position: "absolute", left: pct(h.x + h.width / 2, imageWidth), top: pct(h.y + h.height / 2, imageHeight), transform: "translate(-50%, -50%)", fontSize: "clamp(0.38rem, 0.72vw, 0.6rem)", letterSpacing: "0.1em", textTransform: "uppercase", color: "#E8D9A8", textShadow: "0 1px 3px rgba(0,0,0,0.9)", whiteSpace: "nowrap", pointerEvents: "none" }}
          >
            {c.label}
          </span>
        );
      })}

      {/* The plinth — the League Trophy, the community's centerpiece (D-PLINTH). Honest
          emptiness when no champion is recorded: the pedestal stays bare. */}
      {plinth && plinthZone && (
        <button
          type="button"
          aria-label="League Trophy — the champions' perpetual; open the roll"
          onClick={() => openDetail(leagueTrophy, "room")}
          style={{ position: "absolute", left: pct(plinthZone.x, imageWidth), top: pct(plinthZone.y, imageHeight), width: pct(plinthZone.width, imageWidth), height: pct(plinthZone.height, imageHeight), background: "transparent", border: "none", cursor: "pointer", pointerEvents: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "17% 0 0" }}
        >
          <span className="font-mono" style={{ fontSize: "clamp(0.4rem, 0.75vw, 0.65rem)", letterSpacing: "0.14em", textTransform: "uppercase", color: GOLD, textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>League Trophy</span>
          <span className="font-ceremonial" style={{ fontSize: "clamp(0.55rem, 1vw, 0.85rem)", color: "var(--vault-text, #E8E2D4)", textShadow: "0 1px 2px rgba(0,0,0,0.8)", marginTop: 2 }}>
            {plinth.reigningName ?? "an unnamed franchise"}{plinth.reigningSeason != null ? ` · ${plinth.reigningSeason}` : ""}
          </span>
        </button>
      )}

      {/* The Case View — the frontal overlay (D-CASE-NAV: in the room, never a route). */}
      {openTrophy === null && openCategory !== null && (
        <div style={{ pointerEvents: "auto" }}>
          <CaseView
            geometry={caseView}
            label={openCase?.label ?? openCategory}
            objects={categoryObjects(objects, openCategory)}
            note={CATEGORY_NOTES[openCategory]}
            onOpenTrophy={(o) => openDetail(o, "case")}
            onClose={() => setOpenCategory(null)}
          />
        </div>
      )}

      {/* Trophy detail — stacks above the Case View (Escape closes top-first). */}
      {openTrophy !== null && (
        <div style={{ pointerEvents: "auto" }}>
          <RoomModal title={openTrophy.title} onClose={closeDetail}>
            {isBelt(openTrophy) && belt ? (
              <BeltDetailView belt={belt} />
            ) : openTrophy.key === LEAGUE_TROPHY_KEY ? (
              <RollDetail title="League Trophy" framing="The communal perpetual — it stays with the league; every champion's name accumulates on it." plinth={plinth} />
            ) : openTrophy.key === TROPHY_RING_KEY ? (
              <RollDetail title="The Ring" framing="Mint-and-keep — each champion keeps their own; the case shows the set the record has minted." plinth={plinth} />
            ) : (
              <LiveRecordDetail o={openTrophy} receipt={receiptsByKey[openTrophy.key]} />
            )}
          </RoomModal>
        </div>
      )}
    </div>
  );
}
