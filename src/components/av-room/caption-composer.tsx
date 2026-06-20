'use client';

// src/components/av-room/caption-composer.tsx
// W.1 Increment 2 (spec 5.6): the member-authored caption box on an A/V Room item. A client
// island that posts to /api/av-room/caption. The route enforces GRANT-precedes-capture; this
// box makes the consent EXPLICIT and affirmative (grantConsent is sent only when the member
// checks the box), never assumed. The member writes - there is NO AI-authored caption, no
// reaction/engagement affordance (D-W1I2-6 boundary): just the member's words, attributed.
//
// "as remembered by you" framing: a caption is a remembered account ABOUT the item, not a
// provenance fact. The composer is visually part of the remembered-account layer, never the
// verified provenance panel.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CaptionComposer({ mediaEntryId }: { mediaEntryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [grant, setGrant] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!body.trim()) {
      setError('Write something to remember.');
      return;
    }
    if (!grant) {
      setError('Please affirm the consent to record and display your caption.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/av-room/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaEntryId, body: body.trim(), grantConsent: true }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? 'Could not save the caption.');
        setBusy(false);
        return;
      }
      setBody('');
      setGrant(false);
      setOpen(false);
      setBusy(false);
      router.refresh();
    } catch {
      setError('Could not save the caption.');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono"
        style={{
          marginTop: 8,
          fontSize: '9px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--vault-text3)',
          background: 'transparent',
          border: '1px solid var(--vault-border)',
          borderRadius: 4,
          padding: '4px 8px',
          cursor: 'pointer',
        }}
      >
        + Add what you remember
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8, padding: '8px 10px', border: '1px solid var(--vault-border)', borderRadius: 6, background: 'var(--vault-s2)' }}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="As you remember it…"
        className="font-ui"
        style={{
          width: '100%',
          resize: 'vertical',
          fontSize: '0.82rem',
          color: 'var(--vault-text)',
          background: 'var(--vault-bg)',
          border: '1px solid var(--vault-border)',
          borderRadius: 4,
          padding: '6px 8px',
        }}
      />
      <label className="font-ui" style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 6, fontSize: '0.72rem', color: 'var(--vault-text2)', lineHeight: 1.4 }}>
        <input type="checkbox" checked={grant} onChange={(e) => setGrant(e.target.checked)} style={{ marginTop: 2 }} />
        <span>I consent to record this caption in my own words and display it, attributed to me. I can revoke this later.</span>
      </label>
      {error && (
        <p className="font-ui" style={{ fontSize: '0.72rem', color: '#b4654a', marginTop: 6 }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="font-mono"
          style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--vault-text)', background: 'transparent', border: '1px solid var(--vault-gold)', borderRadius: 4, padding: '4px 10px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
        >
          {busy ? 'Saving…' : 'Save caption'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          disabled={busy}
          className="font-mono"
          style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--vault-text3)', background: 'transparent', border: '1px solid var(--vault-border)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
