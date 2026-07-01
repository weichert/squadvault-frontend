// src/components/coach-office/trophy-case-view.tsx
// Trophy Case modal body - Phase 2. Renders the coach's CHAMPIONSHIP trophies
// (derived off the champion record, era-correct name; never invented). Empty case ->
// principled empty state. Presentational server component; rendered inside the
// (client) HotspotModal via the RSC slot pattern. Phase 2b adds held awards.
import type { CoachChampionship } from "@/lib/coach-office/resolvers";

export function TrophyCaseView({
  championships,
}: {
  championships: CoachChampionship[];
}) {
  if (championships.length === 0) {
    return (
      <p
        className="font-ceremonial font-light italic text-vault-text2 mt-4"
        style={{ fontSize: "1.05rem", lineHeight: 1.4 }}
      >
        The trophy case opens with the first championship.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {championships.map((c) => (
        <div
          key={c.season}
          className="pl-3"
          style={{ borderLeft: "1px solid rgba(139, 112, 53, 0.4)" }}
        >
          <p
            className="font-ceremonial text-vault-text"
            style={{ fontSize: "1.3rem", lineHeight: 1 }}
          >
            {c.season}
          </p>
          {c.teamName && (
            <p
              className="font-ceremonial text-vault-text2 mt-1"
              style={{ fontSize: "0.95rem" }}
            >
              {c.teamName}
            </p>
          )}
          <p
            className="font-ceremonial italic text-vault-text2 mt-1"
            style={{ fontSize: "0.9rem", lineHeight: 1.4 }}
          >
            {c.title}
          </p>
        </div>
      ))}
    </div>
  );
}
