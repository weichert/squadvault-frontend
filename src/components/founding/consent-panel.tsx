// src/components/founding/consent-panel.tsx
'use client';

import { useState } from 'react';

export interface ConsentValues {
  photos: boolean;
  voice_recording: boolean;
  text_likeness: boolean;
}

const ITEMS: { key: keyof ConsentValues; title: string; desc: string }[] = [
  {
    key: 'photos',
    title: 'Member photos',
    desc: 'Off by default. When members upload photos, they stay visible only to the league \u2014 each member opts in to share their own.',
  },
  {
    key: 'voice_recording',
    title: 'Voice recordings',
    desc: 'Off by default. An optional feature members can choose later; nothing is recorded now.',
  },
  {
    key: 'text_likeness',
    title: 'Names in the record',
    desc: 'On by default. Members\u2019 names appear in generated artifacts \u2014 central to how the record is written. Any member can opt out from their own settings.',
  },
];

export function ConsentPanel({
  onConfirm,
  disabled,
}: {
  onConfirm: (values: ConsentValues) => void;
  disabled: boolean;
}) {
  const [values, setValues] = useState<ConsentValues>({
    photos: false,
    voice_recording: false,
    text_likeness: true,
  });

  function toggle(key: keyof ConsentValues) {
    setValues((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div style={{ width: '100%', maxWidth: 720 }}>
      <p
        className="font-ui"
        style={{ color: 'var(--vault-text2)', fontSize: '0.9rem', lineHeight: 1.5 }}
      >
        A few choices about how the Clubhouse uses the league&rsquo;s information.
        These are the league defaults &mdash; each member can adjust their own when
        they join.
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginTop: '1rem',
        }}
      >
        {ITEMS.map((item) => {
          const on = values[item.key];
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
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}
              >
                <span
                  className="font-ui font-medium"
                  style={{ color: 'var(--vault-text)', fontSize: '0.95rem' }}
                >
                  {item.title}
                </span>
                <span
                  className="font-ui"
                  style={{
                    color: 'var(--vault-text2)',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                  }}
                >
                  {item.desc}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={item.title}
                disabled={disabled}
                onClick={() => toggle(item.key)}
                className="transition-colors disabled:opacity-50"
                style={{
                  flexShrink: 0,
                  width: 52,
                  height: 28,
                  borderRadius: 999,
                  border: '1px solid var(--vault-border)',
                  background: on ? 'var(--vault-gold)' : 'var(--vault-s1)',
                  position: 'relative',
                  cursor: disabled ? 'default' : 'pointer',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: on ? 27 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: on ? 'var(--vault-bg)' : 'var(--vault-text3)',
                    transition: 'left 120ms ease',
                  }}
                />
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: '1.25rem' }}>
        <button
          type="button"
          onClick={() => onConfirm(values)}
          disabled={disabled}
          className="font-ui font-medium transition-colors disabled:opacity-40"
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.95rem',
            color: 'var(--vault-bg)',
            background: 'var(--vault-gold)',
            border: 'none',
            borderRadius: 4,
            cursor: disabled ? 'default' : 'pointer',
          }}
        >
          Set league defaults
        </button>
      </div>
    </div>
  );
}
