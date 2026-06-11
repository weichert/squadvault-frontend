'use client';

// src/components/av-room/room-image.tsx
// W.1 A/V Room - the room's media cell (R3-D1). A client island so a thumb that
// fails to load (no rendition yet) falls back to a placeholder rather than a broken
// image - and NEVER to the full original. The room serves the same small thumb.jpg
// the ingest list serves; the original is reserved for quick-look (R4) and downloads.
//
// Image-only by constitutional line: no <video>, no playback. A video with no poster
// still and a photo with no thumb both resolve to an honest placeholder.
import { useState } from 'react';

export function RoomImage({
  url,
  alt,
  kind,
}: {
  url: string | null;
  alt: string;
  kind: 'photo' | 'video';
}) {
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt}
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }

  // Honest gap. Video without a poster keeps its "playback pending" wording; a photo
  // without a thumb is a transient pre-backfill state.
  return (
    <div style={{ textAlign: 'center', padding: '1rem' }}>
      <span className="font-mono" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--vault-text2)' }}>
        {kind.toUpperCase()}
      </span>
      {kind === 'video' && (
        <p className="font-ui" style={{ fontSize: '0.72rem', color: 'var(--vault-text3)', marginTop: 6, lineHeight: 1.4 }}>
          Playback pending voice attestation
        </p>
      )}
    </div>
  );
}
