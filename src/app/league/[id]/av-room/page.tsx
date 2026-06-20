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
import {
  loadRoomState,
  loadCaptionsForLeague,
  isLeagueMember,
  type RoomEntry,
  type DisplayCaption,
} from '@/lib/av-room';
import { RoomImage } from '@/components/av-room/room-image';
import { RoomVideo } from '@/components/av-room/room-video';
import { CaptionComposer } from '@/components/av-room/caption-composer';

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

// W.1 Increment 2 (spec 5.6): the "as remembered by [member]" CAPTIONS layer. STRUCTURALLY
// SEPARATE from ProvenancePanel above - a different heading, a left rule, italic member voice -
// so a caption can never be read as a verified provenance tag (the two-layer rendering
// invariant, 6.2). Captions are attributed and unmerged (6.3): two members' accounts on one
// item stay two accounts, never a synthesized consensus. No counts, no reactions (6.6).
function CaptionsPanel({ captions }: { captions: DisplayCaption[] }) {
  if (captions.length === 0) return null;
  return (
    <section
      aria-label="As remembered by members"
      style={{
        marginTop: 10,
        paddingLeft: 10,
        borderLeft: '2px solid var(--vault-gold-dim)',
      }}
    >
      <h3
        className="font-mono"
        style={{ margin: 0, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--vault-gold-dim)' }}
      >
        As remembered by
      </h3>
      {captions.map((c) => (
        <figure key={c.id} style={{ margin: '6px 0 0' }}>
          <blockquote
            className="font-ceremonial"
            style={{ margin: 0, fontStyle: 'italic', fontWeight: 300, fontSize: '0.9rem', color: 'var(--vault-text)', lineHeight: 1.45 }}
          >
            {c.body}
          </blockquote>
          <figcaption className="font-ui" style={{ marginTop: 2, fontSize: '0.72rem', color: 'var(--vault-text3)' }}>
            — {c.authorName ?? 'a member'}
          </figcaption>
        </figure>
      ))}
    </section>
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

  // W.1 Inc 2: the remembered-account layer. Captions are loaded SEPARATELY from the provenance
  // read-model and rendered in a structurally-distinct panel (never merged, 6.2). Only captions
  // whose author holds a current media_caption GRANT and that are not withdrawn display (5.7).
  const captionsByEntry = await loadCaptionsForLeague(
    admin,
    league.id,
    ordered.map((re) => re.entry.id),
  );

  // The caption composer shows ONLY to franchise-linked MEMBERS of this league (a caption is
  // member-authored; the commissioner cannot proxy one, D-W1I2-5). Resolve once.
  const { data: viewerFranchise } = (await admin
    .from('franchises')
    .select('id')
    .eq('league_id', league.id)
    .eq('member_user_id', viewer.userId)
    .limit(1)
    .maybeSingle()) as { data: { id: string } | null };
  const viewerIsMember = !!viewerFranchise;

  // D-W1-A: the latest voice attestation per video, passed structured to RoomVideo (it
  // formats the trust-legible line in viewer-local time and suppresses Play on a
  // member_voice_present state). The player itself is gated server-side; this is the
  // legibility, not the gate. Graceful if migration 015 is absent (no attestation).
  const attestation = new Map<string, { state: 'no_member_voice' | 'member_voice_present'; byName: string | null; at: string }>();
  if (videos.length > 0) {
    const videoIds = videos.map((re) => re.entry.id);
    const { data: attRows, error: attErr } = (await admin
      .from('media_voice_attestations')
      .select('media_entry_id, attested_state, attested_by, recorded_at')
      .in('media_entry_id', videoIds)
      .order('recorded_at', { ascending: false })) as {
      data: { media_entry_id: string; attested_state: string; attested_by: string; recorded_at: string }[] | null;
      error: { code?: string } | null;
    };
    if (!attErr) {
      const latest = new Map<string, { state: string; by: string; at: string }>();
      for (const r of attRows ?? []) if (!latest.has(r.media_entry_id)) latest.set(r.media_entry_id, { state: r.attested_state, by: r.attested_by, at: r.recorded_at });
      const byIds = Array.from(new Set(Array.from(latest.values()).map((v) => v.by)));
      const nameById = new Map<string, string>();
      if (byIds.length > 0) {
        const { data: fr } = (await admin
          .from('franchises')
          .select('member_user_id, owner_display_name')
          .eq('league_id', league.id)
          .in('member_user_id', byIds)) as { data: { member_user_id: string | null; owner_display_name: string }[] | null };
        for (const m of fr ?? []) if (m.member_user_id) nameById.set(m.member_user_id, m.owner_display_name);
      }
      latest.forEach((v, id) => {
        attestation.set(id, {
          state: v.state as 'no_member_voice' | 'member_voice_present',
          byName: nameById.get(v.by) ?? null,
          at: v.at,
        });
      });
    }
  }

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
                  {re.entry.media_kind === 'video' ? (
                    // D-W1-A: the room video cell - poster + attestation line + gated player.
                    <RoomVideo
                      mediaEntryId={re.entry.id}
                      posterUrl={posterUrl ?? null}
                      alt={re.entry.upload_note ?? 'Archival video — poster still'}
                      attestation={attestation.get(re.entry.id) ?? null}
                    />
                  ) : (
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
                      <RoomImage kind="photo" url={url ?? null} alt={re.entry.upload_note ?? 'Archival photograph'} />
                    </div>
                  )}
                  <figcaption>
                    <ProvenancePanel re={re} />
                    <CaptionsPanel captions={captionsByEntry.get(re.entry.id) ?? []} />
                    {viewerIsMember && <CaptionComposer mediaEntryId={re.entry.id} />}
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
