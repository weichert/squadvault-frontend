// src/components/consent/member-consent-panel.tsx
'use client';

// W.6 member consent panel (ratified memo, section 5). The member's own current
// state + one-tap grant/revoke + their event history. Subject = the
// authenticated person (W.6 1.2). Default-no-use: a category with no current
// GRANT shows as not shared (W.6 1.4). synthesized_voice (2e) is NOT grantable
// here — it is scoped per rendering class and no synthesis class is admitted
// (W.6 2e / Part 8); it renders as informational only.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  MemberConsentCategory,
  MemberConsentEvent,
  MemberConsentEventType,
} from '@/lib/supabase/types';

export type ConsentCurrentState = Partial<
  Record<MemberConsentCategory, MemberConsentEventType>
>;

const GRANTABLE: { key: MemberConsentCategory; title: string; desc: string }[] = [
  {
    key: 'media_appearance',
    title: 'Appearing in league media',
    desc: 'Off by default. Lets the league identify and show you in archival photos and video — a tagged face in a real team photo. Nothing of you is shown until you turn this on.',
  },
  {
    key: 'recorded_voice',
    title: 'Voice recordings',
    desc: 'Off by default. Lets the league capture and play back your actual voice — a message on the clubhouse answering machine, say. Recording only; your voice is never synthesized.',
  },
  {
    key: 'likeness_derived',
    title: 'Your image in made artifacts',
    desc: 'Off by default. Lets your image appear in rendered pieces — a Gazette front page, a press-conference card. Separate from a real archival photo above.',
  },
  {
    key: 'attributed_quotes',
    title: 'Your words, attributed',
    desc: 'Off by default. Lets things you say — an interview answer, a caption, a sealed-letter reveal — be kept as attributed quotes in the league record.',
  },
];

const CATEGORY_LABEL: Record<MemberConsentCategory, string> = {
  media_appearance: 'Appearing in league media',
  recorded_voice: 'Voice recordings',
  likeness_derived: 'Your image in made artifacts',
  attributed_quotes: 'Your words, attributed',
  synthesized_voice: 'Synthesized voice',
};

export function MemberConsentPanel({
  leagueId,
  current,
  history,
}: {
  leagueId: string;
  current: ConsentCurrentState;
  history: MemberConsentEvent[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<MemberConsentCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(category: MemberConsentCategory, currentlyGranted: boolean) {
    setBusy(category);
    setError(null);
    try {
      const res = await fetch('/api/consent/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          category,
          event_type: currentlyGranted ? 'REVOKE' : 'GRANT',
          context: 'member_office_settings',
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Could not save that change.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not save that change.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 720 }}>
      <p
        className="font-ui"
        style={{ color: 'var(--vault-text2)', fontSize: '0.9rem', lineHeight: 1.5 }}
      >
        These are yours, and only yours. Each is off until you turn it on, every
        choice is recorded with the date, and you can turn any of them back off at
        any time &mdash; doing so stops future use; it never rewrites what the
        record already kept.
      </p>

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: '1rem' }}
      >
        {GRANTABLE.map((item) => {
          const granted = current[item.key] === 'GRANT';
          const isBusy = busy === item.key;
          return (
            <div
              key={item.key}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '0.9rem 1rem',
                background: 'var(--vault-s1)',
                border: '1px solid var(--vault-border)',
                borderRadius: 6,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <span
                  className="font-ui font-medium"
                  style={{ color: 'var(--vault-text)', fontSize: '0.95rem' }}
                >
                  {item.title}
                </span>
                <span
                  className="font-ui"
                  style={{ color: 'var(--vault-text2)', fontSize: '0.82rem', lineHeight: 1.5 }}
                >
                  {item.desc}
                </span>
                <span
                  className="font-mono"
                  style={{
                    marginTop: 4,
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    color: granted ? 'var(--vault-gold)' : 'var(--vault-text3)',
                  }}
                >
                  {granted ? 'SHARED' : 'NOT SHARED'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={granted}
                aria-label={item.title}
                disabled={isBusy}
                onClick={() => act(item.key, granted)}
                className="transition-colors disabled:opacity-50"
                style={{
                  flexShrink: 0,
                  width: 52,
                  height: 28,
                  borderRadius: 999,
                  border: '1px solid var(--vault-border)',
                  background: granted ? 'var(--vault-gold)' : 'var(--vault-s1)',
                  position: 'relative',
                  cursor: isBusy ? 'default' : 'pointer',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: granted ? 27 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: granted ? 'var(--vault-bg)' : 'var(--vault-text3)',
                    transition: 'left 120ms ease',
                  }}
                />
              </button>
            </div>
          );
        })}

        {/* synthesized_voice (2e): informational only — never grantable here. */}
        <div
          style={{
            padding: '0.9rem 1rem',
            background: 'var(--vault-s1)',
            border: '1px dashed var(--vault-border)',
            borderRadius: 6,
            opacity: 0.85,
          }}
        >
          <span
            className="font-ui font-medium"
            style={{ color: 'var(--vault-text)', fontSize: '0.95rem' }}
          >
            Synthesized voice
          </span>
          <p
            className="font-ui"
            style={{
              color: 'var(--vault-text2)',
              fontSize: '0.82rem',
              lineHeight: 1.5,
              marginTop: 4,
            }}
          >
            There are no voice-synthesis features, and none are enabled by anything
            here. If one is ever built, you&rsquo;ll be asked to opt in to that
            specific feature on its own &mdash; never as part of these settings.
          </p>
        </div>
      </div>

      {error && (
        <p
          className="font-ui"
          style={{ color: 'var(--vault-danger, #c0564b)', fontSize: '0.82rem', marginTop: '0.75rem' }}
        >
          {error}
        </p>
      )}

      {history.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h3
            className="font-mono"
            style={{
              fontSize: '10px',
              letterSpacing: '0.12em',
              color: 'var(--vault-text2)',
              fontWeight: 400,
            }}
          >
            YOUR HISTORY
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0' }}>
            {history.map((e) => (
              <li
                key={e.id}
                className="font-ui"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--vault-border)',
                  fontSize: '0.82rem',
                  color: 'var(--vault-text2)',
                }}
              >
                <span style={{ color: 'var(--vault-text)' }}>
                  {e.event_type === 'GRANT' ? 'Turned on' : 'Turned off'}
                  {': '}
                  {CATEGORY_LABEL[e.category]}
                  {e.rendering_class ? ` (${e.rendering_class})` : ''}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {new Date(e.recorded_at).toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
