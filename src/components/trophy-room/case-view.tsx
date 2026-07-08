// src/components/trophy-room/case-view.tsx
// TROPHY ROOM pivot — the frontal CASE VIEW (the G1/G2 Living Room rulings). An in-room
// RoomModal overlay (D-CASE-NAV: never a routed sub-view — Escape returns the member to the
// room, standing where they were). The landed frontal render is the stage; the category's
// real trophies marquee LARGE on its five measured bands (the viewer's held first), award and
// holder text renders on the brass placards, the category name on the header plaque, and the
// numeral-free note on the lower panel (D-LOWER). The "See all" affordance flips to the
// shipped category grid — the same trophies, the same receipts, the complete set (D-BANDS:
// no pagination, no hidden facts). Geometry comes from the manifest case_view block; no
// coordinate lives in this file. Shared trophy visuals (ShelfTrophy / EnlargedTrophy) live
// here so the room overlay imports one direction only.
"use client";

import { useState } from "react";
import { RoomModal } from "@/components/room/room-modal";
import type { HallObject } from "@/lib/trophy-room/hall-cases";
import {
  selectMarquee,
  placeOnBands,
  placardLine,
  truncatePlacard,
  type CaseViewGeometry,
} from "@/lib/trophy-room/case-view-bands";

export const GOLD = "var(--vault-gold, #C9A84C)";
export const HELD_RING = "0 0 0 1px rgba(201, 168, 76, 0.85), 0 0 18px 2px rgba(201, 168, 76, 0.3)";
export const LABEL = { fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "var(--vault-text3, #514D47)" };
const pct = (v: number, extent: number) => `${(v / extent) * 100}%`;
// Clearance (image px) held between a band's trophy render and its label below (N2).
const BAND_GAP = 8;

