// src/lib/trophy-room/provenance-receipt.ts
// TROPHY HALL — the provenance receipt seam. The provenance toggle REVEALS the fact layer and
// is never a second source of truth: a receipt is a faithful PURE PROJECTION of a shipped
// resolver record + the shipped two-tier provenance module. It invents nothing, drops nothing,
// reorders nothing, and grows no field of its own. `resolveObjectReceipt` additionally proves
// object<->receipt ALIGNMENT — object X resolves to X's receipt, not a neighbour's.
// Node-env pure seam (brief section 4; successor note 8).
import { PROVENANCE_LABEL } from "@/lib/trophy-provenance";
import type { LiveRecord } from "@/lib/trophy-room";
import type { TrophyProvenance } from "@/lib/supabase/types";

// The receipt the toggle displays for one object. Every field is a projection of the source
// record (docketId, holders, history) or the shipped provenance label — nothing else.
export type Receipt = {
  docketId: string;
  provenanceLabel: string;
  holders: string[];
  history: { season: number; valueText: string }[];
};

// A faithful projection of a shipped resolver record into its receipt. The two-tier provenance
// label is read from the shipped module (CANONICAL -> 'ENTERED INTO THE RECORD' = Source Facts
// Verified; COMMISSIONER_ATTESTED -> 'COMMISSIONER ATTESTED' = Not Canonical) — never re-labelled.
export function buildReceipt(record: LiveRecord, provenance: TrophyProvenance): Receipt {
  return {
    docketId: record.docketId,
    provenanceLabel: PROVENANCE_LABEL[provenance],
    holders: record.holders.map((h) => h.name ?? "(unrecorded)"),
    history: record.history.map((h) => ({ season: h.season, valueText: h.valueText })),
  };
}

// Object<->receipt alignment: the displayed object keyed `objectId` resolves to THAT record's
// receipt. A mis-indexed lookup (right receipt built for the wrong object) is caught here — an
// unknown id is a loud error, never a silent neighbour's receipt.
export function resolveObjectReceipt(
  objectId: string,
  byId: Record<string, LiveRecord>,
  provenance: TrophyProvenance,
): Receipt {
  const record = byId[objectId];
  if (!record) {
    throw new Error(`provenance-receipt: no record for object id ${objectId} (alignment guard)`);
  }
  return buildReceipt(record, provenance);
}
