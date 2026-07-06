// src/components/room/provenance-toggle.tsx
// TROPHY HALL — the provenance toggle (first room to build it; the reusable pattern the
// Clubhouse and Coach Office retrofit later). A visible, all-viewers control that flips a
// room between its illustrated view and its provenance view. It holds NO data of its own —
// it renders one of two nodes the room supplies. The provenance node is the shipped fact
// layer itself, so the toggle REVEALS (never replaces) the record: the beauty hides nothing.
// (Brief section 4; dual-layer principle memo section 2.)
"use client";

import { useState, type ReactNode } from "react";

interface Props {
  illustrated: ReactNode;
  provenance: ReactNode;
}

export function ProvenanceToggle({ illustrated, provenance }: Props) {
  const [showProvenance, setShowProvenance] = useState(false);

  const btn = (active: boolean): React.CSSProperties => ({
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "10px",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    padding: "6px 14px",
    borderRadius: 3,
    cursor: "pointer",
    color: active ? "var(--vault-gold, #C9A84C)" : "var(--vault-text3, #514D47)",
    background: active ? "rgba(139, 112, 53, 0.12)" : "transparent",
    border: `1px solid ${active ? "rgba(139, 112, 53, 0.5)" : "var(--vault-rule, #3A3A44)"}`,
  });

  return (
    <div>
      <div
        role="group"
        aria-label="Trophy Hall view"
        style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", padding: "14px 0" }}
      >
        <button type="button" aria-pressed={!showProvenance} style={btn(!showProvenance)} onClick={() => setShowProvenance(false)}>
          Illustrated
        </button>
        <button type="button" aria-pressed={showProvenance} style={btn(showProvenance)} onClick={() => setShowProvenance(true)}>
          Provenance
        </button>
        <span
          className="font-ui"
          style={{ fontSize: "0.72rem", color: "var(--vault-text3, #514D47)", marginLeft: 6 }}
        >
          every object traces to a verified fact
        </span>
      </div>
      <div>{showProvenance ? provenance : illustrated}</div>
    </div>
  );
}
