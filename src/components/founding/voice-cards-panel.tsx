// src/components/founding/voice-cards-panel.tsx
'use client';

import { VOICE_CARDS } from '@/lib/founding/voice-cards';
import type { VoiceProfileKey } from '@/lib/supabase/types';

export function VoiceCardsPanel({
  onSelect,
  disabled,
}: {
  onSelect: (key: VoiceProfileKey) => void;
  disabled: boolean;
}) {
  return (
    <div style={{ width: '100%', maxWidth: 720 }}>
      <p
        className="font-ui"
        style={{
          color: 'var(--vault-text2)',
          fontSize: '0.9rem',
          marginBottom: '1rem',
        }}
      >
        Choose the voice your league&rsquo;s record should be written in. You can
        change this later.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {VOICE_CARDS.map((card) => (
          <button
            key={card.key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(card.key)}
            className="transition-colors disabled:opacity-50"
            style={{
              textAlign: 'left',
              padding: '1rem',
              background: 'var(--vault-s1)',
              border: '1px solid var(--vault-border)',
              borderRadius: 6,
              cursor: disabled ? 'default' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span
              className="font-ui font-medium"
              style={{ color: 'var(--vault-text)', fontSize: '1rem' }}
            >
              {card.label}
            </span>
            <span
              className="font-ui"
              style={{
                color: 'var(--vault-text2)',
                fontSize: '0.82rem',
                lineHeight: 1.5,
              }}
            >
              {card.blurb}
            </span>
            <span
              className="font-ceremonial"
              style={{
                color: 'var(--vault-text3)',
                fontSize: '0.9rem',
                fontStyle: 'italic',
                lineHeight: 1.45,
              }}
            >
              {card.example}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
