// src/components/coach-office/trophy-case-view.tsx
// Trophy Case modal body - Phase 2/2b. Renders the coach's CHAMPIONSHIP trophies and
// (2b) the traveling/annual/permanent records they CURRENTLY hold - all derived off
// the Trophy Room read-models, era-correct, never invented. Empty case (no titles and
// no held records) -> principled empty state. Presentational server component;
// rendered inside the (client) HotspotModal via the RSC slot pattern.
import type {
  CoachChampionship,
  CoachHeldRecord,
} from "@/lib/coach-office/resolvers";

export function TrophyCaseView({
  championships,
  heldRecords,
}: {
  championships: CoachChampionship[];
  heldRecords: CoachHeldRecord[];
}) {
  if (championships.length === 0 && heldRecords.length === 0) {
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
    <div className="mt-4 space-y-6">
      {championships.length > 0 && (
        <section>
          <p className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 mb-3">
            CHAMPIONSHIPS
          </p>
          <div className="space-y-4">
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
        </section>
      )}

      {heldRecords.length > 0 && (
        <section>
          <p className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 mb-3">
            RECORDS HELD
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="space-y-3">
            {heldRecords.map((r) => (
              <li
                key={r.trophyName}
                className="pl-3"
                style={{ borderLeft: "1px solid rgba(139, 112, 53, 0.4)" }}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span
                    className="font-ceremonial text-vault-text"
                    style={{ fontSize: "1.05rem" }}
                  >
                    {r.trophyName}
                  </span>
                  {r.valueText && (
                    <span className="font-ui text-xs text-vault-text2 text-right">
                      {r.valueText}
                    </span>
                  )}
                </div>
                <p className="font-ui text-xs text-vault-text3 mt-1 leading-relaxed">
                  {r.qualification}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
