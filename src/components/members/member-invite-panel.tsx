// src/components/members/member-invite-panel.tsx
'use client';

// E2.3-minimal (D-SEQ-2, ruled 2026-06-12): the commissioner-only invite + link
// control. Rendered ONLY for the league commissioner (the members directory itself
// stays a public surface). One action enters a member's email + picks a franchise and
// posts to /api/members/invite, which issues the Supabase magic-link invite AND records
// the ratified linkage. The roster below shows which franchises are linked so the
// commissioner can see state without guessing.
//
// No member-facing affordance here: linkage is the commissioner's ratification, never
// self-asserted. Out of scope: profile editing, settings, notifications.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type InviteFranchise = {
  id: string;
  name: string;
  linked: boolean;
};

export function MemberInvitePanel({
  franchises,
}: {
  franchises: InviteFranchise[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [franchiseId, setFranchiseId] = useState(franchises[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function invite() {
    if (!email.trim() || !franchiseId) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch('/api/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), franchiseId }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        franchise?: string;
        alreadyRegistered?: boolean;
      };
      if (!res.ok) {
        setError(j.error ?? 'Could not send the invite.');
        return;
      }
      setDone(
        j.alreadyRegistered
          ? `Linked to ${j.franchise}. That email already had an account, so no new invite was sent.`
          : `Invite sent and linked to ${j.franchise}.`,
      );
      setEmail('');
      router.refresh();
    } catch {
      setError('Could not send the invite.');
    } finally {
      setBusy(false);
    }
  }

  const linkedCount = franchises.filter((f) => f.linked).length;

  return (
    <div className="vault-card mt-12" style={{ padding: '1.5rem' }}>
      <h2
        className="font-ceremonial font-light text-vault-text"
        style={{ fontSize: '1.3rem', letterSpacing: '0.02em' }}
      >
        Invite a member
      </h2>
      <p className="font-ui text-sm text-vault-text2 mt-2 leading-relaxed">
        Commissioner only. Enter a member&apos;s email and the franchise they own. They
        receive a magic-link to sign in; the link to their franchise is recorded the
        moment you invite them. {linkedCount} of {franchises.length} franchises linked.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 flex-1">
          <span className="font-mono text-vault-text3" style={{ fontSize: '9px', letterSpacing: '0.15em' }}>
            MEMBER EMAIL
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@example.com"
            disabled={busy}
            className="font-ui text-sm text-vault-text px-3 py-2"
            style={{
              background: 'var(--vault-bg)',
              border: '1px solid rgba(139, 112, 53, 0.4)',
              borderRadius: 4,
            }}
          />
        </label>
        <label className="flex flex-col gap-1 flex-1">
          <span className="font-mono text-vault-text3" style={{ fontSize: '9px', letterSpacing: '0.15em' }}>
            FRANCHISE
          </span>
          <select
            value={franchiseId}
            onChange={(e) => setFranchiseId(e.target.value)}
            disabled={busy}
            className="font-ui text-sm text-vault-text px-3 py-2"
            style={{
              background: 'var(--vault-bg)',
              border: '1px solid rgba(139, 112, 53, 0.4)',
              borderRadius: 4,
            }}
          >
            {franchises.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.linked ? ' (linked)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={invite}
          disabled={busy || !email.trim() || !franchiseId}
          className="font-ui text-sm px-4 py-2 transition-colors disabled:opacity-50"
          style={{
            background: 'var(--vault-s1)',
            border: '1px solid var(--vault-gold-dim)',
            borderRadius: 4,
            color: 'var(--vault-gold-dim)',
          }}
        >
          {busy ? 'Sending...' : 'Invite + link'}
        </button>
      </div>

      {error && (
        <p className="font-ui text-sm mt-3" style={{ color: '#c08a8a' }}>
          {error}
        </p>
      )}
      {done && (
        <p className="font-ui text-sm mt-3 text-vault-text2">{done}</p>
      )}
    </div>
  );
}
