'use client';

// src/components/av-room/room-video.tsx
// W.1 D-W1-A: the room's VIDEO cell. Members see the poster, the trust-legible attestation
// line, and - where the gate passes - the player. They see NO controls (attestation is the
// commissioner's act on the ingest surface). Playback is fetched on USER INTENT (a Play
// click), never prefetched on grid render; the gate is enforced AT THE ROUTE, so a click
// the gate refuses returns a neutral message and the poster stays. No autoplay, ever;
// preload="metadata". Zero playback logging (invariant 6.3).
import { useState } from 'react';

type Attestation = {
  state: 'no_member_voice' | 'member_voice_present';
  byName: string | null;
  at: string;
};

export function RoomVideo({
  mediaEntryId,
  posterUrl,
  alt,
  attestation,
}: {
  mediaEntryId: string;
  posterUrl: string | null;
  alt: string;
  attestation: Attestation | null;
}) {
  const [posterFailed, setPosterFailed] = useState(false);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // FIX 4: a member_voice_present attestation is a known gate-fail - no Play affordance.
  const gatedByAttestation = attestation?.state === 'member_voice_present';
  // FIX 3: render the attestation date in viewer-local time (timestamptz -> local), not UTC.
  const attestationLine = attestation
    ? `${attestation.state === 'no_member_voice' ? 'No member voice' : 'Member voice present'} — attested by ${attestation.byName ?? 'the commissioner'}, ${new Date(attestation.at).toLocaleDateString('en-CA')}`
    : null;

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

  const playButton = (label: string, overlay: boolean) => (
    <button
      type="button"
      disabled={busy}
      onClick={play}
      className="font-mono"
      style={{
        ...(overlay ? { position: 'absolute' } : { display: 'block', margin: '8px auto 0' }),
        padding: overlay ? '0.4rem 0.9rem' : '0.3rem 0.7rem',
        border: '1px solid var(--vault-border)',
        borderRadius: 4,
        background: overlay ? 'rgba(0,0,0,0.55)' : 'var(--vault-s1)',
        color: 'var(--vault-text)',
        cursor: busy ? 'default' : 'pointer',
        fontSize: '11px',
        letterSpacing: '0.1em',
      }}
    >
      {label}
    </button>
  );

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
          // FIX 1: key forces a clean mount so the src applies and the request fires.
          <video key={playUrl} src={playUrl} controls playsInline preload="metadata" style={{ width: '100%', height: '100%' }} />
        ) : posterUrl && !posterFailed ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posterUrl}
              alt={alt}
              onError={() => setPosterFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {!gatedByAttestation && playButton(busy ? 'STARTING…' : '▶ PLAY', true)}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <span className="font-mono" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--vault-text2)' }}>
              VIDEO
            </span>
            {!gatedByAttestation && playButton(busy ? 'STARTING…' : '▶ PLAY', false)}
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
