// src/lib/league.ts
// Request-scoped league fetch.
//
// The leagues row is queried by the layout AND by every page below it,
// keyed on canonical_id. Wrapping the fetch with React.cache() means
// the second and subsequent calls within a single render request hit
// the cache rather than the network. Each request gets a fresh cache;
// nothing persists across requests.
//
// Consumers call getLeague(canonicalId) regardless of position in the
// tree. The layout does not pass the row down to children, and pages
// do not pass it down to components - everyone fetches independently
// and the cache makes that free.
//
// Returns null when no league matches the canonical_id. Consumers
// branch on null (the layout treats it as "render children bare so
// notFound() handles the surface"; pages call notFound() directly).
// The helper does not call notFound() itself because the layout's
// founding-state bypass needs to inspect the row before deciding.
//
// The union of fields here is the union of fields any consumer reads:
// id, name, founding_year, status, canonical_id, commissioner_user_id.
// Payload is tiny; one shape across consumers is simpler than several
// narrower shapes.
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";

export type League = {
  id: string;
  name: string;
  founding_year: number;
  status: string;
  canonical_id: string;
  commissioner_user_id: string | null;
};

export const getLeague = cache(
  async (canonicalId: string): Promise<League | null> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("leagues")
      .select("id, name, founding_year, status, canonical_id, commissioner_user_id")
      .eq("canonical_id", canonicalId)
      .maybeSingle();
    return (data as League | null) ?? null;
  },
);
