// src/lib/nav/routes.ts
// Canonical app-route helpers. One tested place for a route shape, so callers cannot
// reintroduce the canonical-vs-UUID trap (a /league/[id] route keys on the league's
// CANONICAL id, never the leagues-table UUID — a UUID path 404s).

// The illustrated Clubhouse for a league. `canonicalId` MUST be the canonical league id
// (the value /league/[id] pages resolve via getLeague), NOT the leagues UUID.
export function clubhouseHref(canonicalId: string): string {
  return `/league/${canonicalId}/clubhouse`;
}
