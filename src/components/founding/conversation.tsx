// src/components/founding/conversation.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  SessionExchange,
  FoundingSessionState,
  VoiceProfileKey,
} from '@/lib/supabase/types';
import { VoiceCardsPanel } from '@/components/founding/voice-cards-panel';

const PHASES: FoundingSessionState[] = [
  'IN_PROGRESS',
  'CONSENT_COLLECTION',
  'OUTPUT_GENERATION',
  'COMPLETE',
];

function ProgressDots({ state }: { state: FoundingSessionState }) {
  const active = PHASES.indexOf(state);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {PHASES.map((phase, i) => (
        <span
          key={phase}
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: i <= active ? 'var(--vault-gold)' : 'var(--vault-text3)',
          }}
        />
      ))}
    </div>
  );
}

export function FoundingConversation({
  sessionId,
  initialExchanges,
  initialState,
  initialCoveredTopics,
  initialVoiceSelection,
}: {
  sessionId: string;
  initialExchanges: SessionExchange[];
  initialState: FoundingSessionState;
  initialCoveredTopics: string[];
  initialVoiceSelection: VoiceProfileKey | null;
}) {
  const [exchanges, setExchanges] = useState<SessionExchange[]>(initialExchanges);
  const [state, setState] = useState<FoundingSessionState>(initialState);
  const [coveredTopics, setCoveredTopics] =
    useState<string[]>(initialCoveredTopics);
  const [voiceSelection, setVoiceSelection] = useState<VoiceProfileKey | null>(
    initialVoiceSelection,
  );
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [exchanges.length, pending]);

  // Calibration moment (spec 4.5): register discussed, no choice made yet.
  const showVoiceCards =
    coveredTopics.includes('COMPETITION_REGISTER') &&
    !coveredTopics.includes('VOICE_CALIBRATION') &&
    voiceSelection === null;

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    setError(null);
    setPending(true);
    const now = new Date().toISOString();
    setExchanges((prev) => [
      ...prev,
      {
        turn: prev.length + 1,
        role: 'commissioner',
        content: text,
        intent_classified: null,
        created_at: now,
      },
    ]);
    setInput('');
    try {
      const res = await fetch(`/api/founding/${sessionId}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        setError('The vault did not respond. Please try again.');
        return;
      }
      const data = (await res.json()) as {
        reply: string;
        state: FoundingSessionState;
        covered_topics: string[];
      };
      setExchanges((prev) => [
        ...prev,
        {
          turn: prev.length + 1,
          role: 'agent',
          content: data.reply,
          intent_classified: null,
          created_at: new Date().toISOString(),
        },
      ]);
      setState(data.state);
      setCoveredTopics(data.covered_topics);
    } catch {
      setError('The vault did not respond. Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function selectVoice(key: VoiceProfileKey) {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/founding/${sessionId}/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        setError('Could not set the voice. Please try again.');
        return;
      }
      const data = (await res.json()) as {
        selection_message: string;
        reply: string;
        state: FoundingSessionState;
        covered_topics: string[];
        voice_profile_selection: VoiceProfileKey;
      };
      setExchanges((prev) => [
        ...prev,
        {
          turn: prev.length + 1,
          role: 'commissioner',
          content: data.selection_message,
          intent_classified: null,
          created_at: new Date().toISOString(),
        },
        {
          turn: prev.length + 2,
          role: 'agent',
          content: data.reply,
          intent_classified: null,
          created_at: new Date().toISOString(),
        },
      ]);
      setState(data.state);
      setCoveredTopics(data.covered_topics);
      setVoiceSelection(data.voice_profile_selection);
    } catch {
      setError('Could not set the voice. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ alignSelf: 'center', paddingBottom: '1.5rem' }}>
        <ProgressDots state={state} />
      </div>

      <div
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 720,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.75rem',
          overflowY: 'auto',
        }}
      >
        {exchanges.map((ex) => {
          const isAgent = ex.role === 'agent';
          return (
            <div
              key={`${ex.turn}-${ex.created_at}`}
              style={{
                alignSelf: isAgent ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
              }}
            >
              <p
                className={isAgent ? 'font-ceremonial' : 'font-ui'}
                style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                  fontSize: isAgent ? '1.15rem' : '1rem',
                  color: isAgent ? 'var(--vault-text)' : 'var(--vault-text2)',
                }}
              >
                {ex.content}
              </p>
            </div>
          );
        })}
        {pending ? (
          <p
            className="font-ui"
            style={{
              alignSelf: 'flex-start',
              color: 'var(--vault-text3)',
              fontSize: '0.85rem',
            }}
          >
            …
          </p>
        ) : null}
        <div ref={endRef} />
      </div>

      <div style={{ width: '100%', maxWidth: 720, paddingTop: '1.5rem' }}>
        {error ? (
          <p
            className="font-ui"
            style={{
              color: 'var(--vault-withheld)',
              fontSize: '0.85rem',
              marginBottom: '0.75rem',
            }}
          >
            {error}
          </p>
        ) : null}

        {showVoiceCards ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <VoiceCardsPanel onSelect={selectVoice} disabled={pending} />
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Type your reply…"
            disabled={pending}
            className="font-ui"
            style={{
              flex: 1,
              resize: 'none',
              padding: '0.75rem 1rem',
              fontSize: '1rem',
              color: 'var(--vault-text)',
              background: 'var(--vault-s1)',
              border: '1px solid var(--vault-border)',
              borderRadius: 4,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={pending || input.trim().length === 0}
            className="font-ui font-medium transition-colors disabled:opacity-40"
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '0.95rem',
              color: 'var(--vault-bg)',
              background: 'var(--vault-gold)',
              border: 'none',
              borderRadius: 4,
              cursor: pending ? 'default' : 'pointer',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
