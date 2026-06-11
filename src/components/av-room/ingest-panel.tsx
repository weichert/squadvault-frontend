// src/components/av-room/ingest-panel.tsx
'use client';

// W.1 A/V Room ingest panel (spec 5.7) - the commissioner's management surface.
// Upload (photo-first), provenance tagging across the five kinds with a no-vacuous-
// tag guard (contributor/season/event require a value - carry-forward note 2), the
// read-only 2a grant state shown beside member identification (W.6 5), correction-
// by-supersession, item withdrawal, and room ratification. All writes POST to the
// /api/av-room/* routes; RLS is the real boundary. No counts, no nudges (6.3-6.5).
import { useRef, useState } from 'react';
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
  thumbUrl: string | null;
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

// D3 (round 2): find-without-scrolling. Deterministic filters only - exact-match
// selectors (kind, season, event, withdrawn-state) compose by AND, and a plain
// case-insensitive substring over note + tag values. No ranking, no relevance
// ordering: the corpus order is never disturbed (constitutional line).
type WithdrawnFilter = 'all' | 'live' | 'withdrawn';

type CorpusFilterState = {
  kind: 'all' | MediaKind;
  season: string;
  event: string;
  withdrawn: WithdrawnFilter;
  text: string;
};

const EMPTY_FILTERS: CorpusFilterState = { kind: 'all', season: '', event: '', withdrawn: 'all', text: '' };

