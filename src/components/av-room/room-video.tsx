'use client';

// src/components/av-room/room-video.tsx
// W.1 D-W1-A: the room's VIDEO cell. Members see the poster, the trust-legible attestation
// line, and - where the gate passes - the player. They see NO controls (attestation is the
// commissioner's act on the ingest surface). Playback is fetched on USER INTENT (a Play
// click), never prefetched on grid render; the gate is enforced AT THE ROUTE, so a click
// the gate refuses returns a neutral message and the poster stays. No autoplay, ever;
// preload="metadata". Zero playback logging (invariant 6.3).
import { useState } from 'react';

export function RoomVideo({
  mediaEntryId,
  posterUrl,
  alt,
  attestationLine,
}: {
  mediaEntryId: string;
  posterUrl: string | null;
  alt: string;
  attestationLine: string | null;
}) {
  const [posterFailed, setPosterFailed] = useState(false);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function play() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/av-room/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaEntryId, variant: 'playback' }),
      });
      if (res.ok) {
        const j = (await res.json()) as { url: string };
        setPlayUrl(j.url);
      } else {
        setMsg('Playback gated.');
      }
    } catch {
      setMsg('Could not start playback.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          width: '100%',
          aspectRatio: '4 / 3',
          background: 'var(--vault-s2)',
          border: '1px solid var(--vault-border)',
          borderRadius: 6,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {playUrl ? (
          <video src={playUrl} controls preload="metadata" style={{ width: '100%', height: '100%' }} />
        ) : posterUrl && !posterFailed ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posterUrl}
              alt={alt}
              onError={() => setPosterFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={play}
              className="font-mono"
              style={{
                position: 'absolute',
                padding: '0.4rem 0.9rem',
                border: '1px solid var(--vault-border)',
                borderRadius: 4,
                background: 'rgba(0,0,0,0.55)',
                color: 'var(--vault-text)',
                cursor: busy ? 'default' : 'pointer',
                fontSize: '11px',
                letterSpacing: '0.1em',
              }}
            >
              {busy ? 'STARTING…' : '▶ PLAY'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <span className="font-mono" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--vault-text2)' }}>
              VIDEO
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={play}
              className="font-mono"
              style={{
                display: 'block',
                margin: '8px auto 0',
                padding: '0.3rem 0.7rem',
                border: '1px solid var(--vault-border)',
                borderRadius: 4,
                background: 'var(--vault-s1)',
                color: 'var(--vault-text)',
                cursor: busy ? 'default' : 'pointer',
                fontSize: '11px',
                letterSpacing: '0.1em',
              }}
            >
              {busy ? 'STARTING…' : '▶ PLAY'}
            </button>
          </div>
        )}
      </div>
      {/* Trust legibility: the attestation line, visible to members. */}
      {(attestationLine || msg) && (
        <p className="font-ui" style={{ fontSize: '0.72rem', color: 'var(--vault-text3)', margin: 0 }}>
          {msg ?? attestationLine}
        </p>
      )}
    </div>
  );
}
