// src/components/ui/top-nav.tsx
// Top-level navigation across league surfaces per Design Brief section 5.4.
// Client Component - active state computed from usePathname().
//
// Tab order is fixed: Community, Archive, Trophy Room, Members.
// Active state is a gold underline rule on the tab label (NOT a background
// highlight, per section 5.4 anti-pattern).
//
// v1 SCOPE:
// - Cream league name (gold-on-first-load ceremony deferred to Part VI work)
// - Desktop-style responsive nav (mobile bottom tab bar deferred until the
//   section 5.4 vs section VIII slot ambiguity is resolved deliberately)
// - Public surfaces only (commissioner-rule separator with Office/Approval
//   tabs deferred until role-aware 403 rendering exists)
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

const TABS: ReadonlyArray<Tab> = [
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

        {/* Surface tabs - gold underline active state per section 5.4 */}
        <div className="flex gap-6">
          {TABS.map((tab) => {
            const active = tab.isActive(pathname, leagueId);
            return (
              <Link
                key={tab.label}
                href={tab.href(leagueId)}
                className="font-mono hover:text-vault-text transition-colors"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  paddingBottom: "2px",
                  borderBottom: active
                    ? "1px solid var(--vault-gold)"
                    : "1px solid transparent",
                  color: active ? "var(--vault-gold)" : "var(--vault-text2)",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
