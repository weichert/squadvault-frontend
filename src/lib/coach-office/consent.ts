// src/lib/coach-office/consent.ts
// Coach Office CO-R1 consent gate. Consent SUPREMACY is the outer gate and it wins:
// any surface that would show a member's likeness, voice, or attributed words checks
// the depicted member's consent FIRST, fail-closed - absent/false/malformed/error ->
// NOT shown, regardless of any spec or visibility flag (ratification memo CO-R1).
//
// This mirrors the A/V Room's fail-closed shape (src/lib/av-room.ts loadRoomState 2a
// gate): a single read of the derived `member_consent_current` view, and ONLY an
// explicit GRANT opens. The UI is never the boundary - this runs server-side and the
// caller withholds the content node when the gate is closed.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MemberConsentCategory } from "@/lib/supabase/types";

type AdminClient = SupabaseClient<Database>;

// Pure gate primitive. Only an EXPLICIT 'GRANT' opens; every other value closes -
// 'REVOKE', an unrecognized/malformed state string, null, or undefined all return
// false (default-posture law, W.6 1.4; closes the schema-drift gap, T2.8). Typed on a
// loose `string` so a future/unknown state cannot accidentally read as open.
export function isGrant(
  row: { current_state: string } | null | undefined,
): boolean {
  return row?.current_state === "GRANT";
}

// True IFF `memberUserId` holds a CURRENT grant for `category` in this league. Any
// uncertainty - missing row, query error, thrown exception, multiple ambiguous rows -
// FAILS CLOSED (false). Reads the admin view only to ANSWER the question; it never
// widens exposure.
export async function memberHoldsGrant(
  admin: AdminClient,
  leagueUuid: string,
  memberUserId: string,
  category: MemberConsentCategory,
): Promise<boolean> {
  try {
    const { data, error } = (await admin
      .from("member_consent_current")
      .select("current_state")
      .eq("league_id", leagueUuid)
      .eq("category", category)
      .eq("member_user_id", memberUserId)
      .maybeSingle()) as {
      data: { current_state: string } | null;
      error: { code?: string } | null;
    };
    if (error) return false;
    return isGrant(data);
  } catch {
    return false;
  }
}
