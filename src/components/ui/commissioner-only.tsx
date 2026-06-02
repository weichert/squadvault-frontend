// src/components/ui/commissioner-only.tsx
// Forbidden state for commissioner-only surfaces.
//
// Per Design Brief section VIII visibility principle: commissioner-only
// rooms are not hidden from non-commissioners — they are visible but
// display a 403 state rather than being invisible. This component is
// the rendered 403 state.
//
// Treatment matches the members empty-state stub (vault-card, font-
// ceremonial italic copy at 1.2rem text-vault-text2) plus a small
// font-mono return link beneath the card.
//
// Server Component. No hooks, no state, no event handlers — just a
// piece of UI rendered by gated pages when the viewer is authenticated
// but not the commissioner.
import Link from "next/link";

interface Props {
  leagueId: string;
  leagueName: string;
}

export function CommissionerOnly({ leagueId, leagueName }: Props) {
  return (
    <div className="vault-card text-center py-12">
      <p
        className="font-ceremonial font-light text-vault-text2 italic"
        style={{ fontSize: "1.2rem" }}
      >
        This room is reserved for the commissioner.
      </p>
      <Link
        href={`/league/${leagueId}`}
        className="inline-block mt-6 font-mono text-[9px] tracking-[0.12em] text-vault-text3 hover:text-vault-text2 transition-colors"
      >
        ← Return to {leagueName}
      </Link>
    </div>
  );
}
