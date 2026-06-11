// src/components/av-room/ingest-panel.tsx
'use client';

// W.1 A/V Room ingest panel (spec 5.7) - the commissioner's management surface.
// Upload (photo-first), provenance tagging across the five kinds with a no-vacuous-
// tag guard (contributor/season/event require a value - carry-forward note 2), the
// read-only 2a grant state shown beside member identification (W.6 5), correction-
// by-supersession, item withdrawal, and room ratification. All writes POST to the
// /api/av-room/* routes; RLS is the real boundary. No counts, no nudges (6.3-6.5).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
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

// R4-D5: tag-ABSENCE filter. 'all' = no completeness filter; 'any' = entirely untagged;
// a kind = lacks a tag of that kind. Deterministic curator tool-state, never member-facing.
type NeedsFilter = 'all' | 'any' | MediaProvenanceTagKind;

type CorpusFilterState = {
  kind: 'all' | MediaKind;
  season: string;
  event: string;
  withdrawn: WithdrawnFilter;
  text: string;
  needs: NeedsFilter;
};

const EMPTY_FILTERS: CorpusFilterState = { kind: 'all', season: '', event: '', withdrawn: 'all', text: '', needs: 'all' };

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
  // R4-D5: tag-absence. 'any' = no tags at all; a kind = no tag of that kind.
  if (f.needs === 'any' && entry.tags.length > 0) return false;
  if (f.needs !== 'all' && f.needs !== 'any' && entry.tags.some((t) => t.tagKind === f.needs)) return false;
  const needle = f.text.trim().toLowerCase();
  if (needle) {
    const hay = [entry.uploadNote ?? '', ...entry.tags.map((t) => t.tagValue ?? '')].join(' ').toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

function filtersActive(f: CorpusFilterState): boolean {
  return f.kind !== 'all' || f.withdrawn !== 'all' || !!f.season || !!f.event || !!f.text.trim() || f.needs !== 'all';
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

  // R4-D5: the untagged work queue's quiet count - entries carrying no tags at all.
  // Deterministic, commissioner-only tool-state; no streaks, no progress mechanics.
  const untaggedCount = entries.filter((e) => e.tags.length === 0).length;

  // R4-D1 quick-look: an index INTO the filtered list (so arrow-keys walk exactly what
  // the commissioner is looking at). Opening resolves the row's id to its filtered index.
  const [quickLook, setQuickLook] = useState<number | null>(null);
  function openQuickLook(id: string) {
    const i = visibleEntries.findIndex((e) => e.id === id);
    if (i >= 0) setQuickLook(i);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <RoomRatification leagueId={leagueId} ratified={ratified} />
      <UploadForm leagueId={leagueId} />
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
          <h2 className="font-mono" style={labelStyle}>
            THE CORPUS ({filtersActive(filters) ? `${visibleEntries.length} OF ${entries.length}` : entries.length})
          </h2>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            {untaggedCount > 0 && (
              // R4-D5: a quiet count that doubles as a jump to the work queue. No badge,
              // no progress bar - plain muted text.
              <button
                type="button"
                onClick={() => setFilters({ ...filters, needs: 'any' })}
                className="font-mono"
                style={{ ...labelStyle, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--vault-text3)' }}
              >
                {untaggedCount} UNTAGGED
              </button>
            )}
            <a
              href={`/league/${canonicalId}/av-room`}
              className="font-mono"
              style={{ ...labelStyle, color: 'var(--vault-text2)', textDecoration: 'none' }}
            >
              VIEW THE ROOM →
            </a>
          </div>
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
        {entries.length > 0 && (
          <ThumbnailBackfill leagueId={leagueId} onDone={() => router.refresh()} />
        )}
        {entries.length > 0 && (
          <HashBackfill leagueId={leagueId} onDone={() => router.refresh()} />
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
          <VirtualCorpus
            entries={visibleEntries}
            members={members}
            selected={selected}
            onToggleSelect={toggleSelect}
            onOpen={openQuickLook}
          />
        )}
      </section>

      {quickLook !== null && visibleEntries[quickLook] && (
        <QuickLook
          entries={visibleEntries}
          index={quickLook}
          members={members}
          onIndexChange={setQuickLook}
          onClose={() => setQuickLook(null)}
        />
      )}
    </div>
  );
}

// R3-D3: list virtualization. The corpus can run to a thousand items; rendering one
// card per row keeps the DOM (and the signed-image fetches) O(visible), not O(N), so
// the page stays instant and memory stays flat. Filters (r2-D3) operate on the FULL
// set upstream - this only windows the already-filtered result. Rows are variable
// height (compact, or tall when expanded), so the window virtualizer measures each
// rendered row (measureElement) rather than assuming a fixed size. It virtualizes
// against the document scroll (no nested scroll container), matching the page layout.
function VirtualCorpus({
  entries,
  members,
  selected,
  onToggleSelect,
  onOpen,
}: {
  entries: IngestEntry[];
  members: IngestMember[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    if (listRef.current) setScrollMargin(listRef.current.offsetTop);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: entries.length,
    estimateSize: () => 86,
    overscan: 8,
    scrollMargin,
    getItemKey: (i) => entries[i].id,
  });
  const rows = virtualizer.getVirtualItems();

  return (
    <div ref={listRef} style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
      {rows.map((vrow) => {
        const e = entries[vrow.index];
        return (
          <div
            key={vrow.key}
            data-index={vrow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vrow.start - scrollMargin}px)`,
            }}
          >
            <div style={{ paddingBottom: '1rem' }}>
              <EntryCard
                entry={e}
                members={members}
                selectable={!e.withdrawn}
                selected={selected.has(e.id)}
                onToggleSelect={() => onToggleSelect(e.id)}
                onOpen={() => onOpen(e.id)}
              />
            </div>
          </div>
        );
      })}
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
      {/* R4-D5: the untagged work queue - filter by what an item still NEEDS. */}
      <select
        aria-label="Filter by what an item still needs tagged"
        value={filters.needs}
        onChange={(e) => onChange({ ...filters, needs: e.target.value as NeedsFilter })}
        className="font-ui"
        style={selStyle}
      >
        <option value="all">Any tagging</option>
        <option value="any">Needs any tag</option>
        {(Object.keys(TAG_KIND_LABEL) as MediaProvenanceTagKind[]).map((k) => (
          <option key={k} value={k}>Needs {TAG_KIND_LABEL[k].toLowerCase()}</option>
        ))}
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

// R3-D1 backfill: generate the missing thumb.jpg renditions for the existing corpus.
// A one-off commissioner maintenance action - it asks the server which photos lack a
// thumb (and gets a signed URL of each original), pulls each into a canvas, downscales,
// and POSTs the small thumb back. Deterministic, bounded, and idempotent: photos that
// already have a thumb are never revisited.
function ThumbnailBackfill({ leagueId, onDone }: { leagueId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg('Checking for photos without a thumbnail…');
    try {
      const res = await fetch(`/api/av-room/thumb?leagueId=${encodeURIComponent(leagueId)}`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(j.error ?? 'Could not check thumbnails.');
        return;
      }
      const { targets } = (await res.json()) as {
        targets: { mediaEntryId: string; originalUrl: string; note: string | null; createdAt: string }[];
      };
      if (targets.length === 0) {
        setMsg('Every photo already has a thumbnail.');
        return;
      }
      let done = 0;
      // Name each item that fails to read: an unreadable, untagged item is otherwise
      // unidentifiable in the UI (short id + its note or ingest date).
      const failures: string[] = [];
      const label = (t: { mediaEntryId: string; note: string | null; createdAt: string }) => {
        const idPart = t.mediaEntryId.slice(0, 8);
        const detail = t.note?.trim() || new Date(t.createdAt).toISOString().slice(0, 10);
        return `${idPart} (${detail})`;
      };
      for (const t of targets) {
        setMsg(`Generating thumbnails… ${done + failures.length}/${targets.length}`);
        const blob = await imageToThumbBlob(t.originalUrl);
        if (!blob) {
          failures.push(label(t));
          continue;
        }
        const form = new FormData();
        form.set('mediaEntryId', t.mediaEntryId);
        form.set('thumb', blob, 'thumb.jpg');
        const up = await fetch('/api/av-room/thumb', { method: 'POST', body: form });
        if (up.ok) done += 1;
        else failures.push(label(t));
      }
      const tail = failures.length ? ` ${failures.length} could not be read: ${failures.join('; ')}.` : '';
      setMsg(`Generated ${done} thumbnail${done === 1 ? '' : 's'}.${tail}`);
      if (done > 0) onDone();
    } catch {
      setMsg('Could not generate thumbnails.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
      <button type="button" disabled={busy} onClick={run} className="font-mono" style={{ ...btnStyle(busy), padding: '0.35rem 0.6rem' }}>
        {busy ? 'Working…' : 'Generate missing thumbnails'}
      </button>
      {msg && (
        <span className="font-ui" style={{ color: 'var(--vault-text2)', fontSize: '0.78rem' }}>
          {msg}
        </span>
      )}
    </div>
  );
}

// R4-D3 backfill: compute content_hash for the existing corpus (one-off, same shape as
// the thumbnail backfill). New uploads hash themselves; pre-existing rows need this once.
function HashBackfill({ leagueId, onDone }: { leagueId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg('Checking for items without a content hash…');
    try {
      const res = await fetch(`/api/av-room/hash?leagueId=${encodeURIComponent(leagueId)}`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(j.error ?? 'Could not check hashes.');
        return;
      }
      const { targets, inactive } = (await res.json()) as {
        targets: { mediaEntryId: string; originalUrl: string }[];
        inactive?: boolean;
      };
      if (inactive) {
        setMsg('Duplicate detection is inactive until migration 013 is applied.');
        return;
      }
      if (targets.length === 0) {
        setMsg('Every item already has a content hash.');
        return;
      }
      let done = 0;
      let failed = 0;
      for (const t of targets) {
        setMsg(`Hashing… ${done + failed}/${targets.length}`);
        try {
          const bytes = new Uint8Array(await (await fetch(t.originalUrl)).arrayBuffer());
          const hash = await sha256Hex(bytes);
          const up = await fetch('/api/av-room/hash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mediaEntryId: t.mediaEntryId, hash }),
          });
          if (up.ok) done += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
      setMsg(`Hashed ${done} item${done === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.`);
      if (done > 0) onDone();
    } catch {
      setMsg('Could not compute hashes.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
      <button type="button" disabled={busy} onClick={run} className="font-mono" style={{ ...btnStyle(busy), padding: '0.35rem 0.6rem' }}>
        {busy ? 'Working…' : 'Backfill content hashes'}
      </button>
      {msg && (
        <span className="font-ui" style={{ color: 'var(--vault-text2)', fontSize: '0.78rem' }}>
          {msg}
        </span>
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

// R3-D1: generate a small JPEG thumbnail (~400px long edge) from an image source, in
// the browser, via canvas. Best-effort and side-effect-free on failure (resolves
// null). Reused by the upload path (the commissioner's own local file) and by backfill
// (an existing original pulled from a signed URL). The original is never modified
// (6.9); the thumb is a derived, regenerable rendition stored beside it as thumb.jpg.
const THUMB_MAX_EDGE = 400;

function imageToThumbBlob(src: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    // Signed Storage URLs are cross-origin; request anonymously so the canvas is not
    // tainted and toBlob can read it. (For a same-origin object URL this is a no-op.)
    img.crossOrigin = 'anonymous';
    let settled = false;
    const timeout = setTimeout(() => finish(null), 12000);
    function finish(blob: Blob | null) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(blob);
    }
    img.onerror = () => finish(null);
    img.onload = () => {
      try {
        const { naturalWidth: w0, naturalHeight: h0 } = img;
        if (!w0 || !h0) return finish(null);
        const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(w0, h0));
        const w = Math.max(1, Math.round(w0 * scale));
        const h = Math.max(1, Math.round(h0 * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((b) => finish(b), 'image/jpeg', 0.78);
      } catch {
        finish(null);
      }
    };
    img.src = src;
  });
}

function fileToThumbBlob(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  return imageToThumbBlob(url).then((b) => {
    URL.revokeObjectURL(url);
    return b;
  });
}

// R4-D3: read the file's bytes ONCE and derive both the content hash (sha256 hex, for
// deterministic duplicate detection) and a magic-byte media check. The R3 click-through
// found a HEIC/HEVC file renamed `.jpg` slipping past the extension-based gate, then
// failing thumbnail decode - so HEIC is now caught by CONTENT, not by name. Pure byte
// work, zero AI.
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'heif', 'mif1', 'msf1']);

function isHeicByBytes(bytes: Uint8Array): boolean {
  // ISO-BMFF: bytes 4..8 are the box type ('ftyp'); the major brand follows at 8..12.
  if (bytes.length < 12) return false;
  const ascii = (o: number, n: number) => String.fromCharCode(...Array.from(bytes.subarray(o, o + n)));
  if (ascii(4, 4) !== 'ftyp') return false;
  return HEIC_BRANDS.has(ascii(8, 4).toLowerCase());
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function inspectFileBytes(file: File): Promise<{ hash: string; heic: boolean }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { hash: await sha256Hex(bytes), heic: isHeicByBytes(bytes) };
}

// Thrown when a file's bytes already exist in the league's record. Carries the existing
// entry id so the queue can name it and offer an explicit override.
class DuplicateError extends Error {
  duplicateOf: string;
  constructor(message: string, duplicateOf: string) {
    super(message);
    this.name = 'DuplicateError';
    this.duplicateOf = duplicateOf;
  }
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
async function uploadOneFile(
  file: File,
  leagueId: string,
  note: string,
  opts?: { allowDuplicate?: boolean },
): Promise<void> {
  const kind = mediaKindFor(file);
  if (!kind) throw new Error('Unsupported file type — choose an image or video.');
  if (isHeicFile(file)) {
    throw new Error('HEIC is not supported. Export the photo as JPEG and upload that.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`This file is ${formatSize(file.size)}; the limit is ${MAX_UPLOAD_LABEL}.`);
  }

  // R4-D3: one byte read -> content hash + content-level HEIC check (catches a renamed
  // HEIC the extension check above missed), then a deterministic duplicate check.
  const { hash, heic } = await inspectFileBytes(file);
  if (heic) {
    throw new Error('This is a HEIC/HEVC photo (by its contents, despite the name). Export it as JPEG and upload that.');
  }
  if (!opts?.allowDuplicate) {
    const dupRes = await fetch('/api/av-room/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId, hash }),
    });
    if (dupRes.ok) {
      const { duplicate } = (await dupRes.json()) as {
        duplicate: { id: string; createdAt: string } | null;
      };
      if (duplicate) {
        const when = new Date(duplicate.createdAt).toISOString().slice(0, 10);
        throw new DuplicateError(`Already in the record (uploaded ${when}).`, duplicate.id);
      }
    }
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
  finalizeForm.set('content_hash', hash); // R4-D3: stored as a convenience, not provenance
  if (note.trim()) finalizeForm.set('upload_note', note.trim());
  if (kind === 'video') {
    const poster = await extractPosterBlob(file);
    if (poster) finalizeForm.set('poster', poster, 'poster.jpg');
  } else {
    // R3-D1: a photo carries its own small thumb rendition, generated from the local
    // file (no second round-trip for the original). Best-effort: if it fails, the
    // record still finalizes and backfill can generate the thumb later.
    const thumb = await fileToThumbBlob(file);
    if (thumb) finalizeForm.set('thumb', thumb, 'thumb.jpg');
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
  // R4-D3: a duplicate failure keeps the existing entry id (to name it) and the File
  // (so "upload anyway" can resubmit with an explicit override).
  duplicateOf?: string;
  file?: File;
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
  const queueRef = useRef<{ id: string; file: File; allowDuplicate?: boolean }[]>([]);
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

  // R4-D3: explicit override for a duplicate refusal - resubmit the SAME file with the
  // duplicate check bypassed. Replaces the failed row in place.
  function uploadAnyway(item: QueueItem) {
    if (!item.file) return;
    queueRef.current.push({ id: item.id, file: item.file, allowDuplicate: true });
    claimedRef.current.delete(item.id);
    setItem(item.id, { status: 'queued', reason: undefined, duplicateOf: undefined });
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
          await uploadOneFile(next.file, leagueId, noteRef.current, { allowDuplicate: next.allowDuplicate });
          setItem(next.id, { status: 'done' });
        } catch (e) {
          if (e instanceof DuplicateError) {
            setItem(next.id, { status: 'failed', reason: e.message, duplicateOf: e.duplicateOf, file: next.file });
          } else {
            setItem(next.id, { status: 'failed', reason: (e as Error).message });
          }
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
            remedy-B flow with bounded concurrency and per-file failure isolation.
            R3-D4: drag-drop does not exist on phones, so the label is also a tap target
            and its <input multiple> lets iOS Safari pick several from the library. */}
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
          Drop photos or video here, or tap to choose. You can add several at once.
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
                {it.duplicateOf && it.file && (
                  <button
                    type="button"
                    onClick={() => uploadAnyway(it)}
                    className="font-mono"
                    style={{ ...btnStyle(false), flexShrink: 0, padding: '0.1rem 0.4rem' }}
                  >
                    Upload anyway
                  </button>
                )}
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

// R4-D1: quick-look - a full-size lightbox over the FILTERED corpus. You cannot tag what
// you cannot see; accurate provenance depends on actually looking at the image. Arrow keys
// walk the filtered order, Esc closes, and the tag panel sits alongside so the commissioner
// can tag while viewing. The image is the full original (signed on demand); a video shows
// its poster + the attestation placeholder (NO player - the image-only line holds); an item
// the browser can't render (e.g. the HEIC the canvas could not thumbnail) still resolves to
// an honest "open the original" link, so an unreadable item stays viewable/identifiable.
function QuickLook({
  entries,
  index,
  members,
  onIndexChange,
  onClose,
}: {
  entries: IngestEntry[];
  index: number;
  members: IngestMember[];
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const entry = entries[index];
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signFailed, setSignFailed] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Sign the current item's image on open and on every navigation.
  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setUrl(null);
    setLoading(true);
    setSignFailed(false);
    setImgError(false);
    (async () => {
      try {
        const res = await fetch('/api/av-room/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaEntryId: entry.id }),
        });
        if (cancelled) return;
        if (res.ok) {
          const j = (await res.json()) as { url: string };
          setUrl(j.url);
        } else {
          setSignFailed(true);
        }
      } catch {
        if (!cancelled) setSignFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entry]);

  // Arrow keys walk the filtered corpus; Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
      else if (e.key === 'ArrowRight' && index < entries.length - 1) onIndexChange(index + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, entries.length, onClose, onIndexChange]);

  if (!entry) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick-look"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0, 0, 0, 0.86)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header: position + walk controls + close. Stop propagation so clicks here
          don't close the overlay. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.6rem 0.9rem', flexShrink: 0 }}
      >
        <span className="font-mono" style={{ ...labelStyle, color: 'var(--vault-text)' }}>
          {index + 1} / {entries.length} · {entry.mediaKind.toUpperCase()} ·{' '}
          {new Date(entry.createdAt).toISOString().slice(0, 10)}
          {entry.withdrawn ? ' · WITHDRAWN' : ''}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" disabled={index === 0} onClick={() => onIndexChange(index - 1)} style={btnStyle(index === 0)}>
            ← Prev
          </button>
          <button
            type="button"
            disabled={index === entries.length - 1}
            onClick={() => onIndexChange(index + 1)}
            style={btnStyle(index === entries.length - 1)}
          >
            Next →
          </button>
          <button type="button" onClick={onClose} style={btnStyle(false)}>
            Close (Esc)
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '0 0.9rem 0.9rem',
        }}
      >
        {/* Image side */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: '2 1 360px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
          }}
        >
          {loading ? (
            <span className="font-mono" style={{ ...labelStyle, color: 'var(--vault-text2)' }}>
              LOADING…
            </span>
          ) : url && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={entry.uploadNote ?? `Archival ${entry.mediaKind}`}
              onError={() => setImgError(true)}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          ) : (
            // Honest fallback: a video with no poster, a sign failure, or - the
            // carry-forward - an original the browser cannot render (HEIC). The item
            // stays identifiable, and where we have a URL it stays openable.
            <div style={{ textAlign: 'center', maxWidth: 360 }}>
              <p className="font-ui" style={{ color: 'var(--vault-text2)', fontSize: '0.85rem' }}>
                {entry.mediaKind === 'video'
                  ? 'No poster still — playback pending voice attestation.'
                  : "This file's format can't be previewed in the browser."}
              </p>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono"
                  style={{ ...btnStyle(false), display: 'inline-block', marginTop: 8, textDecoration: 'none' }}
                >
                  Open the original
                </a>
              )}
            </div>
          )}
          {entry.mediaKind === 'video' && url && !imgError && (
            <p className="font-ui" style={{ color: 'var(--vault-text3)', fontSize: '0.78rem' }}>
              Poster still — playback pending voice attestation (image-only).
            </p>
          )}
        </div>

        {/* Tag panel side - scrollable so the form is always reachable. */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: '1 1 280px',
            minWidth: 0,
            maxWidth: 460,
            overflowY: 'auto',
            background: 'var(--vault-s1)',
            border: '1px solid var(--vault-border)',
            borderRadius: 6,
            padding: '0.9rem',
          }}
        >
          <EntryDetailPanel entry={entry} members={members} />
        </div>
      </div>
    </div>
  );
}

// R4-D1: the shared editable detail of an entry - provenance list + poster control + tag
// form. Rendered both inside the corpus row's expand (EntryCard) AND alongside the full
// image in quick-look (QuickLook): "you cannot tag what you cannot see." Owns the tag-form
// and poster/correction writes; the compact row's withdraw/reinstate stay in EntryCard.
function EntryDetailPanel({ entry, members }: { entry: IngestEntry; members: IngestMember[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posterBusy, setPosterBusy] = useState(false);
  const [posterMsg, setPosterMsg] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [tagKind, setTagKind] = useState<MediaProvenanceTagKind>('contributor');
  const [tagValue, setTagValue] = useState('');
  const [datePrecision, setDatePrecision] = useState<MediaDatePrecision>('exact');
  const [taggedMember, setTaggedMember] = useState('');
  const [tagNote, setTagNote] = useState('');
  const [supersedes, setSupersedes] = useState<string | null>(null);

  const memberName = (uid: string | null) =>
    members.find((m) => m.memberUserId === uid)?.displayName ?? 'Unknown member';
  const selectedMember = members.find((m) => m.memberUserId === taggedMember) ?? null;

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

  // R4-D2: retrieve the full-resolution original (any kind) with a download disposition.
  // The Permanence moat made tangible. Available even for withdrawn items - withdrawal
  // governs DISPLAY, not the league's right to retrieve its own record.
  async function downloadOriginal() {
    setDownloadBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/av-room/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaEntryId: entry.id, download: true }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Could not prepare the download.');
        return;
      }
      const { url } = (await res.json()) as { url: string };
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setError('Could not prepare the download.');
    } finally {
      setDownloadBusy(false);
    }
  }

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
    <>
      {/* R4-D2: retrieve the full-resolution original. Always available - retrieval is not
          display, so it works for withdrawn items too. */}
      <div style={{ marginBottom: '0.6rem' }}>
        <button type="button" disabled={downloadBusy} onClick={downloadOriginal} style={{ ...btnStyle(downloadBusy), padding: '0.25rem 0.5rem' }}>
          {downloadBusy ? 'Preparing…' : 'Download original'}
        </button>
      </div>
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
          {/* R3-D4: auto-fit collapses the form to a single column on a phone
              (no media query needed - intrinsic sizing), two columns where it fits. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
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
      {error && (
        <p className="font-ui" style={{ color: 'var(--vault-withheld)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          {error}
        </p>
      )}
    </>
  );
}

function EntryCard({
  entry,
  members,
  selectable,
  selected,
  onToggleSelect,
  onOpen,
}: {
  entry: IngestEntry;
  members: IngestMember[];
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // D3: the edit affordances collapse behind a toggle so a large corpus stays scannable.
  const [expanded, setExpanded] = useState(false);
  // R3-D1: a thumb URL that fails to load (no rendition yet) falls back to the
  // placeholder - never to the full original.
  const [thumbFailed, setThumbFailed] = useState(false);

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
        {/* R4-D1: the thumbnail is a quick-look trigger - tap, or Enter/Space when
            focused (native button). Opens the full image + tag panel. */}
        <button
          type="button"
          onClick={onOpen}
          aria-label="Open quick-look"
          style={{
            width: 52,
            height: 52,
            flexShrink: 0,
            padding: 0,
            border: 'none',
            background: 'var(--vault-s3)',
            borderRadius: 4,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {entry.thumbUrl && !thumbFailed ? (
            // Photo -> its thumb.jpg rendition; video -> the SAME poster the room reads.
            // Image-only, and never the full original (R3-D1).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.thumbUrl}
              alt={entry.uploadNote ?? `Archival ${entry.mediaKind}`}
              onError={() => setThumbFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.1em', color: 'var(--vault-text3)' }}>
              {entry.mediaKind.toUpperCase()}
            </span>
          )}
        </button>
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
          <EntryDetailPanel entry={entry} members={members} />
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
