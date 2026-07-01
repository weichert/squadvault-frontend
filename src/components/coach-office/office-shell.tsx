// src/components/coach-office/office-shell.tsx
// Coach Office shell. Renders a NEUTRAL PLACEHOLDER scene at the manifest's aspect
// ratio, overlays each hotspot at a position COMPUTED from the manifest (pixel coords
// -> percentage of image_width/image_height), and opens a modal on activation. Below
// the md breakpoint it renders a hotspot list fallback with >=44px tap targets. All
// geometry comes from the passed-in HotspotMap; this component carries no coordinate
// literal.
//
// Phase 2: an optional `content` map keyed by hotspot_id supplies the modal body for
// personalized hotspots (Trophy Case, Ring Box). Hotspots without an entry fall back
// to the placeholder modal (board, photos, cutout - later phases).
"use client";

import { useState, type ReactNode } from "react";
import type { Hotspot, HotspotMap } from "@/lib/coach-office/types";
import { HotspotModal } from "./hotspot-modal";

function pct(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

export function OfficeShell({
  map,
  content,
}: {
  map: HotspotMap;
  content?: Record<string, ReactNode>;
}) {
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <>
      {/* Desktop / tablet: interactive placeholder scene with positioned hotspots. */}
      <div
        role="group"
        aria-label="Coach office room"
        className="hidden md:block relative w-full overflow-hidden"
        style={{
          aspectRatio: `${map.image_width} / ${map.image_height}`,
          background: "var(--vault-s1)",
          border: "1px solid var(--vault-border)",
          borderRadius: "var(--vault-radius, 4px)",
        }}
      >
        {/* Neutral placeholder scene marker (no artwork in Phase 1). */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p
            className="font-ceremonial italic text-vault-text3"
            style={{ fontSize: "1rem" }}
          >
            Placeholder scene
          </p>
        </div>

        {map.hotspots.map((h) => {
          // hover_behavior is consumed from data: soft_glow hotspots brighten on
          // hover; cursor_only hotspots do not. Either way the region is clickable.
          const isHovered = hoveredId === h.hotspot_id;
          const glow = h.hover_behavior === "soft_glow" && isHovered;
          return (
            <button
              key={h.hotspot_id}
              type="button"
              aria-label={h.label}
              onClick={() => setSelected(h)}
              onMouseEnter={() => setHoveredId(h.hotspot_id)}
              onMouseLeave={() =>
                setHoveredId((cur) => (cur === h.hotspot_id ? null : cur))
              }
              onFocus={() => setHoveredId(h.hotspot_id)}
              onBlur={() =>
                setHoveredId((cur) => (cur === h.hotspot_id ? null : cur))
              }
              className="absolute font-mono transition-colors"
              style={{
                left: pct(h.x, map.image_width),
                top: pct(h.y, map.image_height),
                width: pct(h.width, map.image_width),
                height: pct(h.height, map.image_height),
                border: "1px dashed var(--vault-gold-dim)",
                background: glow
                  ? "rgba(139, 112, 53, 0.16)"
                  : "rgba(139, 112, 53, 0.06)",
                color: "var(--vault-text2)",
                fontSize: "9px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {h.label}
            </button>
          );
        })}
      </div>

      {/* Mobile: hotspot-list fallback. Each row is a >=44px tap target. */}
      <div className="md:hidden">
        <p className="font-mono text-[9px] tracking-[0.15em] text-vault-text3 mb-4">
          ROOM FEATURES
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="space-y-3">
          {map.hotspots.map((h) => (
            <li key={h.hotspot_id}>
              <button
                type="button"
                aria-label={h.label}
                onClick={() => setSelected(h)}
                className="w-full vault-card flex items-center text-left hover:border-vault-gold-dim transition-colors"
                style={{ minHeight: 44 }}
              >
                <span className="font-ui text-sm text-vault-text">{h.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected && (
        <HotspotModal
          hotspot={selected}
          content={content?.[selected.hotspot_id]}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
