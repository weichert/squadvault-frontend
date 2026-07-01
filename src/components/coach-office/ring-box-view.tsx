// src/components/coach-office/ring-box-view.tsx
// Ring Box modal body - Phase 2. Renders one ring per championship the coach holds
// (derived, never invented). Empty box -> principled empty state. Presentational
// server component; rendered inside the (client) HotspotModal via the RSC slot pattern.
import type { CoachChampionship } from "@/lib/coach-office/resolvers";

export function RingBoxView({ rings }: { rings: CoachChampionship[] }) {
  if (rings.length === 0) {
    return (
      <p
        className="font-ceremonial font-light italic text-vault-text2 mt-4"
        style={{ fontSize: "1.05rem", lineHeight: 1.4 }}
      >
        The ring box is empty - no championship yet.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <p className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 mb-3">
        {rings.length} CHAMPIONSHIP {rings.length === 1 ? "RING" : "RINGS"}
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="space-y-2">
        {rings.map((r) => (
          <li
            key={r.season}
            className="flex items-baseline justify-between gap-4"
          >
            <span
              className="font-ceremonial text-vault-text"
              style={{ fontSize: "1.2rem", lineHeight: 1 }}
            >
              {r.season}
            </span>
            {r.teamName && (
              <span className="font-ui text-xs text-vault-text2 text-right">
                {r.teamName}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