// Distinct values for a tag kind, sorted only to order the SELECTOR options - this
// orders the dropdown, never the corpus.
function distinctTagValues(entries: IngestEntry[], kind: MediaProvenanceTagKind): string[] {
  const seen = new Set<string>();
  for (const e of entries) {
    for (const t of e.tags) {
      if (t.tagKind === kind && t.tagValue) seen.add(t.tagValue);
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

function matchesFilters(entry: IngestEntry, f: CorpusFilterState): boolean {
  if (f.kind !== 'all' && entry.mediaKind !== f.kind) return false;
  if (f.withdrawn === 'live' && entry.withdrawn) return false;
  if (f.withdrawn === 'withdrawn' && !entry.withdrawn) return false;
  if (f.season && !entry.tags.some((t) => t.tagKind === 'season' && t.tagValue === f.season)) return false;
  if (f.event && !entry.tags.some((t) => t.tagKind === 'event' && t.tagValue === f.event)) return false;
  const needle = f.text.trim().toLowerCase();
  if (needle) {
    const hay = [entry.uploadNote ?? '', ...entry.tags.map((t) => t.tagValue ?? '')].join(' ').toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

function filtersActive(f: CorpusFilterState): boolean {
  return f.kind !== 'all' || f.withdrawn !== 'all' || !!f.season || !!f.event || !!f.text.trim();
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
  const router = useRouter();
  // D2: batch tagging - selection lifted here so one tag applies across many items.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }
  // D3: deterministic filters narrow the corpus before render. Selectors derive
  // their options from what the corpus actually carries.
  const [filters, setFilters] = useState<CorpusFilterState>(EMPTY_FILTERS);
  const seasons = distinctTagValues(entries, 'season');
  const events = distinctTagValues(entries, 'event');
  const visibleEntries = entries.filter((e) => matchesFilters(e, filters));
  // Keep selection from going stale: batch tagging only acts on items in view, so
  // an item filtered off-screen is not silently tagged.
  const presentIds = new Set(visibleEntries.map((e) => e.id));
  const selectedIds = Array.from(selected).filter((id) => presentIds.has(id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <RoomRatification leagueId={leagueId} ratified={ratified} />
      <UploadForm leagueId={leagueId} />
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
          <h2 className="font-mono" style={labelStyle}>
            THE CORPUS ({filtersActive(filters) ? `${visibleEntries.length} OF ${entries.length}` : entries.length})
          </h2>
          <a
            href={`/league/${canonicalId}/av-room`}
            className="font-mono"
            style={{ ...labelStyle, color: 'var(--vault-text2)', textDecoration: 'none' }}
          >
            VIEW THE ROOM →
          </a>
        </div>
        {entries.length > 0 && (
          <CorpusFilters
            filters={filters}
            seasons={seasons}
            events={events}
            onChange={setFilters}
            onReset={() => setFilters(EMPTY_FILTERS)}
          />
        )}
        {selectedIds.length > 0 && (
          <BatchTagBar
            selectedIds={selectedIds}
            onDone={() => {
              clearSelection();
              router.refresh();
            }}
            onClear={clearSelection}
          />
        )}
        {entries.length === 0 ? (
          <p className="font-ui" style={{ color: 'var(--vault-text2)', fontSize: '0.85rem' }}>
            Nothing has been added yet. Upload the first photograph above.
          </p>
        ) : visibleEntries.length === 0 ? (
          <p className="font-ui" style={{ color: 'var(--vault-text2)', fontSize: '0.85rem' }}>
            No items match these filters.{' '}
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="font-mono"
              style={{ ...btnStyle(false), padding: '0.2rem 0.5rem', marginLeft: 4 }}
            >
              Clear filters
            </button>
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {visibleEntries.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                members={members}
                selectable={!e.withdrawn}
                selected={selected.has(e.id)}
                onToggleSelect={() => toggleSelect(e.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CorpusFilters({
  filters,
  seasons,
  events,
  onChange,
  onReset,
}: {
  filters: CorpusFilterState;
  seasons: string[];
  events: string[];
  onChange: (f: CorpusFilterState) => void;
  onReset: () => void;
}) {
  const selStyle = { ...inputStyle, width: 'auto', padding: '0.35rem 0.5rem', fontSize: '0.8rem' };
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        alignItems: 'center',
        marginBottom: '1rem',
        padding: '0.6rem 0.7rem',
        background: 'var(--vault-s1)',
        border: '1px solid var(--vault-border)',
        borderRadius: 6,
      }}
    >
      <span className="font-mono" style={labelStyle}>FILTER</span>
      <select
        aria-label="Filter by media kind"
        value={filters.kind}
        onChange={(e) => onChange({ ...filters, kind: e.target.value as 'all' | MediaKind })}
        className="font-ui"
        style={selStyle}
      >
        <option value="all">All kinds</option>
        <option value="photo">Photo</option>
        <option value="video">Video</option>
      </select>
      <select
        aria-label="Filter by season tag"
        value={filters.season}
        onChange={(e) => onChange({ ...filters, season: e.target.value })}
        className="font-ui"
        style={selStyle}
        disabled={seasons.length === 0}
      >
        <option value="">All seasons</option>
        {seasons.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select
        aria-label="Filter by event tag"
        value={filters.event}
        onChange={(e) => onChange({ ...filters, event: e.target.value })}
        className="font-ui"
        style={selStyle}
        disabled={events.length === 0}
      >
        <option value="">All events</option>
        {events.map((ev) => (
          <option key={ev} value={ev}>{ev}</option>
        ))}
      </select>
      <select
        aria-label="Filter by withdrawn state"
        value={filters.withdrawn}
        onChange={(e) => onChange({ ...filters, withdrawn: e.target.value as WithdrawnFilter })}
        className="font-ui"
        style={selStyle}
      >
        <option value="all">Live + withdrawn</option>
        <option value="live">Live only</option>
        <option value="withdrawn">Withdrawn only</option>
      </select>
      <input
        type="text"
        aria-label="Match note or tag text"
        value={filters.text}
        onChange={(e) => onChange({ ...filters, text: e.target.value })}
        placeholder="Match note or tag text"
        className="font-ui"
        style={{ ...selStyle, flex: 1, minWidth: 140 }}
      />
      {filtersActive(filters) && (
        <button type="button" onClick={onReset} className="font-mono" style={{ ...btnStyle(false), padding: '0.35rem 0.6rem' }}>
          Clear
        </button>
      )}
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

// D6 HEIC honesty (module-level so single + queue paths share it). iPhone photos
// default to HEIC/HEIF, which browsers can't render in an <img>, so storing one only
// yields a broken thumbnail. Some browsers leave file.type empty, so also sniff ext.
function isHeicFile(file: File): boolean {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

function mediaKindFor(file: File): MediaKind | null {
  if (file.type.startsWith('image/')) return 'photo';
  if (file.type.startsWith('video/')) return 'video';
  return null;
}

// Upload one file through the remedy-B flow (grant -> client-direct -> finalize),
// with the honest per-file pre-checks (D6/D1). Throws an Error whose message is the
// human reason on any failure, so the queue can isolate it per file (D1).
async function uploadOneFile(file: File, leagueId: string, note: string): Promise<void> {
  const kind = mediaKindFor(file);
  if (!kind) throw new Error('Unsupported file type — choose an image or video.');
  if (isHeicFile(file)) {
    throw new Error('HEIC is not supported. Export the photo as JPEG and upload that.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`This file is ${formatSize(file.size)}; the limit is ${MAX_UPLOAD_LABEL}.`);
  }

  const grantRes = await fetch('/api/av-room/upload/grant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leagueId, media_kind: kind, mime: file.type, size: file.size }),
  });
  if (!grantRes.ok) {
    const j = (await grantRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? 'Could not start the upload.');
  }
  const { mediaEntryId, path, token } = (await grantRes.json()) as {
    mediaEntryId: string;
    path: string;
    token: string;
  };

  const supabase = createClient();
  const { error: upErr } = await supabase.storage
    .from('league-media')
    .uploadToSignedUrl(path, token, file, { contentType: file.type });
  if (upErr) {
    const msg = (upErr.message ?? '').toLowerCase();
    if (msg.includes('exceeded') || msg.includes('maximum allowed size') || msg.includes('payload too large')) {
      throw new Error(`The storage limit (${MAX_UPLOAD_LABEL}) rejected this file.`);
    }
    throw new Error(`The file could not be uploaded (${upErr.message || 'storage error'}).`);
  }

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
    throw new Error(j.error ?? 'Upload could not be finalized.');
  }
}

type QueueItem = {
  id: string;
  name: string;
  status: 'queued' | 'uploading' | 'done' | 'failed';
  reason?: string;
};

const UPLOAD_CONCURRENCY = 3;

function UploadForm({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Refs the worker pool reads synchronously: the live queue (file + claim) and a
  // single-runner guard. State mirrors them for rendering. Claiming via the ref
  // prevents two workers grabbing the same item before a re-render lands.
  const queueRef = useRef<{ id: string; file: File }[]>([]);
  const claimedRef = useRef<Set<string>>(new Set());
  const runningRef = useRef(false);
  const noteRef = useRef('');
  noteRef.current = note;

  function setItem(id: string, patch: Partial<QueueItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const additions = Array.from(fileList).map((file) => ({ id: crypto.randomUUID(), file }));
    queueRef.current.push(...additions);
    setItems((prev) => [
      ...prev,
      ...additions.map((a) => ({ id: a.id, name: a.file.name, status: 'queued' as const })),
    ]);
    void ensureRunning();
  }

  async function ensureRunning() {
    if (runningRef.current) return;
    runningRef.current = true;

    const worker = async () => {
      for (;;) {
        const next = queueRef.current.find((q) => !claimedRef.current.has(q.id));
        if (!next) break;
        claimedRef.current.add(next.id);
        setItem(next.id, { status: 'uploading' });
        try {
          await uploadOneFile(next.file, leagueId, noteRef.current);
          setItem(next.id, { status: 'done' });
        } catch (e) {
          setItem(next.id, { status: 'failed', reason: (e as Error).message });
        } finally {
          // Drop from the live queue either way; failures stay in `items` for display.
          queueRef.current = queueRef.current.filter((q) => q.id !== next.id);
        }
      }
    };

    await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, () => worker()));
    runningRef.current = false;
    // Successes are now corpus rows; clear them and reveal the new entries.
    setItems((prev) => prev.filter((it) => it.status !== 'done'));
    router.refresh();
  }

  const active = items.some((it) => it.status === 'queued' || it.status === 'uploading');

  return (
    <section style={cardStyle}>
      <h2 className="font-mono" style={{ ...labelStyle, marginBottom: '0.75rem' }}>
        ADD TO THE RECORD
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 460 }}>
        {/* D1: drag-drop N files (or click to choose). Each is queued through the
            remedy-B flow with bounded concurrency and per-file failure isolation. */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className="font-ui"
          style={{
            display: 'block',
            border: `1px dashed ${dragOver ? 'var(--vault-gold)' : 'var(--vault-border)'}`,
            borderRadius: 6,
            padding: '1.25rem',
            textAlign: 'center',
            color: 'var(--vault-text2)',
            fontSize: '0.85rem',
            cursor: 'pointer',
            background: dragOver ? 'var(--vault-s2)' : 'transparent',
          }}
        >
          Drop photos or video here, or click to choose. You can add several at once.
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
            style={{ display: 'none' }}
          />
        </label>

        <div>
          <label className="font-mono" style={labelStyle}>
            Note (optional, applied to this batch)
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

        {items.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map((it) => (
              <li
                key={it.id}
                className="font-ui"
                style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.8rem' }}
              >
                <span style={{ color: 'var(--vault-text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.name}
                </span>
                <span
                  className="font-mono"
                  style={{
                    flexShrink: 0,
                    fontSize: '10px',
                    letterSpacing: '0.08em',
                    color:
                      it.status === 'failed'
                        ? 'var(--vault-withheld)'
                        : it.status === 'done'
                          ? 'var(--vault-gold)'
                          : 'var(--vault-text3)',
                  }}
                >
                  {it.status === 'queued'
                    ? 'QUEUED'
                    : it.status === 'uploading'
                      ? 'UPLOADING…'
                      : it.status === 'done'
                        ? 'DONE'
                        : `FAILED — ${it.reason ?? 'error'}`}
                </span>
              </li>
            ))}
          </ul>
        )}

        {active && (
          <p className="font-mono" style={{ ...labelStyle, color: 'var(--vault-text3)' }}>
            UPLOADING…
          </p>
        )}
      </div>
    </section>
  );
}

// D2: batch tagging is restricted to the value-bearing provenance kinds; date needs
// a precision and member_identification needs a per-item subject, so neither is a
// sensible bulk apply. No new tag kinds - each application is an ordinary tag event.
const BATCH_TAG_KINDS: { kind: MediaProvenanceTagKind; label: string }[] = [
  { kind: 'contributor', label: 'Contributor' },
  { kind: 'season', label: 'Season' },
  { kind: 'event', label: 'Event' },
];

function BatchTagBar({
  selectedIds,
  onDone,
  onClear,
}: {
  selectedIds: string[];
  onDone: () => void;
  onClear: () => void;
}) {
  const [kind, setKind] = useState<MediaProvenanceTagKind>('season');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function apply() {
    if (!value.trim()) {
      setMsg('Enter a value to apply.');
      return;
    }
    setBusy(true);
    setMsg(null);
    let ok = 0;
    let failed = 0;
    // One ordinary tag event PER ITEM via the same route - append-only, attributed
    // to the acting commissioner. A UI convenience, not a new fact shape. Sequential
    // keeps it simple and bounded (a handful at a time is the real use).
    for (const id of selectedIds) {
      try {
        const res = await fetch('/api/av-room/tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaEntryId: id,
            tag_kind: kind,
            tag_value: value.trim(),
            date_precision: null,
            tagged_member_user_id: null,
            note: null,
            supersedes: null,
          }),
        });
        if (res.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBusy(false);
    setValue('');
    if (failed === 0) {
      onDone();
    } else {
      setMsg(`Applied to ${ok}; ${failed} could not be saved.`);
      onDone();
    }
  }

  return (
    <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: 'var(--vault-gold)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span className="font-mono" style={{ ...labelStyle, color: 'var(--vault-gold)', paddingBottom: 6 }}>
          {selectedIds.length} SELECTED
        </span>
        <div>
          <label className="font-mono" style={labelStyle}>Kind</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MediaProvenanceTagKind)}
            className="font-ui"
            style={{ ...inputStyle, marginTop: 4, width: 'auto' }}
          >
            {BATCH_TAG_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>{k.label}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label className="font-mono" style={labelStyle}>Value</label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="font-ui"
            style={{ ...inputStyle, marginTop: 4 }}
            placeholder="e.g. 2019"
          />
        </div>
        <button type="button" disabled={busy} onClick={apply} style={btnStyle(busy)}>
          {busy ? 'Applying…' : `Apply to ${selectedIds.length}`}
        </button>
        <button type="button" disabled={busy} onClick={onClear} style={btnStyle(busy)}>
          Clear
        </button>
      </div>
      {msg && (
        <p className="font-ui" style={{ color: 'var(--vault-withheld)', fontSize: '0.8rem', marginTop: 6 }}>
          {msg}
        </p>
      )}
    </div>
  );
}

function EntryCard({
  entry,
  members,
  selectable,
  selected,
  onToggleSelect,
}: {
  entry: IngestEntry;
  members: IngestMember[];
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // D0: commissioner set/replace poster for a video (the honest fallback when
  // auto-extraction could not decode the file).
  const [posterBusy, setPosterBusy] = useState(false);
  const [posterMsg, setPosterMsg] = useState<string | null>(null);

  // D3: the edit affordances (tag form + poster) collapse behind a toggle so a large
  // corpus stays scannable; the default row is thumbnail + current tags + actions.
  const [expanded, setExpanded] = useState(false);

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
    setExpanded(true); // D3: Correct on a collapsed row reveals the form.
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
    <article style={{ ...cardStyle, padding: '0.55rem 0.7rem', opacity: entry.withdrawn ? 0.6 : 1, outline: selected ? '1px solid var(--vault-gold)' : 'none' }}>
      {/* D2 (round 2): compact default row - thumbnail + title/note + kind/date ONLY.
          All tag detail and the tag form live behind the per-item expand. */}
      <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label="Select for batch tagging"
            style={{ width: 16, height: 16, accentColor: 'var(--vault-gold)', cursor: 'pointer', flexShrink: 0 }}
          />
        )}
        <div
          style={{
            width: 52,
            height: 52,
            flexShrink: 0,
            background: 'var(--vault-s3)',
            borderRadius: 4,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {entry.thumbUrl ? (
            // Photo -> its original; video -> the SAME poster the room reads. Image-only.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.thumbUrl} alt={entry.uploadNote ?? `Archival ${entry.mediaKind}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.1em', color: 'var(--vault-text3)' }}>
              {entry.mediaKind.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-mono" style={labelStyle}>
            {entry.mediaKind.toUpperCase()} · {new Date(entry.createdAt).toISOString().slice(0, 10)}
            {entry.tags.length > 0 ? ` · ${entry.tags.length} tag${entry.tags.length === 1 ? '' : 's'}` : ''}
            {entry.withdrawn ? ' · WITHDRAWN' : ''}
          </div>
          {entry.uploadNote && (
            <p
              className="font-ui"
              title={entry.uploadNote}
              style={{ color: 'var(--vault-text2)', fontSize: '0.82rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {entry.uploadNote}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {entry.withdrawn ? (
            <button type="button" disabled={busy} onClick={reinstate} style={{ ...btnStyle(busy), padding: '0.25rem 0.5rem' }}>
              Reinstate
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={withdraw} style={{ ...btnStyle(busy), padding: '0.25rem 0.5rem' }}>
              Withdraw
            </button>
          )}
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)} className="font-mono" style={{ ...btnStyle(false), padding: '0.25rem 0.5rem' }}>
            {expanded ? 'Hide' : 'Details'}
          </button>
        </div>
      </div>

      {/* D2 (round 2): expand reveals the full provenance + (for live items) the edit
          affordances. Available for withdrawn items too, so their tags stay viewable. */}
      {expanded && (
        <div style={{ marginTop: '0.7rem', borderTop: '1px solid var(--vault-border)', paddingTop: '0.7rem' }}>
          {/* D2 (round 2): the compact row ellipsizes the note; restore it in full here
              so a long note stays readable, not just hover-able. */}
          {entry.uploadNote && (
            <p className="font-ui" style={{ color: 'var(--vault-text2)', fontSize: '0.82rem', margin: '0 0 0.6rem' }}>
              {entry.uploadNote}
            </p>
          )}
          {/* Current provenance, grouped. Honest gaps: kinds with no tag are absent. */}
          {entry.tags.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.6rem' }}>
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
                  {!entry.withdrawn && (
                    <button type="button" onClick={() => correct(t)} style={{ ...btnStyle(false), padding: '0.1rem 0.4rem' }}>
                      Correct
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-ui" style={{ color: 'var(--vault-text3)', fontSize: '0.78rem', margin: '0 0 0.6rem' }}>
              No tags yet.
            </p>
          )}
          {!entry.withdrawn && (
            <>
              {/* D0: video poster - set/replace by hand when auto-extraction could not
                  read the file. Honest gap: a missing poster says so, not nothing. */}
              {entry.mediaKind === 'video' && (
                <div style={{ marginBottom: '0.9rem' }}>
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
            </>
          )}
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
