// src/components/ui/top-nav.tsx
// Top-level navigation across league surfaces per Design Brief section 5.4.
// Client Component - active state computed from usePathname().
//
// Tab order is fixed:
//   Public:        Community, Archive, Trophy Room, Members
//   [dim rule]
//   Commissioner:  Office
//
// Active state is a gold underline rule on the tab label (NOT a background
// highlight, per section 5.4 anti-pattern).
//
// Per Design Brief section VIII visibility principle, the Office tab is
// shown to all viewers regardless of role. Non-commissioners reach a
// rendered Forbidden state when they click it (see commissioner-only.tsx).
// Anonymous viewers reach the login flow first, then Forbidden after auth.
//
// v1 SCOPE:
// - Cream league name (gold-on-first-load ceremony deferred to Part VI)
// - Desktop-style responsive nav (mobile bottom tab bar implementation
//   pending - composition resolved per the engine repo memo
//   _observations/OBSERVATIONS_2026_05_31_MOBILE_NAV_SLOT_COMPOSITION.md)
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  leagueId: string;
  leagueName: string;
}

type Tab = {
  label: string;
  href: (id: string) => string;
  isActive: (pathname: string, id: string) => boolean;
};

const PUBLIC_TABS: ReadonlyArray<Tab> = [
  {
    label: "Community",
    href: (id) => `/league/${id}`,
    isActive: (pathname, id) => pathname === `/league/${id}`,
  },
  {
    label: "Archive",
    href: (id) => `/league/${id}/archive`,
    isActive: (pathname, id) => pathname.startsWith(`/league/${id}/archive`),
  },
  {
    label: "Trophy Room",
    href: (id) => `/league/${id}/trophy-room`,
    isActive: (pathname, id) => pathname.startsWith(`/league/${id}/trophy-room`),
  },
  {
    label: "Members",
    href: (id) => `/league/${id}/members`,
    isActive: (pathname, id) => pathname.startsWith(`/league/${id}/members`),
  },
];

const COMMISSIONER_TABS: ReadonlyArray<Tab> = [
  {
    label: "Office",
    href: (id) => `/league/${id}/office`,
    isActive: (pathname, id) => pathname.startsWith(`/league/${id}/office`),
  },
];

const TAB_STYLE = {
  fontSize: "10px",
  letterSpacing: "0.15em",
  textTransform: "uppercase" as const,
  textDecoration: "none" as const,
  paddingBottom: "2px",
};

function renderTab(tab: Tab, pathname: string, leagueId: string) {
  const active = tab.isActive(pathname, leagueId);
  return (
    <Link
      key={tab.label}
      href={tab.href(leagueId)}
      className="font-mono hover:text-vault-text transition-colors"
      style={{
        ...TAB_STYLE,
        borderBottom: active
          ? "1px solid var(--vault-gold)"
          : "1px solid transparent",
        color: active ? "var(--vault-gold)" : "var(--vault-text2)",
      }}
    >
      {tab.label}
    </Link>
  );
}

export function TopNav({ leagueId, leagueName }: Props) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      style={{
        height: "var(--nav-height, 80px)",
        background: "var(--vault-bg)",
        borderBottom: "1px solid var(--vault-border)",
      }}
    >
      <div
        className="max-w-4xl mx-auto px-6 h-full"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "0.5rem",
        }}
      >
        {/* League name - Outfit 500, cream for v1 (gold ceremony deferred) */}
        <Link
          href={`/league/${leagueId}`}
          className="font-ui text-vault-text hover:text-vault-text transition-colors"
          style={{
            fontSize: "0.95rem",
            fontWeight: 500,
            letterSpacing: "0.02em",
            textDecoration: "none",
          }}
        >
          {leagueName}
        </Link>

        {/* Surface tabs - public group, dim rule separator, commissioner group.
            Office tab visible to all viewers per section VIII visibility
            principle; the 403 rendering happens at the Office route itself. */}
        <div className="flex gap-6 items-center">
          {PUBLIC_TABS.map((tab) => renderTab(tab, pathname, leagueId))}
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 1,
              height: 12,
              background: "var(--vault-border)",
              opacity: 0.6,
            }}
          />
          {COMMISSIONER_TABS.map((tab) => renderTab(tab, pathname, leagueId))}
        </div>
      </div>
    </nav>
  );
}
