// src/components/av-room/ingest-panel.tsx
'use client';

// W.1 A/V Room ingest panel (spec 5.7) - the commissioner's management surface.
// Upload (photo-first), provenance tagging across the five kinds with a no-vacuous-
// tag guard (contributor/season/event require a value - carry-forward note 2), the
// read-only 2a grant state shown beside member identification (W.6 5), correction-
// by-supersession, item withdrawal, and room ratification. All writes POST to the
// /api/av-room/* routes; RLS is the real boundary. No counts, no nudges (6.3-6.5).
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaKind, MediaProvenanceTagKind, MediaDatePrecision } from '@/lib/supabase/types';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, formatSize } from '@/lib/av-room-limits';
import { createClient } from '@/lib/supabase/client';

export type IngestTag = {
  id: string;
  tagKind: MediaProvenanceTagKind;
  tagValue: string | null;
  datePrecision: MediaDatePrecision | null;
  taggedMemberUserId: string | null;
};

export type IngestEntry = {
  id: string;
  mediaKind: MediaKind;
  uploadNote: string | null;
  createdAt: string;
  withdrawn: boolean;
  hasPoster: boolean;
  tags: IngestTag[];
};

export type IngestMember = {
  memberUserId: string;
  displayName: string;
  granted2a: boolean;
};

const TAG_KIND_LABEL: Record<MediaProvenanceTagKind, string> = {
  contributor: 'Contributor',
  date: 'Date',
  season: 'Season',
  event: 'Event',
  member_identification: 'Member identification',
};

const VALUE_REQUIRED: MediaProvenanceTagKind[] = ['contributor', 'season', 'event'];
const DATE_PRECISIONS: MediaDatePrecision[] = ['exact', 'year', 'season'];

const labelStyle = {
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: 'var(--vault-text2)',
  textTransform: 'uppercase' as const,
};
const inputStyle = {
  width: '100%',
  background: 'var(--vault-s2)',
  border: '1px solid var(--vault-border)',
  borderRadius: 4,
  color: 'var(--vault-text)',
  padding: '0.5rem 0.6rem',
  fontSize: '0.85rem',
};
const cardStyle = {
  background: 'var(--vault-s1)',
  border: '1px solid var(--vault-border)',
  borderRadius: 6,
  padding: '1rem',
};

function btnStyle(disabled: boolean) {
  return {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    padding: '0.5rem 0.9rem',
    borderRadius: 4,
    border: '1px solid var(--vault-border)',
    background: 'var(--vault-s2)',
    color: disabled ? 'var(--vault-text3)' : 'var(--vault-text)',
    cursor: disabled ? 'default' : 'pointer',
  };
}

