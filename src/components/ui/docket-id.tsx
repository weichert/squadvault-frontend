// src/components/ui/docket-id.tsx
// The docket ID is the permanent identifier for each artifact.
// GOVERNANCE: must always appear alongside the trust bar on published artifacts.

import { clsx } from 'clsx';

interface DocketIdProps {
  value: string;                // e.g. SV-2025-PFL-007 or DEMO-2025-001
  isDemo?: boolean;
  enteredAt?: string;           // ISO date string
  className?: string;
}

export function DocketId({ value, isDemo = false, enteredAt, className }: DocketIdProps) {
  const formattedDate = enteredAt
    ? new Date(enteredAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : null;

  return (
    <div
      data-testid="docket-id"
      className={clsx(
        'flex items-center gap-2 mt-1.5',
        className,
      )}
    >
      {/* Seal icon — small circle mark */}
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        aria-hidden="true"
        className="flex-shrink-0"
      >
        <circle
          cx="5" cy="5" r="4.5"
          fill="none"
          stroke={isDemo ? '#8B6E2A' : '#8B7035'}
          strokeWidth="1"
        />
        <circle
          cx="5" cy="5" r="1.5"
          fill={isDemo ? '#8B6E2A' : '#8B7035'}
        />
      </svg>

      <span
        className={clsx(
          'font-mono text-[11px] tracking-[0.08em]',
          isDemo ? 'text-[#8B6E2A]' : 'text-vault-gold',
        )}
      >
        {value}
      </span>

      {formattedDate && (
        <>
          <span className="text-vault-text3 font-mono text-[10px]">·</span>
          <span className="text-vault-text3 font-mono text-[10px] tracking-[0.06em]">
            Entered: {formattedDate}
          </span>
        </>
      )}
    </div>
  );
}
