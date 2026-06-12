// src/app/league/[id]/av-room/page.tsx
// W.1 A/V Room - the room (spec 5.7). League-authenticated display of the media
// corpus, photo-first, chronological. Read-only; every write lives on the ingest
// surface. Governing invariants enforced here:
//   - Fail-closed (6.6): nothing renders until a room_ratification_event exists.
//   - Honest gaps (6.8): a provenance kind with no current tag is simply absent;
//     nothing is interpolated.
//   - Identification gate (5.3 / 6.6): a member_identification tag shows a name
//     ONLY against a current 2a grant; otherwise it is silent (loadRoomState
//     resolves displayName to null, and we render nothing for it).
//   - Video playback DEFERRED this increment: there is no structured commissioner
//     "no member voice" attestation on the merged schema, so no video plays yet
//     (strictly fail-closed). Videos show as present items with provenance and a
//     derived poster still (D3, image-only) when one exists, else a plain
//     placeholder; playback + attestation are a clean next increment.
// No counts, no ordering knobs, no nudges (6.3-6.5).
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLeague, getViewer } from '@/lib/league';
import { createAdminClient } from '@/lib/supabase/server';
import { loadRoomState, isLeagueMember, type RoomEntry } from '@/lib/av-room';
import { RoomImage } from '@/components/av-room/room-image';

export const dynamic = 'force-dynamic';

const PHOTO_URL_TTL_SECONDS = 300;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `A/V Room · ${id}` };
}

function Sealed({ message }: { message: string }) {
  return (
    <div className="vault-card text-center py-12">
      <p className="font-ceremonial font-light text-vault-text2 italic" style={{ fontSize: '1.2rem' }}>
        {message}
      </p>
    </div>
  );
}

function ProvenancePanel({ re }: { re: RoomEntry }) {
  const lines: { label: string; value: string }[] = [];
  for (const t of re.tagsByKind.date) {
    lines.push({ label: 'Date', value: `${t.tag_value} (${t.date_precision})` });
  }
  for (const t of re.tagsByKind.season) lines.push({ label: 'Season', value: t.tag_value ?? '' });
  for (const t of re.tagsByKind.event) lines.push({ label: 'Event', value: t.tag_value ?? '' });
  for (const t of re.tagsByKind.contributor) {
    lines.push({ label: 'Contributed by', value: t.tag_value ?? '' });
  }
  // Identifications: only those resolved to a name (current 2a grant) render.
  for (const ident of re.identifications) {
    if (ident.displayName) lines.push({ label: 'Identified', value: ident.displayName });
  }

  if (lines.length === 0) {
    return (
      <p className="font-ui" style={{ color: 'var(--vault-text3)', fontSize: '0.78rem', marginTop: 6 }}>
        No provenance recorded.
      </p>
    );
  }
  return (
    <dl style={{ margin: '0.5rem 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px' }}>
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--vault-text3)', alignSelf: 'baseline' }}>
            {l.label}
          </dt>
          <dd className="font-ui" style={{ margin: 0, fontSize: '0.82rem', color: 'var(--vault-text2)' }}>
            {l.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AvRoomPage({ params }: Props) {
  const { id } = await params;

  const viewer = await getViewer(id);
  if (!viewer.userId) redirect(`/auth/login?redirect=/league/${id}/av-room`);

  const league = await getLeague(id);
  if (!league) notFound();

  const admin = createAdminClient();
  if (!(await isLeagueMember(admin, league.id, viewer.userId))) {
    return (
      <main style={{ background: 'var(--vault-bg)', minHeight: '100vh' }}>
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Sealed message="The A/V Room is open to members of this league." />
        </div>
      </main>
    );
  }

  const room = await loadRoomState(admin, league.id);

  // D-W1-E1: expunged items render NOWHERE except the ingest tombstone filter - never in
  // the room. Build the expunged set and exclude it. Graceful if migration 014 is absent.
  const expunged = new Set<string>();
  {
    const { data: expRows, error: expErr } = (await admin
      .from('media_expungement_events')
      .select('media_entry_id')
      .eq('league_id', league.id)) as {
      data: { media_entry_id: string }[] | null;
      error: { code?: string } | null;
    };
    if (!expErr) for (const r of expRows ?? []) expunged.add(r.media_entry_id);
  }
  const live = room.entries.filter((re) => !expunged.has(re.entry.id));

  // Photo-first ordering: photos (chronological by ingest) then video, both
  // deterministic - no algorithmic ranking (6.4).
  const photos = live.filter((re) => re.entry.media_kind === 'photo');
  const videos = live.filter((re) => re.entry.media_kind === 'video');
  const ordered = [...photos, ...videos];

  // R3-D1: the room is a list surface, so it serves the small thumb.jpg rendition for
  // photos and poster.jpg for videos - NEVER the full original (that is reserved for
  // quick-look and downloads). A missing rendition simply fails to load and RoomImage
  // falls back to a placeholder (no broken image, no original).
  //
  // R3-D2: one signing round-trip for the whole page. Every sibling path is collected
  // then signed in a single createSignedUrls() call, not one per item.
  const photoUrl = new Map<string, string>();
  const videoPosterUrl = new Map<string, string>();
  const signPaths: string[] = [];
  const pathTarget = new Map<string, { id: string; kind: 'photo' | 'video' }>();
  for (const re of ordered) {
    const sp = re.entry.storage_path;
    const folder = sp.slice(0, sp.lastIndexOf('/'));
    const p = re.entry.media_kind === 'photo' ? `${folder}/thumb.jpg` : `${folder}/poster.jpg`;
    signPaths.push(p);
    pathTarget.set(p, { id: re.entry.id, kind: re.entry.media_kind });
  }
  if (signPaths.length > 0) {
    const { data: signed } = await admin.storage.from('league-media').createSignedUrls(signPaths, PHOTO_URL_TTL_SECONDS);
    for (const s of signed ?? []) {
      const target = s.path ? pathTarget.get(s.path) : undefined;
      if (!target || s.error || !s.signedUrl) continue;
      if (target.kind === 'photo') photoUrl.set(target.id, s.signedUrl);
      else videoPosterUrl.set(target.id, s.signedUrl);
    }
  }

  return (
    <main style={{ background: 'var(--vault-bg)', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: '2.25rem', letterSpacing: '0.02em', lineHeight: 1.05, margin: 0 }}
          >
            A/V Room
          </h1>
          <div className="mt-6" style={{ width: 40, height: 1, background: 'rgba(139, 112, 53, 0.4)' }} />
        </header>

        {!room.ratified ? (
          // Fail-closed: the room is not yet shared.
          <Sealed message="This room has not been opened yet." />
        ) : ordered.length === 0 ? (
          <Sealed message="The room is open, but nothing has been added to it yet." />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {ordered.map((re) => {
              const url = photoUrl.get(re.entry.id);
              const posterUrl = videoPosterUrl.get(re.entry.id);
              return (
                <figure key={re.entry.id} style={{ margin: 0 }}>
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
                    }}
                  >
                    <RoomImage
                      kind={re.entry.media_kind}
                      url={re.entry.media_kind === 'photo' ? (url ?? null) : (posterUrl ?? null)}
                      alt={
                        re.entry.media_kind === 'photo'
                          ? (re.entry.upload_note ?? 'Archival photograph')
                          : (re.entry.upload_note ?? 'Archival video — poster still')
                      }
                    />
                  </div>
                  <figcaption>
                    <ProvenancePanel re={re} />
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
