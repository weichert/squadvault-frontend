// src/components/ui/top-nav.tsx
// Top-level navigation across league surfaces per Design Brief sections 5.4
// and VIII. Client Component - active state computed from usePathname().
//
// Tab order is fixed (section VIII canonical, five separate slots). The
// section 5.4 "Archive and Trophy Room share one slot" reading was resolved
// against section VIII in the engine memo
// _observations/OBSERVATIONS_2026_05_31_MOBILE_NAV_SLOT_COMPOSITION.md:
//   Public:        Community, Archive, Trophy Room, Members
//   [dim rule]
//   Commissioner:  Office
//
// Two presentations share one tab-definition source:
//   - Desktop (md and up): a top bar. Active state is a gold underline rule on
//     the label (NOT a background highlight, per section 5.4 anti-pattern).
//   - Mobile (below md): a fixed bottom tab bar with five slots. Active state
//     is a short gold rule along the top edge of the active slot that grows
//     from center on navigation (fast, no delay; honors prefers-reduced-motion
//     via .nav-rule-active in globals.css). 44x44px minimum tap targets per
//     section VIII.
//
// Per section VIII visibility principle, the Office tab is shown to all viewers
// regardless of role on both presentations. Non-commissioners reach a rendered
// Forbidden state at the Office route itself (see commissioner-only.tsx and the
// engine memo OBSERVATIONS_2026_05_31_COMMISSIONER_ONLY_403). No role logic
// lives in this component.
//
// v1 SCOPE:
// - Cream league name on desktop (gold-on-first-load ceremony deferred to
//   Part VI). The mobile bottom bar carries no league name per bottom-tab-bar
//   convention; surfaces carry their own identity (plaque, breadcrumbs).
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

// ── Desktop top bar (md and up) ──────────────────────────────────────────────

const DESKTOP_TAB_STYLE = {
  fontSize: "10px",
  letterSpacing: "0.15em",
  textTransform: "uppercase" as const,
  textDecoration: "none" as const,
  paddingBottom: "2px",
};

function renderDesktopTab(tab: Tab, pathname: string, leagueId: string) {
  const active = tab.isActive(pathname, leagueId);
  return (
    <Link
      key={tab.label}
      href={tab.href(leagueId)}
      className="font-mono hover:text-vault-text transition-colors"
      style={{
        ...DESKTOP_TAB_STYLE,
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

function DesktopNav({
  leagueId,
  leagueName,
  pathname,
}: Props & { pathname: string }) {
  return (
    <nav
      aria-label="League navigation"
      className="hidden md:block"
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
          {PUBLIC_TABS.map((tab) => renderDesktopTab(tab, pathname, leagueId))}
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
          {COMMISSIONER_TABS.map((tab) =>
            renderDesktopTab(tab, pathname, leagueId)
          )}
        </div>
      </div>
    </nav>
  );
}

// ── Mobile bottom tab bar (below md) ─────────────────────────────────────────

function renderMobileSlot(tab: Tab, pathname: string, leagueId: string) {
  const active = tab.isActive(pathname, leagueId);
  return (
    <Link
      key={tab.label}
      href={tab.href(leagueId)}
      aria-current={active ? "page" : undefined}
      className="font-mono"
      style={{
        flex: "1 1 0",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        minWidth: 44,
        minHeight: 44,
        padding: "0 4px",
        textDecoration: "none",
        fontSize: "10px",
        lineHeight: 1.15,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: active ? "var(--vault-gold)" : "var(--vault-text2)",
      }}
    >
      {/* "You are in this room" - a short gold rule that grows from center on
          navigation. Faces the content (top edge) rather than the screen edge. */}
      {active && (
        <span
          aria-hidden="true"
          className="nav-rule-active"
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            width: 24,
            height: "1.5px",
            background: "var(--vault-gold)",
            transformOrigin: "center",
            transform: "translateX(-50%)",
          }}
        />
      )}
      {tab.label}
    </Link>
  );
}

function MobileTabBar({
  leagueId,
  pathname,
}: {
  leagueId: string;
  pathname: string;
}) {
  return (
    <nav
      aria-label="League navigation"
      className="md:hidden"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        background: "var(--vault-bg)",
        borderTop: "1px solid var(--vault-border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          height: "var(--bottom-nav-height, 56px)",
        }}
      >
        {PUBLIC_TABS.map((tab) => renderMobileSlot(tab, pathname, leagueId))}
        {/* Commissioner dim rule - mirrors the desktop separator, vertical. */}
        <span
          aria-hidden="true"
          style={{
            alignSelf: "center",
            width: 1,
            height: 24,
            margin: "0 2px",
            background: "var(--vault-border)",
            opacity: 0.6,
          }}
        />
        {COMMISSIONER_TABS.map((tab) =>
          renderMobileSlot(tab, pathname, leagueId)
        )}
      </div>
    </nav>
  );
}

export function TopNav({ leagueId, leagueName }: Props) {
  const pathname = usePathname() ?? "";

  return (
    <>
      <DesktopNav
        leagueId={leagueId}
        leagueName={leagueName}
        pathname={pathname}
      />
      <MobileTabBar leagueId={leagueId} pathname={pathname} />
    </>
  );
}
