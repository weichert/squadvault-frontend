// src/lib/trophy-room/viewer-holdings.ts
// TROPHY HALL — the viewer-relative, REFLECTIVE highlight core + the no-fabrication guard.
// PURE (no I/O): the whole correctness surface lives here so it is provable in the node-env
// suite (the coach-office/resolvers.ts idiom). The page performs the two additive reads
// (uuid->canonical map; the viewer's own canonical_franchise_id) and hands plain data in.
//
// Constitutional guarantees (brief sections 3/5/6; dual-layer principle memo section 1):
//   - a trophy is "yours" iff your franchise is a CURRENT holder — reflective, never a goal;
//   - two shipped id spaces are reconciled: season_award_winners holders carry the canonical
//     code already; franchise_season_records holders carry a franchises.id UUID;
//   - name-only awards (the Belt current holder, permanent lists) expose no id -> never a
//     fabricated match (D-C, ratified v1 limitation);
//   - an object is displayable only if a fact backs it (seed-004 pre-apply -> honest absence);
//   - no ready art -> a text-card fallback, never broken.
import type { LiveRecordHolder } from "@/lib/trophy-room";

// A displayed trophy object reduced to what the reflective highlight needs. `docketId` is the
// fact reference (the receipt key); `holderCanonicalIds` are the current holder(s) in canonical
// space — EMPTY when the fact layer exposes only names for this award (Belt / lists).
export type HallObjectIdentity = {
  docketId: string;
  holderCanonicalIds: string[];
};

// Normalize a resolver holder to a canonical franchise code. season_award_winners holders are
// already canonical (returned as-is when they are not a UUID key); franchise_season_records
// holders are franchises.id UUIDs, mapped via the page-supplied uuid->canonical map. Unknown -> null.
export function holderCanonical(
  holder: LiveRecordHolder,
  uuidToCanonical: Map<string, string>,
): string | null {
  const id = holder.franchiseId;
  if (!id) return null;
  // A franchises.id UUID resolves through the map.
  const mapped = uuidToCanonical.get(id);
  if (mapped) return mapped;
  // Not a mapped UUID: a canonical franchise code (engine 4-digit zero-padded, e.g. '0001')
  // passes through unchanged; anything else is an honest gap (no guess).
  return /^\d{4}$/.test(id) ? id : null;
}

// Reflective highlight predicate: true iff the viewer's canonical franchise is a current holder.
// Anonymous / no-franchise viewers (null) and name-only awards ([] holders) never light up.
export function isHeldByViewer(obj: HallObjectIdentity, viewerCanonical: string | null): boolean {
  if (!viewerCanonical) return false;
  return obj.holderCanonicalIds.includes(viewerCanonical);
}

// The "your hardware" reflective filter: the subset the viewer currently holds, order preserved.
export function selectViewerHoldings(
  objs: HallObjectIdentity[],
  viewerCanonical: string | null,
): HallObjectIdentity[] {
  if (!viewerCanonical) return [];
  return objs.filter((o) => isHeldByViewer(o, viewerCanonical));
}

// No-fabrication guard: an object may be displayed only when a fact backs it — a docket id AND
// the award being present in the data. seed-004 pre-apply (award absent) -> not displayed; the
// room shows honest absence, never a fabricated winner.
export function isFactBacked(obj: { docketId?: string | null; present: boolean }): boolean {
  return !!obj.docketId && obj.present;
}

// Illustrated-or-fallback, never broken. A slug with landed art renders its plate; otherwise a
// graceful text card (Oracle until its sundial art lands; any award without ready art).
export function resolveObjectArt(
  slug: string,
  availableArt: Set<string>,
): { mode: "illustrated"; src: string } | { mode: "text"; src: null } {
  if (availableArt.has(slug)) return { mode: "illustrated", src: `/trophy-hall/${slug}.webp` };
  return { mode: "text", src: null };
}