// ── visual trophy (rests on a band / in the grid; visual only — the wrapper captures the
// click). h = "fill" fills its bounded band envelope (contained, never overflowing it — the
// caller's box enforces clearance from the label below and the band above, N2); a number is
// fixed px. The award name is NEVER drawn here: it lives once, on the single label unit below
// (N2 kills the old italic-name-box duplicate that overlapped the placard).
export function ShelfTrophy({ o, h }: { o: HallObject; h: number | "fill" }) {
  const fill = h === "fill";
  const glow = o.isHeld ? "drop-shadow(0 0 8px rgba(201,168,76,0.6))" : "none";
  if (o.art.mode === "illustrated") {
    return (
      <div data-held={o.isHeld ? "true" : "false"} style={{ height: fill ? "100%" : undefined, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <img src={o.art.src} alt={o.title} draggable={false} style={{ height: fill ? "100%" : (h as number), maxHeight: "100%", width: "auto", maxWidth: "100%", objectFit: "contain", objectPosition: "bottom", filter: glow }} />
      </div>
    );
  }
  // Text-state (art still rolling out): a dignified empty plate — no name baked in, honoring
  // the "graceful text state" as an object-on-glass rather than a repeated title. The single
  // label below carries award + holder + year (CO-R4: nothing baked here).
  return (
    <div data-held={o.isHeld ? "true" : "false"} style={{ height: fill ? "100%" : (h as number), width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ height: fill ? "82%" : (h as number), aspectRatio: "5 / 6", maxWidth: "86%", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${o.isHeld ? "rgba(201,168,76,0.85)" : "rgba(139,112,53,0.5)"}`, borderRadius: 3, background: "linear-gradient(180deg, rgba(30,24,16,0.5), rgba(16,12,8,0.66))", boxShadow: o.isHeld ? HELD_RING : "inset 0 1px 0 rgba(201,168,76,0.12)" }}>
        <span aria-hidden className="font-ceremonial" style={{ fontSize: fill ? "clamp(1rem, 3vw, 1.6rem)" : "1rem", lineHeight: 1, color: o.isHeld ? "rgba(201,168,76,0.7)" : "rgba(160,140,90,0.42)" }}>&#10087;</span>
      </div>
    </div>
  );
}

// ── the enlarged plate/text for the detail view ──
export function EnlargedTrophy({ o }: { o: HallObject }) {
  return o.art.mode === "illustrated" ? (
    <img src={o.art.src} alt={o.title} draggable={false} style={{ height: 260, width: "auto", maxWidth: "100%", objectFit: "contain", margin: "0 auto", display: "block" }} />
  ) : (
    <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed rgba(139,112,53,0.5)", borderRadius: 4, margin: "0 auto", maxWidth: 320 }}>
      <span className="font-ceremonial italic" style={{ fontSize: "1.3rem", color: "var(--vault-text2, #B8B2A8)" }}>{o.title}</span>
    </div>
  );
}

// The shipped category grid — the full-record affordance's body: the SAME trophies and
// receipts as the bands, just the complete set (objects arrive held-first).
function CategoryGrid({ objects, onOpenTrophy }: { objects: HallObject[]; onOpenTrophy: (o: HallObject) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
      {objects.map((o) => (
        <button key={o.key} type="button" onClick={() => onOpenTrophy(o)}
          style={{ background: "rgba(20,16,12,0.4)", border: `1px solid ${o.isHeld ? "rgba(201,168,76,0.85)" : "rgba(139,112,53,0.4)"}`, borderRadius: 4, padding: "10px 8px", cursor: "pointer", textAlign: "center", boxShadow: o.isHeld ? HELD_RING : "none" }}>
          <ShelfTrophy o={o} h={70} />
          <p className="font-mono" style={{ ...LABEL, color: GOLD, marginTop: 8 }}>{o.title}</p>
          <p className="font-ceremonial" style={{ fontSize: "0.75rem", color: "var(--vault-text2)", marginTop: 2 }}>{o.winnerName ?? "unclaimed"}{o.winnerName && o.season != null ? ` · ${o.season}` : ""}</p>
        </button>
      ))}
    </div>
  );
}

interface Props {
  geometry: CaseViewGeometry;
  label: string; // the case's category label (renders on the header plaque)
  objects: HallObject[]; // the COMPLETE category group, held-first (categoryObjects)
  note?: string; // the D-LOWER descriptive note; absent -> the panel stays blank
  onOpenTrophy: (o: HallObject) => void; // the detail stacks above (Escape closes top-first)
  onClose: () => void;
}

export function CaseView({ geometry, label, objects, note, onOpenTrophy, onClose }: Props) {
  const [showFullRecord, setShowFullRecord] = useState(false);
  const { marquee, total } = selectMarquee(objects);
  const bands = placeOnBands(marquee);
  const { image_width: W, image_height: H } = geometry;
  // The portrait case fits the viewport by height; width follows the render's aspect.
  const fitWidth = `min(100%, calc((100vh - 250px) * ${(W / H).toFixed(4)}))`;

  return (
    <RoomModal title={label} onClose={onClose} maxWidth={720}>
      {showFullRecord ? (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="font-mono" onClick={() => setShowFullRecord(false)}
            style={{ ...LABEL, color: GOLD, background: "transparent", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 12 }}>
            ← the case
          </button>
          <CategoryGrid objects={objects} onOpenTrophy={onOpenTrophy} />
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <div style={{ position: "relative", width: fitWidth, aspectRatio: `${W} / ${H}`, margin: "0 auto" }}>
            <img
              src="/trophy-hall/tr_case_frontal_web.webp"
              alt={`${label} — the display case`}
              draggable={false}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 4 }}
            />
            {/* Header plaque — the category name, runtime over the painted brass (CO-R4). The
                font scales to the PLAQUE width (container query), not the viewport, so even the
                longest title ("AUCTION & ACQUISITION") stays bounded by the plaque; overflow is
                clipped as a final guard. */}
            <div style={{ position: "absolute", left: pct(geometry.header_plaque.x, W), top: pct(geometry.header_plaque.y, H), width: pct(geometry.header_plaque.width, W), height: pct(geometry.header_plaque.height, H), display: "flex", alignItems: "center", justifyContent: "center", containerType: "inline-size", overflow: "hidden" }}>
              <span className="font-ceremonial" style={{ fontSize: "clamp(0.45rem, 6.5cqw, 1rem)", letterSpacing: "0.06em", textTransform: "uppercase", color: "#E8D9A8", textShadow: "0 1px 2px rgba(0,0,0,0.7)", whiteSpace: "nowrap" }}>{label}</span>
            </div>
            {/* The occupied bands (adaptive count, spread with vertical rhythm — N1). One
                trophy each, resting on its shelf; its render is bounded to the space ABOVE
                its label so nothing overlaps its own label or the band above (N2). */}
            {bands.map((band, i) => {
              const o = band[0];
              if (!o) return null;
              const b = geometry.bands[i];
              if (!b) return null;
              const renderHeight = Math.max(0, b.placard.y - BAND_GAP - b.shelf.y);
              return (
                <div key={o.key}>
                  <button
                    type="button"
                    aria-label={`${o.title} — open detail`}
                    onClick={() => onOpenTrophy(o)}
                    style={{ position: "absolute", left: pct(b.shelf.x, W), top: pct(b.shelf.y, H), width: pct(b.shelf.width, W), height: pct(renderHeight, H), display: "flex", alignItems: "flex-end", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    {/* Constrain the footprint so a text-state plate reads as an object on the
                        shelf, not a banner across the whole band. */}
                    <div style={{ height: "100%", width: "52%", display: "flex" }}>
                      <ShelfTrophy o={o} h="fill" />
                    </div>
                  </button>
                  {/* The single label unit — a SOLID engraved brass nameplate centered ON the
                      shelf's painted plate (the runtime title/holder sits on the placard, N-fix).
                      Opaque so it reads as a plate not floating text; content-hugging and clipped
                      so the text can never escape the plate's boundary. One label per slot,
                      cleared from the render above and the band below. */}
                  <div style={{ position: "absolute", left: pct(b.placard.x + b.placard.width / 2, W), top: pct(b.placard.y + b.placard.height / 2, H), transform: "translate(-50%, -50%)", maxWidth: "48%", padding: "3px 12px", borderRadius: 3, background: "linear-gradient(180deg, #4a3820, #2b2010)", border: "1px solid rgba(201,168,76,0.6)", boxShadow: "0 2px 5px rgba(0,0,0,0.55), inset 0 1px 0 rgba(201,168,76,0.25)", textAlign: "center", pointerEvents: "none", overflow: "hidden" }}>
                    <p className="font-mono" style={{ fontSize: "clamp(0.42rem, 1.3vw, 0.6rem)", letterSpacing: "0.1em", textTransform: "uppercase", color: "#E8D9A8", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{truncatePlacard(o.title, 22)}</p>
                    <p className="font-ceremonial" style={{ fontSize: "clamp(0.5rem, 1.5vw, 0.72rem)", color: "#E8E2D4", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{truncatePlacard(placardLine(o), 26)}</p>
                  </div>
                </div>
              );
            })}
            {/* Lower panel — the descriptive category note (never fact-bearing; blank fallback). */}
            {note && (
              <div style={{ position: "absolute", left: pct(geometry.lower_panel.x, W), top: pct(geometry.lower_panel.y, H), width: pct(geometry.lower_panel.width, W), height: pct(geometry.lower_panel.height, H), display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4%" }}>
                <span className="font-ceremonial italic" style={{ fontSize: "clamp(0.55rem, 1.6vw, 0.8rem)", color: "#D9CBA4", textAlign: "center", textShadow: "0 1px 2px rgba(0,0,0,0.7)", lineHeight: 1.3 }}>{note}</span>
              </div>
            )}
          </div>
          {/* The full-record affordance — the complete set, same truth, one tap (D-BANDS). */}
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button type="button" className="font-mono" onClick={() => setShowFullRecord(true)}
              style={{ ...LABEL, color: GOLD, background: "transparent", border: "1px solid rgba(139,112,53,0.5)", borderRadius: 3, cursor: "pointer", padding: "6px 14px" }}>
              See all {total} →
            </button>
          </div>
        </div>
      )}
    </RoomModal>
  );
}
