// src/components/founding/skip-button.tsx
'use client';
//
// Begin-screen skip affordance (spec section 9.1 / F4-B1). Shown only on the
// pre-session entry screen. Two steps: a quiet "Skip for now" link, then a
// confirmation that states what is lost before setting the league up without a
// founding session. Deterministic copy -- not an agent turn.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { skipFoundingSession } from '@/lib/founding/actions';

export function SkipFoundingButton({ canonicalId }: { canonicalId: string }) {
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
        }}
      >
        Skip for now
      </button>
    );
  }

  return (
    <div style={{ maxWidth: 460, textAlign: 'left' }}>
      <p
        className="font-ui"
        style={{
          color: 'var(--vault-text2)',
          fontSize: '0.9rem',
          lineHeight: 1.6,
          marginBottom: '1.25rem',
        }}
      >
        You can skip this for now &mdash; the Clubhouse will work without a
        founding record. The Voice Profile will default to MIXED until you set
        it, and the Founding Artifact won&rsquo;t be created. You can always run
        a founding session later from the Review Room.
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await skipFoundingSession(canonicalId);
              if (res.ok) {
                router.push(`/league/${canonicalId}`);
              } else {
                setError(
                  res.error === 'forbidden'
                    ? 'Only the commissioner can set up the league.'
                    : 'Could not skip the session. Please try again.',
                );
              }
            });
          }}
          className="font-ui font-medium transition-colors disabled:opacity-50"
          style={{
            padding: '0.6rem 1.25rem',
            fontSize: '0.9rem',
            color: 'var(--vault-text)',
            background: 'none',
            border: '1px solid var(--vault-border)',
            borderRadius: 2,
            cursor: pending ? 'default' : 'pointer',
          }}
        >
          {pending ? 'Setting up\u2026' : 'Set up without a session'}
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
