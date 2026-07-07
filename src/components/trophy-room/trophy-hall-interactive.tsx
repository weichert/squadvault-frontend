// src/components/trophy-room/trophy-hall-interactive.tsx
// TROPHY HALL v2 — the interactive objects overlay (RoomScene `objects` layer). Three layers:
// room (trophies resting on the lit glass shelves, per case) -> category (a case click opens its
// group) -> trophy detail (enlarged plate + runtime overlay + the mark-movement history + a per-
// trophy provenance toggle revealing the shipped, object-aligned receipt). Reuses the shipped
// RoomModal (accessible dialog) + ProvenanceToggle, no fork. Placement + receipts come pre-computed
// from the pure hall-cases seam + the page (the fact layer is consumed, never rebuilt). The
// Championship Belt carries its NATIVE custody receipt (Option 1); Ring/League Trophy stay in the
// record view. Reflective viewer emphasis only — no counts, no progression.
"use client";

import { useState } from "react";
import { RoomModal } from "@/components/room/room-modal";
import { ProvenanceToggle } from "@/components/room/provenance-toggle";
import { placeObjects, type HallObject, type HallCase } from "@/lib/trophy-room/hall-cases";
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
  cases: HallCase[];
  objects: HallObject[];
  receiptsByKey: Record<string, Receipt>;
  heroKey: string | null;
  imageWidth: number;
  imageHeight: number;
  belt?: BeltDetail | null;
}

const GOLD = "var(--vault-gold, #C9A84C)";
const HELD_RING = "0 0 0 1px rgba(201, 168, 76, 0.85), 0 0 18px 2px rgba(201, 168, 76, 0.3)";
const pct = (v: number, extent: number) => `${(v / extent) * 100}%`;