export function IngestPanel({
  leagueId,
  canonicalId,
  ratified,
  entries,
  members,
}: {
  leagueId: string;
  canonicalId: string;
  ratified: boolean;
  entries: IngestEntry[];
  members: IngestMember[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <RoomRatification leagueId={leagueId} ratified={ratified} />
      <UploadForm leagueId={leagueId} />
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
          <h2 className="font-mono" style={labelStyle}>
            THE CORPUS ({entries.length})
          </h2>
          <a
            href={`/league/${canonicalId}/av-room`}
            className="font-mono"
            style={{ ...labelStyle, color: 'var(--vault-text2)', textDecoration: 'none' }}
          >
            VIEW THE ROOM →
          </a>
        </div>
        {entries.length === 0 ? (
          <p className="font-ui" style={{ color: 'var(--vault-text2)', fontSize: '0.85rem' }}>
            Nothing has been added yet. Upload the first photograph above.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {entries.map((e) => (
              <EntryCard key={e.id} entry={e} members={members} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RoomRatification({ leagueId, ratified }: { leagueId: string; ratified: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ratify() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/av-room/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, scope_note: 'Room shared with the league.' }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Could not ratify the room.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not ratify the room.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={cardStyle}>
      <h2 className="font-mono" style={{ ...labelStyle, marginBottom: '0.5rem' }}>
        ROOM STATUS
      </h2>
      {ratified ? (
        <p className="font-ui" style={{ color: 'var(--vault-text)', fontSize: '0.85rem' }}>
          This room is ratified and visible to the league. Items you add appear once tagged;
          withdrawn items stop showing.
        </p>
      ) : (
        <>
          <p
            className="font-ui"
            style={{ color: 'var(--vault-text2)', fontSize: '0.85rem', marginBottom: '0.75rem' }}
          >
            The room is not yet shared. Until you ratify it, the league sees nothing here.
            Add and tag what you like first; ratify when it is ready.
          </p>
          <button type="button" disabled={busy} onClick={ratify} style={btnStyle(busy)}>
            {busy ? 'Ratifying…' : 'Ratify and share the room'}
          </button>
        </>
      )}
      {error && (
        <p className="font-ui" style={{ color: 'var(--vault-withheld)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          {error}
        </p>
      )}
    </section>
  );
}

// D3: extract a poster still from a selected video, in the browser, as a JPEG blob.
// Best-effort and side-effect-free on failure - any error (codec the browser can't
// decode, a zero-dimension frame, a timeout) resolves to null, and the upload just
// proceeds without a poster (the room falls back to the plain placeholder). This
// reads ONLY the commissioner's own selected file; it is not a 2b read and never
// touches the stored original (6.9 - the original is uploaded unmodified).
function extractPosterBlob(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    // A generous window: a large local video can take several seconds to demux far
    // enough to seek. If decode never gets there (e.g. a codec the browser cannot
    // play, like iPhone HEVC in Chrome), this resolves null and the commissioner
    // sets a poster by hand (D0) - the failure is surfaced, never silent.
    const timeout = setTimeout(() => finish(null), 12000);
    function finish(blob: Blob | null) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(blob);
    }
    function capture() {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        if (!canvas.width || !canvas.height) return finish(null);
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => finish(b), 'image/jpeg', 0.82);
      } catch {
        finish(null);
      }
    }
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      // Seek a touch past the start to avoid an all-black first frame.
      const t = Math.min(0.5, (video.duration || 1) / 2);
      video.onseeked = capture;
      try {
        video.currentTime = t;
      } catch {
        capture();
      }
    };
    video.src = url;
  });
}

function UploadForm({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind: MediaKind | null = file
    ? file.type.startsWith('image/')
      ? 'photo'
      : file.type.startsWith('video/')
        ? 'video'
        : null
    : null;

  // Fail fast before any round-trip: a file over the storage ceiling is refused
  // here, with the exact size and limit, and never leaves the browser (D1).
  const oversized = !!file && file.size > MAX_UPLOAD_BYTES;

  async function submit() {
    if (!file || !kind) {
      setError('Choose an image or video file.');
      return;
    }
    if (oversized) {
      // Defensive: the button is already disabled when oversized, so no request fires.
      setError(`This file is ${formatSize(file.size)}; the limit is ${MAX_UPLOAD_LABEL}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // 1) Mint a grant: commissioner-scoped, single-use, server-chosen path. The
      //    bytes do NOT transit the function (Spec 5.1 Amendment 1).
      const grantRes = await fetch('/api/av-room/upload/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, media_kind: kind, mime: file.type, size: file.size }),
      });
      if (!grantRes.ok) {
        const j = (await grantRes.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Could not start the upload.');
        return;
      }
      const { mediaEntryId, path, token } = (await grantRes.json()) as {
        mediaEntryId: string;
        path: string;
        token: string;
      };

      // 2) Upload the original CLIENT-DIRECT to Storage under the grant - this is the
      //    path that lifts the 4.5 MB function-body ceiling (photos and video alike).
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from('league-media')
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (upErr) {
        const msg = (upErr.message ?? '').toLowerCase();
        if (msg.includes('exceeded') || msg.includes('maximum allowed size') || msg.includes('payload too large')) {
          setError(`The storage limit (${MAX_UPLOAD_LABEL}) rejected this file. Choose a smaller file.`);
        } else {
          setError(`The file could not be uploaded (${upErr.message || 'storage error'}).`);
        }
        return;
      }

      // 3) Finalize the record server-side (insert-after-upload). For a video, attach
      //    a best-effort poster still (D3); the original is already stored unchanged.
      const finalizeForm = new FormData();
      finalizeForm.set('mediaEntryId', mediaEntryId);
      finalizeForm.set('leagueId', leagueId);
      finalizeForm.set('media_kind', kind);
      finalizeForm.set('mime', file.type);
      if (note.trim()) finalizeForm.set('upload_note', note.trim());
      if (kind === 'video') {
        const poster = await extractPosterBlob(file);
        if (poster) finalizeForm.set('poster', poster, 'poster.jpg');
      }
      const finRes = await fetch('/api/av-room/upload/finalize', { method: 'POST', body: finalizeForm });
      if (!finRes.ok) {
        const j = (await finRes.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Upload could not be finalized.');
        return;
      }
      setFile(null);
      setNote('');
      router.refresh();
    } catch {
      setError('Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={cardStyle}>
      <h2 className="font-mono" style={{ ...labelStyle, marginBottom: '0.75rem' }}>
        ADD TO THE RECORD
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 460 }}>
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
          className="font-ui"
          style={{ ...inputStyle, padding: '0.4rem' }}
        />
        {file && (
          <p className="font-mono" style={{ ...labelStyle, color: kind && !oversized ? 'var(--vault-gold)' : 'var(--vault-withheld)' }}>
            {kind ? `${kind.toUpperCase()} · ${file.name}` : 'UNSUPPORTED FILE TYPE'}
          </p>
        )}
        {oversized && file && (
          <p className="font-ui" style={{ color: 'var(--vault-withheld)', fontSize: '0.8rem' }}>
            This file is {formatSize(file.size)}; the limit is {MAX_UPLOAD_LABEL}. Choose a smaller file.
          </p>
        )}
        <div>
          <label className="font-mono" style={labelStyle}>
            Note (optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. From the 1998 draft night"
            className="font-ui"
            style={{ ...inputStyle, marginTop: 4 }}
          />
        </div>
        <button type="button" disabled={busy || !file || !kind || oversized} onClick={submit} style={btnStyle(busy || !file || !kind || oversized)}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        {error && (
          <p className="font-ui" style={{ color: 'var(--vault-withheld)', fontSize: '0.8rem' }}>
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function EntryCard({
  entry,
  members,
}: {
  entry: IngestEntry;
  members: IngestMember[];
}) {
  const router = useRouter();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // D0: commissioner set/replace poster for a video (the honest fallback when
  // auto-extraction could not decode the file).
  const [posterBusy, setPosterBusy] = useState(false);
  const [posterMsg, setPosterMsg] = useState<string | null>(null);

  async function setPoster(img: File) {
    setPosterBusy(true);
    setPosterMsg(null);
    try {
      const fd = new FormData();
      fd.set('mediaEntryId', entry.id);
      fd.set('poster', img);
      const res = await fetch('/api/av-room/poster', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setPosterMsg(j.error ?? 'Could not save the poster.');
        return;
      }
      router.refresh();
    } catch {
      setPosterMsg('Could not save the poster.');
    } finally {
      setPosterBusy(false);
    }
  }

  // Tag-form state.
  const [tagKind, setTagKind] = useState<MediaProvenanceTagKind>('contributor');
  const [tagValue, setTagValue] = useState('');
  const [datePrecision, setDatePrecision] = useState<MediaDatePrecision>('exact');
  const [taggedMember, setTaggedMember] = useState('');
  const [tagNote, setTagNote] = useState('');
  const [supersedes, setSupersedes] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/av-room/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaEntryId: entry.id }),
        });
        if (!res.ok) return;
        const j = (await res.json()) as { url?: string };
        if (active && j.url) setMediaUrl(j.url);
      } catch {
        /* preview is best-effort; tagging does not depend on it */
      }
    })();
    return () => {
      active = false;
    };
  }, [entry.id]);

  const memberName = (uid: string | null) =>
    members.find((m) => m.memberUserId === uid)?.displayName ?? 'Unknown member';
  const selectedMember = members.find((m) => m.memberUserId === taggedMember) ?? null;

  function resetTagForm() {
    setTagValue('');
    setDatePrecision('exact');
    setTaggedMember('');
    setTagNote('');
    setSupersedes(null);
  }

  async function submitTag() {
    setError(null);
    // No-vacuous-tag guard, mirrored from the write path (note 2).
    if (VALUE_REQUIRED.includes(tagKind) && !tagValue.trim()) {
      setError(`${TAG_KIND_LABEL[tagKind]} needs a value.`);
      return;
    }
    if (tagKind === 'date' && !tagValue.trim()) {
      setError('A date needs a value.');
      return;
    }
    if (tagKind === 'member_identification' && !taggedMember) {
      setError('Choose the member to identify.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/av-room/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaEntryId: entry.id,
          tag_kind: tagKind,
          tag_value: tagKind === 'member_identification' ? null : tagValue.trim() || null,
          date_precision: tagKind === 'date' ? datePrecision : null,
          tagged_member_user_id: tagKind === 'member_identification' ? taggedMember : null,
          note: tagNote.trim() || null,
          supersedes,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Could not save the tag.');
        return;
      }
      resetTagForm();
      router.refresh();
    } catch {
      setError('Could not save the tag.');
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!confirm('Withdraw this item from display? The record stands; it stops showing.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/av-room/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaEntryId: entry.id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Could not withdraw.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not withdraw.');
    } finally {
      setBusy(false);
    }
  }

  async function reinstate() {
    if (!confirm('Reinstate this item to display? It will show in the room again.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/av-room/reinstate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaEntryId: entry.id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Could not reinstate.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reinstate.');
    } finally {
      setBusy(false);
    }
  }

  function correct(tag: IngestTag) {
    setTagKind(tag.tagKind);
    setSupersedes(tag.id);
    setError(null);
    if (tag.tagKind === 'member_identification') {
      setTaggedMember(tag.taggedMemberUserId ?? '');
    } else {
      setTagValue(tag.tagValue ?? '');
      if (tag.tagKind === 'date' && tag.datePrecision) setDatePrecision(tag.datePrecision);
    }
  }

  function describeTag(t: IngestTag): string {
    if (t.tagKind === 'member_identification') {
      const m = members.find((x) => x.memberUserId === t.taggedMemberUserId);
      const grant = m ? (m.granted2a ? 'shown' : 'silent — no appearance grant') : 'silent';
      return `${memberName(t.taggedMemberUserId)} (${grant})`;
    }
    if (t.tagKind === 'date') return `${t.tagValue} (${t.datePrecision})`;
    return t.tagValue ?? '';
  }

  return (
    <article style={{ ...cardStyle, opacity: entry.withdrawn ? 0.6 : 1 }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div
          style={{
            width: 120,
            height: 90,
            flexShrink: 0,
            background: 'var(--vault-s3)',
            borderRadius: 4,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {entry.mediaKind === 'photo' && mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt={entry.uploadNote ?? 'Archival photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : entry.mediaKind === 'video' && mediaUrl ? (
            <video src={mediaUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span className="font-mono" style={{ ...labelStyle, color: 'var(--vault-text3)' }}>
              {entry.mediaKind.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span className="font-mono" style={labelStyle}>
              {entry.mediaKind.toUpperCase()} · {new Date(entry.createdAt).toISOString().slice(0, 10)}
              {entry.withdrawn ? ' · WITHDRAWN' : ''}
            </span>
            {entry.withdrawn ? (
              <button type="button" disabled={busy} onClick={reinstate} style={{ ...btnStyle(busy), padding: '0.25rem 0.5rem' }}>
                Reinstate
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={withdraw} style={{ ...btnStyle(busy), padding: '0.25rem 0.5rem' }}>
                Withdraw
              </button>
            )}
          </div>
          {entry.uploadNote && (
            <p className="font-ui" style={{ color: 'var(--vault-text2)', fontSize: '0.82rem', marginTop: 4 }}>
              {entry.uploadNote}
            </p>
          )}

          {/* Current provenance, grouped. Honest gaps: kinds with no tag are absent. */}
          {entry.tags.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0.6rem 0 0' }}>
              {entry.tags.map((t) => (
                <li
                  key={t.id}
                  className="font-ui"
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.8rem', padding: '0.2rem 0', color: 'var(--vault-text2)' }}
                >
                  <span>
                    <span style={{ color: 'var(--vault-text3)' }}>{TAG_KIND_LABEL[t.tagKind]}: </span>
                    <span style={{ color: 'var(--vault-text)' }}>{describeTag(t)}</span>
                  </span>
                  <button type="button" onClick={() => correct(t)} style={{ ...btnStyle(false), padding: '0.1rem 0.4rem' }}>
                    Correct
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* D0: video poster - set/replace by hand when auto-extraction could not
              read the file. Honest gap: a missing poster says so, not nothing. */}
          {entry.mediaKind === 'video' && (
            <div style={{ marginTop: '0.6rem' }}>
              <p
                className="font-ui"
                style={{ fontSize: '0.78rem', color: entry.hasPoster ? 'var(--vault-text2)' : 'var(--vault-withheld)' }}
              >
                {entry.hasPoster
                  ? 'Poster still set — the room shows it for this video.'
                  : 'No still yet — the room shows a placeholder. Auto-extraction could not read this video; set a still by hand.'}
              </p>
              <label className="font-mono" style={{ ...btnStyle(posterBusy), display: 'inline-block', marginTop: 6 }}>
                {posterBusy ? 'Saving…' : entry.hasPoster ? 'Replace poster' : 'Set poster'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={posterBusy}
                  onChange={(e) => {
                    const img = e.target.files?.[0];
                    if (img) void setPoster(img);
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                />
              </label>
              {posterMsg && (
                <p className="font-ui" style={{ color: 'var(--vault-withheld)', fontSize: '0.78rem', marginTop: 4 }}>
                  {posterMsg}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tag form */}
      {!entry.withdrawn && (
        <div style={{ marginTop: '0.9rem', borderTop: '1px solid var(--vault-border)', paddingTop: '0.9rem' }}>
          {supersedes && (
            <p className="font-mono" style={{ ...labelStyle, color: 'var(--vault-gold)', marginBottom: 6 }}>
              CORRECTING AN EARLIER TAG — this supersedes it
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <div>
              <label className="font-mono" style={labelStyle}>Kind</label>
              <select
                value={tagKind}
                onChange={(e) => {
                  setTagKind(e.target.value as MediaProvenanceTagKind);
                  setSupersedes(null);
                }}
                className="font-ui"
                style={{ ...inputStyle, marginTop: 4 }}
              >
                {(Object.keys(TAG_KIND_LABEL) as MediaProvenanceTagKind[]).map((k) => (
                  <option key={k} value={k}>{TAG_KIND_LABEL[k]}</option>
                ))}
              </select>
            </div>

            {tagKind === 'member_identification' ? (
              <div>
                <label className="font-mono" style={labelStyle}>Member</label>
                <select
                  value={taggedMember}
                  onChange={(e) => setTaggedMember(e.target.value)}
                  className="font-ui"
                  style={{ ...inputStyle, marginTop: 4 }}
                >
                  <option value="">Choose…</option>
                  {members.map((m) => (
                    <option key={m.memberUserId} value={m.memberUserId}>{m.displayName}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="font-mono" style={labelStyle}>
                  {tagKind === 'date' ? 'Date value' : 'Value'}
                </label>
                <input
                  type="text"
                  value={tagValue}
                  onChange={(e) => setTagValue(e.target.value)}
                  placeholder={tagKind === 'date' ? 'e.g. 1998 or 1998-09-04' : ''}
                  className="font-ui"
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </div>
            )}

            {tagKind === 'date' && (
              <div>
                <label className="font-mono" style={labelStyle}>Precision</label>
                <select
                  value={datePrecision}
                  onChange={(e) => setDatePrecision(e.target.value as MediaDatePrecision)}
                  className="font-ui"
                  style={{ ...inputStyle, marginTop: 4 }}
                >
                  {DATE_PRECISIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ gridColumn: '1 / -1' }}>
              <label className="font-mono" style={labelStyle}>Note (optional)</label>
              <input
                type="text"
                value={tagNote}
                onChange={(e) => setTagNote(e.target.value)}
                className="font-ui"
                style={{ ...inputStyle, marginTop: 4 }}
              />
            </div>
          </div>

          {/* Read-only 2a grant state beside member identification (W.6 5). */}
          {tagKind === 'member_identification' && selectedMember && (
            <p className="font-ui" style={{ fontSize: '0.78rem', marginTop: 6, color: selectedMember.granted2a ? 'var(--vault-gold)' : 'var(--vault-text2)' }}>
              {selectedMember.granted2a
                ? 'This member has granted appearance — the identification will show in the room.'
                : 'This member has not granted appearance — the identification is recorded but stays silent in the room until they grant it.'}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: '0.75rem' }}>
            <button type="button" disabled={busy} onClick={submitTag} style={btnStyle(busy)}>
              {busy ? 'Saving…' : supersedes ? 'Save correction' : 'Add tag'}
            </button>
            {supersedes && (
              <button type="button" disabled={busy} onClick={resetTagForm} style={btnStyle(busy)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="font-ui" style={{ color: 'var(--vault-withheld)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          {error}
        </p>
      )}
    </article>
  );
}
