// src/components/founding/begin-button.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startFoundingSession } from '@/lib/founding/actions';

export function BeginButton({ canonicalId }: { canonicalId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await startFoundingSession(canonicalId);
            if (res.ok) {
              router.refresh();
            } else {
              setError(
                res.error === 'forbidden'
                  ? 'Only the commissioner can begin the founding session.'
                  : 'Could not open the session. Please try again.',
              );
            }
          });
        }}
        className="font-ui font-medium transition-colors disabled:opacity-50"
        style={{
          padding: '0.75rem 2rem',
          fontSize: '0.95rem',
          color: 'var(--vault-bg)',
          background: 'var(--vault-gold)',
          border: 'none',
          borderRadius: 2,
          cursor: pending ? 'default' : 'pointer',
        }}
      >
        {pending ? 'Opening the vault…' : 'Begin'}
      </button>
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
