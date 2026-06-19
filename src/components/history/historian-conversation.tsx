'use client';

// src/components/history/historian-conversation.tsx
// L.1 Historian Interviews capture client surface (spec section 5.1 + 5.7). Two states:
//   1. the consent-grant GATE (no session yet) — the member affirms the oral_history_testimony
//      grant; only then does POST /api/history/start record the GRANT, create the session, and
//      seed the opening HISTORIAN turn (GRANT precedes capture, invariant 6.4).
//   2. the interview itself — each member turn appends to the append-only testimony record via
//      POST /api/history/[sessionId]/turn. No output phase; the captured exchanges ARE the
//      record. No counts, nudges, streaks, or reminders.
import { useEffect, useRef, useState } from 'react';

interface ExchangeView {
  turn: number;
  speaker: 'HISTORIAN' | 'MEMBER';
  content: string;
  intent_classified: string | null;
  topic_covered: string | null;
}

interface Props {
  leagueId: string;
  canInterview: boolean;
  memberName: string | null;
  initialSessionId: string | null;
  initialExchanges: ExchangeView[];
}

export function HistorianConversation({
  leagueId,
  canInterview,
  memberName,
  initialSessionId,
  initialExchanges,
}: Props) {
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [exchanges, setExchanges] = useState<ExchangeView[]>(initialExchanges);
  const [consent, setConsent] = useState(false);
  const [beginning, setBeginning] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [exchanges.length, pending]);

  async function begin() {
    if (!consent || beginning) return;
    setBeginning(true);
    setError(null);
    try {
      const res = await fetch('/api/history/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, grantConsent: consent }),
      });
      const data = (await res.json()) as {
        sessionId?: string;
        exchanges?: ExchangeView[];
        error?: string;
      };
      if (!res.ok || !data.sessionId) {
        setError(data.error ?? 'Could not begin the interview.');
        return;
      }
      setSessionId(data.sessionId);
      setExchanges(data.exchanges ?? []);
    } catch {
      setError('Could not reach the Historian. Please try again.');
    } finally {
      setBeginning(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || pending || !sessionId) return;
    setError(null);
    setPending(true);
    const nextTurn = exchanges.reduce((m, e) => Math.max(m, e.turn), 0) + 1;
    setExchanges((prev) => [
      ...prev,
      { turn: nextTurn, speaker: 'MEMBER', content: text, intent_classified: null, topic_covered: null },
    ]);
    setInput('');
    try {
      const res = await fetch(`/api/history/${sessionId}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'The historian did not respond. Please try again.');
        return;
      }
      const data = (await res.json()) as { reply: string };
      setExchanges((prev) => [
        ...prev,
        {
          turn: nextTurn + 1,
          speaker: 'HISTORIAN',
          content: data.reply,
          intent_classified: null,
          topic_covered: null,
        },
      ]);
    } catch {
      setError('The historian did not respond. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (!canInterview) {
    return (
      <p className="text-vault-text" style={{ opacity: 0.75 }}>
        Only a franchise-linked member can sit for an interview. Once your commissioner has
        linked your franchise, this is where the historian meets you.
      </p>
    );
  }

  // State 1 — the consent-grant gate (no session yet).
  if (!sessionId) {
    return (
      <section aria-label="Begin your oral-history interview">
        {memberName && (
          <p className="mb-3 text-vault-text" style={{ opacity: 0.6, fontSize: '0.9rem' }}>
            Recording as {memberName}
          </p>
        )}
        <p className="text-vault-text mb-6" style={{ opacity: 0.85, lineHeight: 1.6 }}>
          When you&rsquo;re ready, the historian will begin with a single question and follow
          your memory from there. Nothing is published — this is the league keeping your account,
          in your words.
        </p>

        <label
          className="flex items-start gap-3 text-vault-text"
          style={{ opacity: 0.85, fontSize: '0.92rem', cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={beginning}
            style={{ marginTop: '0.25rem' }}
          />
          <span>
            I grant <strong>oral_history_testimony</strong> consent: my account may be kept as
            attributed testimony in the league record. It is never merged into a consensus, and I
            may revoke at any time — revoking withholds future display and never rewrites what I
            said.
          </span>
        </label>

        {error && (
          <p className="mt-4" style={{ color: '#c98a8a', fontSize: '0.9rem' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void begin()}
          disabled={!consent || beginning}
          className="mt-6 rounded px-5 py-2 font-ceremonial text-vault-text"
          style={{
            background: consent ? 'rgba(139, 112, 53, 0.85)' : 'rgba(139, 112, 53, 0.25)',
            border: '1px solid rgba(139, 112, 53, 0.5)',
            cursor: consent && !beginning ? 'pointer' : 'not-allowed',
            letterSpacing: '0.03em',
          }}
        >
          {beginning ? 'Beginning…' : 'Begin the interview'}
        </button>
      </section>
    );
  }

  // State 2 — the interview.
  return (
    <section aria-label="Your oral-history interview">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {exchanges.map((ex) => {
          const isHistorian = ex.speaker === 'HISTORIAN';
          return (
            <div
              key={`${ex.turn}-${ex.speaker}`}
              style={{ alignSelf: isHistorian ? 'flex-start' : 'flex-end', maxWidth: '85%' }}
            >
              <p
                className={isHistorian ? 'font-ceremonial' : 'font-ui'}
                style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                  fontSize: isHistorian ? '1.12rem' : '1rem',
                  color: isHistorian ? 'var(--vault-text)' : 'var(--vault-text2)',
                }}
              >
                {ex.content}
              </p>
            </div>
          );
        })}
        {pending && (
          <p
            className="font-ui"
            style={{ alignSelf: 'flex-start', color: 'var(--vault-text3)', fontSize: '0.85rem' }}
          >
            …
          </p>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="mt-4" style={{ color: '#c98a8a', fontSize: '0.9rem' }}>
          {error}
        </p>
      )}

      <div className="mt-8" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="Tell the historian…"
          disabled={pending}
          className="flex-1 rounded p-3 text-vault-text"
          style={{
            background: 'rgba(0,0,0,0.18)',
            border: '1px solid rgba(139, 112, 53, 0.3)',
            resize: 'vertical',
            fontFamily: 'inherit',
            lineHeight: 1.6,
          }}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={pending || input.trim().length === 0}
          className="rounded px-5 py-3 font-ceremonial text-vault-text disabled:opacity-40"
          style={{
            background: 'rgba(139, 112, 53, 0.85)',
            border: '1px solid rgba(139, 112, 53, 0.5)',
            cursor: pending ? 'wait' : 'pointer',
            letterSpacing: '0.03em',
          }}
        >
          Send
        </button>
      </div>
      <p className="mt-4 text-vault-text" style={{ opacity: 0.5, fontSize: '0.85rem' }}>
        Your account is kept exactly as you tell it. Close the page anytime — what you&rsquo;ve
        said is already saved.
      </p>
    </section>
  );
}
