// src/components/founding/retrigger-button.tsx
'use client';
//
// Office "Re-run founding session" affordance (F4-B2, spec sections 9.1/9.4).
// Re-opens the founding flow for an already-set-up league. Two steps: a quiet
// link, then a confirmation that states the existing record is preserved
// (append-only) before a fresh session is created.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { retriggerFoundingSession } from '@/lib/founding/actions';

export function RetriggerFoundingButton({
  canonicalId,
}: {
  canonicalId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className="font-mono transition-colors"
        style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          color: 'var(--vault-text3)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textTransform: 'uppercase',
          padding: 0,
        }}
      >
        Re-run founding session
      </button>
    );
  }

  return (
    <div className="vault-card" style={{ maxWidth: 480 }}>
      <p
        className="font-ui"
        style={{
          color: 'var(--vault-text2)',
          fontSize: '0.9rem',
          lineHeight: 1.6,
          marginBottom: '1.25rem',
        }}
      >
        Re-running the founding session starts a fresh conversation. Your current
        founding record stays in the archive &mdash; a new founding record is
        created only when you finish and approve it.
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await retriggerFoundingSession(canonicalId);
              if (res.ok) {
                router.push(`/founding/${canonicalId}`);
              } else {
                setError(
                  res.error === 'forbidden'
                    ? 'Only the commissioner can re-run the founding session.'
                    : 'Could not re-run the session. Please try again.',
                );
              }
            });
          }}
          className="font-ui font-medium transition-colors disabled:opacity-50"
          style={{
            padding: '0.6rem 1.25rem',
            fontSize: '0.9rem',
            color: 'var(--vault-bg)',
            background: 'var(--vault-gold)',
            border: 'none',
            borderRadius: 2,
            cursor: pending ? 'default' : 'pointer',
          }}
        >
          {pending ? 'Opening\u2026' : 'Re-run founding session'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setConfirming(false);
          }}
          className="font-mono transition-colors disabled:opacity-50"
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            color: 'var(--vault-text3)',
            background: 'none',
            border: 'none',
            cursor: pending ? 'default' : 'pointer',
            textTransform: 'uppercase',
          }}
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p
          className="font-ui mt-4"
          style={{ color: 'var(--vault-withheld)', fontSize: '0.85rem' }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
