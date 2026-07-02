// src/lib/coach-office/viewer-context.ts
// Coach Office viewer relationship context - Phase 3 (relationship-aware access
// context foundation).
//
// This layer answers exactly ONE question: "who is viewing this coach office, and
// what is their relationship to the office owner?" It does NOT answer "what
// relationship-specific content should we show?" - no content is filtered, no
// artifact is changed, no board/media/egg logic exists here. Later phases consume
// the context (and the conservative capability booleans) to gate surfaces; Phase 3
// only resolves and threads it.
//
// The relationship is DERIVED from identity the platform already has: the viewer's
// authenticated user id (via getViewer), the viewer's own franchise in this league
// (franchises.member_user_id -> canonical_franchise_id), and the office owner's
// canonical_franchise_id. Nothing is invented; a viewer with no franchise and no
// commissioner role resolves conservatively to PUBLIC_OR_UNKNOWN.
//
// All cross-module imports here are type-only, so importing this module (e.g. from a
// standalone proof script) pulls in no Next.js request context - the classifier is a
// pure function of its inputs.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { League, Viewer } from "@/lib/league";
import type { CoachOfficeProfile } from "@/lib/coach-office/profile";

type AdminClient = SupabaseClient<Database>;

// The minimal relationship taxonomy (Phase 3). Deliberately small: it distinguishes
// only what the platform can derive today from ratified data. No friendship, rivalry,
// intensity, or ranking is inferred.
export type CoachOfficeRelationship =
  | "OWNER"
  | "COMMISSIONER"
  | "LEAGUE_MATE"
  | "PUBLIC_OR_UNKNOWN";

// The facts the classifier needs. Keeping this a plain record (not the DB clients)
// makes the classifier pure and unit-provable without a database.
export type CoachOfficeViewerFacts = {
  viewerUserId: string | null; // authenticated user id, or null for anonymous
  viewerCoachId: string | null; // viewer's own canonical_franchise_id in this league
  officeCoachId: string; // the office owner's canonical_franchise_id
  isCommissioner: boolean; // viewer is the league commissioner
};

// The resolved context threaded into the office UI. The capability booleans are
// conservative and, in Phase 3, PURELY ADVISORY - no consumer gates content on them
// yet. They exist so later phases have a single, tested place to read permissions.
export type CoachOfficeViewerContext = {
  viewerUserId: string | null;
  viewerCoachId: string | null;
  officeCoachId: string;
  relationship: CoachOfficeRelationship;
  canViewPublicOffice: boolean;
  canViewOwnerOnlySurface: boolean;
  canViewRelationshipSurface: boolean;
};

// Deterministic classifier. Precedence (first match wins):
//   1. OWNER          - viewer's franchise IS the office (owner viewing own office);
//                       wins even when the owner is also the commissioner.
//   2. COMMISSIONER   - viewer is the league commissioner (of someone else's office).
//   3. LEAGUE_MATE    - viewer owns a (different) franchise in this league.
//   4. PUBLIC_OR_UNKNOWN - anonymous, or authenticated with no franchise here.
// Same inputs always yield the same output; there is no clock, randomness, or I/O.
export function classifyCoachOfficeViewerContext(
  facts: CoachOfficeViewerFacts,
): CoachOfficeViewerContext {
  const relationship = classifyRelationship(facts);
  return {
    viewerUserId: facts.viewerUserId,
    viewerCoachId: facts.viewerCoachId,
    officeCoachId: facts.officeCoachId,
    relationship,
    // The public office (nameplate + derived trophies/rings) is what everyone sees
    // today; Phase 3 preserves that. Conservative == "no less open than reality".
    canViewPublicOffice: true,
    canViewOwnerOnlySurface: relationship === "OWNER",
    canViewRelationshipSurface: relationship !== "PUBLIC_OR_UNKNOWN",
  };
}

function classifyRelationship(
  facts: CoachOfficeViewerFacts,
): CoachOfficeRelationship {
  // Anonymous viewers are always PUBLIC_OR_UNKNOWN - no identity to relate.
  if (!facts.viewerUserId) return "PUBLIC_OR_UNKNOWN";
  // Owner-viewing-own-office wins over the commissioner role.
  if (facts.viewerCoachId !== null && facts.viewerCoachId === facts.officeCoachId) {
    return "OWNER";
  }
  if (facts.isCommissioner) return "COMMISSIONER";
  // Authenticated with a franchise in this league (but not this office) = league-mate.
  if (facts.viewerCoachId !== null) return "LEAGUE_MATE";
  // Authenticated but unaffiliated with this league -> conservative default.
  return "PUBLIC_OR_UNKNOWN";
}

// Resolve the full context for a request. The only I/O is a single read-only lookup
// of the viewer's own franchise in this league (franchises.member_user_id ->
// canonical_franchise_id); the office owner's id already lives on officeProfile.
// Anonymous viewers skip the lookup entirely.
export async function resolveCoachOfficeViewerContext(
  admin: AdminClient,
  league: League,
  viewer: Viewer,
  officeProfile: CoachOfficeProfile,
): Promise<CoachOfficeViewerContext> {
  let viewerCoachId: string | null = null;

  if (viewer.userId) {
    const { data } = (await admin
      .from("franchises")
      .select("canonical_franchise_id")
      .eq("league_id", league.id)
      .eq("member_user_id", viewer.userId)
      .maybeSingle()) as {
      data: { canonical_franchise_id: string } | null;
    };
    viewerCoachId = data?.canonical_franchise_id ?? null;
  }

  return classifyCoachOfficeViewerContext({
    viewerUserId: viewer.userId,
    viewerCoachId,
    officeCoachId: officeProfile.coachId,
    isCommissioner: viewer.isCommissioner,
  });
}
