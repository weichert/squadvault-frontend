'use client';

// src/components/vault/vault-compose-panel.tsx
// L.3 The Vault compose/seal client surface (spec section 5.4). Draft autosave is
// client-side (localStorage) so the append-only sealed table only ever receives the
// terminal SEAL — no mutable server draft. The sealed_testimony consent grant is affirmed
// inline and sent with the seal; the API records the grant before sealing. SEAL is the
// point of no return: the member cannot read or edit the body afterward (the reveal unit
// opens it, season-end). No counts, nudges, streaks, or reminders (invariant 5).
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SealedMeta {
  id: string;
  season: number;
  sealed_at: string;
}

interface Props {
  leagueId: string;
  season: number;
  canCompose: boolean;
  franchiseName: string | null;
  sealed: SealedMeta[];
}

function formatSealedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function VaultComposePanel({
  leagueId,
  season,
  canCompose,
  franchiseName,
  sealed,
}: Props) {
  const router = useRouter();
  const draftKey = `vault-draft-${leagueId}-${season}`;

  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSealedAt, setJustSealedAt] = useState<string | null>(null);

  // Load any autosaved draft on mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved) setText(saved);
    } catch {
      /* localStorage unavailable; compose still works, just no autosave */
    }
  }, [draftKey]);

  // Autosave the draft as the member writes (pre-seal only).
  useEffect(() => {
    try {
      if (text) window.localStorage.setItem(draftKey, text);
      else window.localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [text, draftKey]);

  async function seal() {
    setSealing(true);
    setError(null);
    try {
      const res = await fetch('/api/vault/seal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, body: text, grantConsent: consent }),
      });
      const data = (await res.json()) as { ok?: boolean; sealedAt?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Could not seal the letter.');
        setConfirming(false);
        return;
      }
      // Sealed. Clear the draft and the composer; the body is now beyond reach until reveal.
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      setText('');
      setConsent(false);
      setConfirming(false);
      setJustSealedAt(data.sealedAt ?? new Date().toISOString());
      router.refresh(); // re-read the sealed-letter metadata list from the server
    } catch {
      setError('Could not reach the Vault. Please try again.');
      setConfirming(false);
    } finally {
      setSealing(false);
    }
  }

  const canSeal = canCompose && text.trim().length > 0 && consent && !sealing;

  return (
    <div>
      {justSealedAt && (
        <div
          className="mb-8 rounded p-4 text-vault-text"
          style={{ background: 'rgba(139, 112, 53, 0.12)', border: '1px solid rgba(139, 112, 53, 0.4)' }}
        >
          Sealed {formatSealedAt(justSealedAt)}. Your letter is closed until the season-end
          reveal — no one, not even the commissioner, can read it before then.
        </div>
      )}

      {!canCompose ? (
        <p className="text-vault-text" style={{ opacity: 0.75 }}>
          Only a franchise-linked member can seal a letter. Once your commissioner has linked
          your franchise, this is where you write.
        </p>
      ) : (
        <section aria-label="Compose a sealed letter">
          {franchiseName && (
            <p className="mb-3 text-vault-text" style={{ opacity: 0.6, fontSize: '0.9rem' }}>
              Writing as {franchiseName}
            </p>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sealing}
            rows={10}
            maxLength={10_000}
            placeholder="Dear December me…"
            className="w-full rounded p-4 text-vault-text"
            style={{
              background: 'rgba(0,0,0,0.18)',
              border: '1px solid rgba(139, 112, 53, 0.3)',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.6,
            }}
          />

          <label
            className="mt-5 flex items-start gap-3 text-vault-text"
            style={{ opacity: 0.85, fontSize: '0.92rem', cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={sealing}
              style={{ marginTop: '0.25rem' }}
            />
            <span>
              I grant <strong>sealed_testimony</strong> consent: this letter may be revealed{' '}
              <strong>at the in-ceremony season-end reveal only</strong>. Any use beyond the
              ceremony is a separate consent I have not given here. I may revoke before the
              reveal; revoking withholds the letter and never rewrites the sealed record.
            </span>
          </label>

          {error && (
            <p className="mt-4" style={{ color: '#c98a8a', fontSize: '0.9rem' }}>
              {error}
            </p>
          )}

          {!confirming ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
              disabled={!canSeal}
              className="mt-6 rounded px-5 py-2 font-ceremonial text-vault-text"
              style={{
                background: canSeal ? 'rgba(139, 112, 53, 0.85)' : 'rgba(139, 112, 53, 0.25)',
                border: '1px solid rgba(139, 112, 53, 0.5)',
                cursor: canSeal ? 'pointer' : 'not-allowed',
                letterSpacing: '0.03em',
              }}
            >
              Seal this letter
            </button>
          ) : (
            <div
              className="mt-6 rounded p-4"
              style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(139, 112, 53, 0.4)' }}
            >
              <p className="text-vault-text" style={{ marginBottom: '0.9rem' }}>
                Seal permanently? You will not be able to read or edit this letter until the
                season-end reveal. There is no undo.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={seal}
                  disabled={sealing}
                  className="rounded px-5 py-2 font-ceremonial text-vault-text"
                  style={{
                    background: 'rgba(139, 112, 53, 0.9)',
                    border: '1px solid rgba(139, 112, 53, 0.6)',
                    cursor: sealing ? 'wait' : 'pointer',
                    letterSpacing: '0.03em',
                  }}
                >
                  {sealing ? 'Sealing…' : 'Yes, seal it'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={sealing}
                  className="rounded px-5 py-2 text-vault-text"
                  style={{ background: 'transparent', border: '1px solid rgba(139, 112, 53, 0.3)' }}
                >
                  Keep writing
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {sealed.length > 0 && (
        <section className="mt-12" aria-label="Your sealed letters">
          <h2
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}
          >
            Your sealed letters
          </h2>
          <ul className="text-vault-text" style={{ listStyle: 'none', padding: 0, opacity: 0.85 }}>
            {sealed.map((s) => (
              <li
                key={s.id}
                className="py-2"
                style={{ borderBottom: '1px solid rgba(139, 112, 53, 0.18)' }}
              >
                Season {s.season} — sealed {formatSealedAt(s.sealed_at)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-vault-text" style={{ opacity: 0.5, fontSize: '0.85rem' }}>
            Sealed bodies are not shown here, or anywhere, until the reveal.
          </p>
        </section>
      )}
    </div>
  );
}
