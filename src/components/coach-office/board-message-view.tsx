// src/components/coach-office/board-message-view.tsx
// Board detail modal body. Renders the office owner's current board note (member speech,
// CO-R3) when one has cleared the CO-R1 consent gate, or a principled blank-board empty
// state when none. All text is a runtime data overlay - nothing is baked (CO-R4). The
// note text and attribution are read through the pure `boardDisplay` seam so the view
// carries no display logic of its own. Presentational server component; rendered inside
// the (client) RoomModal via the RSC slot pattern.
import { boardDisplay, type BoardNote } from "@/lib/coach-office/board";

export function BoardMessageView({ note }: { note: BoardNote | null }) {
  const { body, attribution, isEmpty } = boardDisplay(note);

  if (isEmpty) {
    return (
      <p
        className="font-ceremonial font-light italic text-vault-text2 mt-4"
        style={{ fontSize: "1.05rem", lineHeight: 1.4 }}
      >
        {body}
      </p>
    );
  }

  return (
    <div className="mt-4">
      <p
        className="font-ui text-sm text-vault-text2 leading-relaxed"
        style={{ whiteSpace: "pre-wrap" }}
      >
        {body}
      </p>
      {attribution && (
        <p className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 mt-3">
          {"— "}
          {attribution}
        </p>
      )}
    </div>
  );
}
