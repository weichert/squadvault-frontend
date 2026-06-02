// src/app/league/[id]/layout.tsx
// League-level layout: renders the top navigation across all league surfaces.
//
// Bypasses nav for founding-state leagues (the LockedRoom is its own sealed
// surface; a nav linking to Archive/Trophy/Members above it would read wrong
// because those surfaces are also sealed). Bypasses for missing-league too,
// so the child page can render notFound() without a nav above it.
//
// The community page (page.tsx at this level) visually suppresses the nav
// via negative-margin-top so the founding plaque occupies the viewport per
// Design Brief section 7.1. The nav stays in the DOM; the main element
// overlaps it. Active state still computes correctly because pathname is
// /league/[id].
//
// FUTURE: layout-level league context candidate - the page below this layout
// re-fetches league.name, so the same name is queried twice per render. Not
// noisy enough at v1 to warrant a context; capture in next memo.
import { getLeague } from "@/lib/league";
import { TopNav } from "@/components/ui/top-nav";

// Skip Next.js route segment caching so league status changes (e.g. founding
// to active) surface without a hard reload. Matches the established pattern
// in _observations/OBSERVATIONS_2026_05_28_LEAGUE_PAGES_FORCE_DYNAMIC.md
// (engine repo).
export const dynamic = "force-dynamic";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function LeagueLayout({ children, params }: Props) {
  const { id } = await params;
  const league = await getLeague(id);

  // No data, or status is founding: render children bare so LockedRoom /
  // notFound() handle the surface on their own terms. No nav above a sealed
  // or non-existent surface.
  if (!league || league.status === "founding") {
    return <>{children}</>;
  }

  // Active league. Set --nav-height as a CSS custom property on the wrapping
  // div so the community page's main element can pull itself up by exactly
  // the nav height without hard-coding the value in two places.
  return (
    <div style={{ "--nav-height": "80px" } as React.CSSProperties}>
      <TopNav leagueId={id} leagueName={league.name} />
      {children}
    </div>
  );
}