// ── visual trophy (rests on a shelf / in the modal; visual only — the case captures the click) ──
// h = "fill" makes the object fill its shelf band (large, scales with the room — the furnished-room
// tune); a number is a fixed pixel height (modal grid + plinth hero).
function ShelfTrophy({ o, h }: { o: HallObject; h: number | "fill" }) {
  const fill = h === "fill";
  const glow = o.isHeld ? "drop-shadow(0 0 8px rgba(201,168,76,0.6))" : "none";
  return (
    <div
      data-held={o.isHeld ? "true" : "false"}
      style={{ height: fill ? "100%" : undefined, flex: fill ? "1 1 0" : undefined, minWidth: fill ? 0 : undefined, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}
    >
      {o.art.mode === "illustrated" ? (
        <img src={o.art.src} alt={o.title} draggable={false} style={{ height: fill ? "116%" : (h as number), width: "auto", maxWidth: "100%", objectFit: "contain", objectPosition: "bottom", filter: glow }} />
      ) : (
        <div style={{ height: fill ? "82%" : (h as number), width: fill ? "94%" : undefined, minWidth: fill ? undefined : (h as number) * 0.7, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px", border: `1px solid ${o.isHeld ? "rgba(201,168,76,0.85)" : "rgba(139,112,53,0.55)"}`, borderRadius: 3, background: "linear-gradient(180deg, rgba(30,24,16,0.55), rgba(16,12,8,0.7))", boxShadow: o.isHeld ? HELD_RING : "inset 0 1px 0 rgba(201,168,76,0.15)" }}>
          <span className="font-ceremonial italic" style={{ fontSize: fill ? "clamp(0.6rem, 1.15vw, 1rem)" : "0.62rem", color: "var(--vault-text, #E8E2D4)", textAlign: "center", lineHeight: 1.15 }}>{o.title}</span>
        </div>
      )}
    </div>
  );
}

// ── the enlarged plate/text for the detail view ──
function EnlargedTrophy({ o }: { o: HallObject }) {
  return o.art.mode === "illustrated" ? (
    <img src={o.art.src} alt={o.title} draggable={false} style={{ height: 260, width: "auto", maxWidth: "100%", objectFit: "contain", margin: "0 auto", display: "block" }} />
  ) : (
    <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed rgba(139,112,53,0.5)", borderRadius: 4, margin: "0 auto", maxWidth: 320 }}>
      <span className="font-ceremonial italic" style={{ fontSize: "1.3rem", color: "var(--vault-text2, #B8B2A8)" }}>{o.title}</span>
    </div>
  );
}

const LABEL = { fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "var(--vault-text3, #514D47)" };

// ── the detail body for a LiveRecord-backed trophy: enlarged + overlay + history, toggle -> receipt ──
function LiveRecordDetail({ o, receipt }: { o: HallObject; receipt: Receipt | undefined }) {
  const winnerLine = o.winnerName != null ? `${o.winnerName}${o.season != null ? ` · ${o.season}` : ""}${o.coHolders > 0 ? ` · shared +${o.coHolders}` : ""}` : "unclaimed";
  const illustrated = (
    <div style={{ textAlign: "center" }}>
      <EnlargedTrophy o={o} />
      <p className="font-mono" style={{ ...LABEL, color: GOLD, marginTop: 12 }}>{o.title}</p>
      <p className="font-ceremonial" style={{ fontSize: "1.05rem", color: "var(--vault-text, #E8E2D4)", marginTop: 4 }}>{winnerLine}</p>
      {o.isHeld && <p className="font-mono" style={{ ...LABEL, color: GOLD, marginTop: 6 }}>yours</p>}
      {receipt && receipt.history.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "left", maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
          <p className="font-mono" style={{ ...LABEL, marginBottom: 6 }}>How the mark moved</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {receipt.history.map((h, i) => (
              <li key={i} className="font-ui" style={{ fontSize: "0.8rem", color: "var(--vault-text2, #B8B2A8)", padding: "3px 0", borderTop: i === 0 ? "none" : "1px solid var(--vault-border)" }}>
                <span className="font-mono" style={{ color: "var(--vault-text3)" }}>{h.season}</span>  {h.valueText}
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

export function TrophyHallInteractive({ cases, objects, receiptsByKey, heroKey, imageWidth, imageHeight, belt }: Props) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openTrophy, setOpenTrophy] = useState<HallObject | null>(null);
  const [returnTo, setReturnTo] = useState<"room" | "category">("room");

  const { placements } = placeObjects(objects, cases);
  const hero = objects.find((o) => o.key === heroKey) ?? null;
  const caseById = new Map(cases.map((c) => [c.id, c]));

  const openDetail = (o: HallObject, from: "room" | "category") => { setReturnTo(from); setOpenTrophy(o); };
  const closeDetail = () => { setOpenTrophy(null); if (returnTo === "room") setOpenCategory(null); };

  const isBelt = (o: HallObject) => belt != null && o.key === belt.docketId;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* Case click zones + the trophies resting on each case's shelves. */}
      {placements.map((p) => {
        const c = caseById.get(p.caseId);
        if (!c) return null;
        return (
          <div key={p.caseId}>
            <button
              type="button"
              aria-label={`${c.label} — open the group`}
              onClick={() => setOpenCategory(c.category)}
              style={{ position: "absolute", left: pct(c.zone.x, imageWidth), top: pct(c.zone.y, imageHeight), width: pct(c.zone.width, imageWidth), height: pct(c.zone.height, imageHeight), background: "transparent", border: "none", cursor: "pointer", pointerEvents: "auto" }}
            />
            {p.shelves.map((shelfObjs, i) => {
              const s = c.shelves[i];
              if (!s || shelfObjs.length === 0) return null;
              return (
                <div key={i} style={{ position: "absolute", left: pct(s.x, imageWidth), top: pct(s.y, imageHeight), width: pct(s.width, imageWidth), height: pct(s.height, imageHeight), display: "flex", alignItems: "flex-end", justifyContent: "space-evenly", gap: "5%", pointerEvents: "none" }}>
                  {shelfObjs.map((o) => <ShelfTrophy key={o.key} o={o} h="fill" />)}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* The plinth hero — the viewer's own ("YOURS"); click opens its detail directly (D-3). */}
      {hero && (
        <button
          type="button"
          aria-label={`${hero.title} — your hardware; open detail`}
          onClick={() => openDetail(hero, "room")}
          style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", background: "transparent", border: "none", cursor: "pointer", pointerEvents: "auto" }}
        >
          <ShelfTrophy o={hero} h={150} />
          <span className="font-mono" style={{ ...LABEL, color: GOLD, display: "block", marginTop: 6 }}>{hero.isHeld ? "yours" : hero.title}</span>
        </button>
      )}

      {/* Category modal — the case's full group (viewer's held first). */}
      {openTrophy === null && openCategory !== null && (() => {
        const c = cases.find((x) => x.category === openCategory);
        const group = objects.filter((o) => o.category === openCategory);
        const ordered = [...group.filter((o) => o.isHeld), ...group.filter((o) => !o.isHeld)];
        return (
          <div style={{ pointerEvents: "auto" }}>
            <RoomModal title={c?.label ?? openCategory} onClose={() => setOpenCategory(null)}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
                {ordered.map((o) => (
                  <button key={o.key} type="button" onClick={() => openDetail(o, "category")}
                    style={{ background: "rgba(20,16,12,0.4)", border: `1px solid ${o.isHeld ? "rgba(201,168,76,0.85)" : "rgba(139,112,53,0.4)"}`, borderRadius: 4, padding: "10px 8px", cursor: "pointer", textAlign: "center", boxShadow: o.isHeld ? HELD_RING : "none" }}>
                    <ShelfTrophy o={o} h={70} />
                    <p className="font-mono" style={{ ...LABEL, color: GOLD, marginTop: 8 }}>{o.title}</p>
                    <p className="font-ceremonial" style={{ fontSize: "0.75rem", color: "var(--vault-text2)", marginTop: 2 }}>{o.winnerName ?? "unclaimed"}{o.winnerName && o.season != null ? ` · ${o.season}` : ""}</p>
                  </button>
                ))}
              </div>
            </RoomModal>
          </div>
        );
      })()}

      {/* Trophy detail — enlarged + history + provenance toggle (object-aligned receipt). */}
      {openTrophy !== null && (
        <div style={{ pointerEvents: "auto" }}>
          <RoomModal title={openTrophy.title} onClose={closeDetail}>
            {isBelt(openTrophy) && belt ? (
              <BeltDetailView belt={belt} />
            ) : (
              <LiveRecordDetail o={openTrophy} receipt={receiptsByKey[openTrophy.key]} />
            )}
          </RoomModal>
        </div>
      )}
    </div>
  );
}
