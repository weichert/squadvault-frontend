// src/components/ui/signed-in-indicator.tsx
// SIGNED-IN INDICATOR — the presentational chip. Receives a pre-resolved IndicatorState
// (auth is resolved server-side in the league layout) and renders a slim, fixed top-right
// status chip on every nav-bearing page, both presentations. Display only: it reads no
// session, records no state, and offers no engagement mechanic — the anonymous case is a
// plain sign-in link, the signed-in cases are labelled status text. (Brief; D-1.)
import Link from "next/link";
import type { IndicatorState } from "@/lib/indicator/indicator-state";

// Slim fixed corner (D-1). Top-right so it never collides with the mobile bottom tab bar;
// safe-area aware. zIndex above the nav (desktop static; mobile bottom bar is 50) and content.
const WRAP: React.CSSProperties = {
  position: "fixed",
  top: "calc(env(safe-area-inset-top, 0px) + 8px)",
  right: "calc(env(safe-area-inset-right, 0px) + 10px)",
  zIndex: 60,
  maxWidth: "52vw",
};

const CHIP: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "10px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  padding: "5px 10px",
  borderRadius: 999,
  background: "rgba(11, 11, 14, 0.72)",
  border: "1px solid var(--vault-border, #3A3A44)",
  backdropFilter: "blur(3px)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "100%",
};

// Self-contained visually-hidden style (no class dependency) so the screen reader hears the
// full "Signed in as <name>" while the eye sees just the team.
const SR_ONLY: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

const Dot = () => (
  <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: 999, background: "var(--vault-gold, #C9A84C)", flexShrink: 0 }} />
);

export function SignedInIndicator({ state }: { state: IndicatorState }) {
  if (state.kind === "anonymous") {
    return (
      <div style={WRAP}>
        <Link
          href={state.signInHref}
          className="hover:text-vault-text transition-colors"
          style={{ ...CHIP, color: "var(--vault-gold, #C9A84C)", textDecoration: "none" }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (state.kind === "member") {
    return (
      <div style={WRAP}>
        <span style={{ ...CHIP, color: "var(--vault-text2, #B8B2A8)" }}>
          <Dot />
          <span style={SR_ONLY}>Signed in as </span>
          <span style={{ color: "var(--vault-gold, #C9A84C)", overflow: "hidden", textOverflow: "ellipsis" }}>{state.name}</span>
        </span>
      </div>
    );
  }

  // commissioner / signed_in — honest fallbacks, never a fabricated name.
  const shown = state.kind === "commissioner" ? "Signed in (commissioner)" : "Signed in";
  return (
    <div style={WRAP}>
      <span style={{ ...CHIP, color: "var(--vault-text2, #B8B2A8)" }}>
        <Dot />
        {shown}
      </span>
    </div>
  );
}
