// src/components/ui/trust-bar.tsx
// The trust bar is the visible proof of the approval chain.
// It appears on every artifact. It cannot be hidden, overridden, or removed.
// GOVERNANCE: rendering is unconditional — no prop allows suppression.

import { TRUST_BAR } from '@/lib/supabase/types';
import type { ApprovalState, TrophyProvenance } from '@/lib/supabase/types';
import { clsx } from 'clsx';

interface TrustBarProps {
  // Approval state drives the variant automatically
  approvalState?: ApprovalState;
  // For trophy room entries, provenance overrides state
  provenance?: TrophyProvenance;
  // is_demo: true forces DEMO variant regardless of approval state
  isDemo?: boolean;
  // Whether to animate the trust bar (used on approval state transition)
  animate?: boolean;
  className?: string;
}

type TrustVariant = 'CERTIFIED' | 'DEMO' | 'ATTESTED' | 'DRAFT';

function resolveVariant(
  approvalState?: ApprovalState,
  provenance?: TrophyProvenance,
  isDemo?: boolean,
): TrustVariant {
  // is_demo is the strongest signal — always wins
  if (isDemo) return 'DEMO';
  // Commissioner-attested provenance
  if (provenance === 'COMMISSIONER_ATTESTED') return 'ATTESTED';
  if (provenance === 'DEMO') return 'DEMO';
  // Approval state mapping
  if (approvalState === 'APPROVED' || approvalState === 'DISTRIBUTED') return 'CERTIFIED';
  // All other states (DRAFT, UNDER_REVIEW, CHANGES_REQUESTED, WITHHELD) show DRAFT variant
  // WITHHELD artifacts should never reach a rendering surface visible to members
  return 'DRAFT';
}

const VARIANT_STYLES: Record<TrustVariant, { text: string; border: string; dashed: boolean }> = {
  CERTIFIED: {
    text:   'text-[#C9A84C]',       // vault-gold
    border: 'border-[#8B7035]',     // vault-gold-dim
    dashed: false,
  },
  DEMO: {
    text:   'text-[#8B6E2A]',       // vault-demo
    border: 'border-[#5A4A1A]',
    dashed: false,
  },
  ATTESTED: {
    text:   'text-[#3B7A7A]',       // vault-attested
    border: 'border-[#1A4040]',
    dashed: false,
  },
  DRAFT: {
    text:   'text-[#514D47]',       // vault-text3
    border: 'border-[#3A3A44]',     // vault-rule
    dashed: true,
  },
};

export function TrustBar({
  approvalState,
  provenance,
  isDemo = false,
  animate = false,
  className,
}: TrustBarProps) {
  const variant = resolveVariant(approvalState, provenance, isDemo);
  const styles = VARIANT_STYLES[variant];
  const text = TRUST_BAR[variant];

  return (
    <div
      data-testid="trust-bar"
      data-variant={variant}
      className={clsx(
        'border-y py-2 text-center',
        'font-mono text-[10px] tracking-[0.15em]',
        styles.text,
        styles.border,
        styles.dashed ? 'border-dashed' : 'border-solid',
        animate && 'animate-trust-reveal opacity-0',
        className,
      )}
    >
      {text}
    </div>
  );
}
