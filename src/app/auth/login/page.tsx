// src/app/auth/login/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--vault-bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="font-mono text-[9px] tracking-[0.2em] text-vault-text3 mb-3">
            SQUADVAULT
          </p>
          <h1
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: '2rem', letterSpacing: '0.04em' }}
          >
            Commissioner Sign In
          </h1>
        </div>

        {sent ? (
          <div className="vault-card text-center">
            <div className="font-mono text-[10px] tracking-[0.15em] text-vault-approved mb-3">
              ✓ LINK SENT
            </div>
            <p className="font-ui text-sm text-vault-text2 leading-relaxed">
              Check your email. The sign-in link is good for 60 minutes.
            </p>
            <p className="font-mono text-[10px] text-vault-text3 mt-4">
              {email}
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="vault-card">
            <label className="block mb-4">
              <span className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 block mb-2">
                EMAIL ADDRESS
              </span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full bg-vault-s2 border border-vault-border rounded-[4px] px-3 py-2.5 font-ui text-sm text-vault-text placeholder-vault-text3 focus:outline-none focus:border-vault-gold-dim transition-colors"
              />
            </label>

            {error && (
              <p className="font-ui text-xs text-vault-withheld mb-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="vault-btn-approve w-full"
            >
              {loading ? 'Sending...' : 'Send sign-in link'}
            </button>

            <p className="font-ui text-xs text-vault-text3 text-center mt-4 leading-relaxed">
              We&apos;ll send a magic link. No password required.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
