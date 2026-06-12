// src/app/league/[id]/av-room/ingest/page.tsx
// W.1 A/V Room ingest surface (spec 5.7) - commissioner-only. Upload + provenance
// tagging + room ratification + display withdrawal, all commissioner-authored in
// Increment 1. Photo-first (D-G). Per Design Brief section VIII visibility, a
// non-commissioner sees a rendered 403 (CommissionerOnly), not a hidden route.
//
// Server component: resolves the league, loads the room read-model (including
// withdrawn items, which the commissioner manages here), and the franchise member
// roster with current 2a (media_appearance) grant state shown read-only beside
// member-identification tagging (W.6 section 5 / contract card 7.2). All writes go
// through the API routes; this page only reads + hands state to the client panel.
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLeague, getViewer } from '@/lib/league';
import { createAdminClient } from '@/lib/supabase/server';
import { loadRoomState, IDENTIFIED_DISPLAY_CATEGORY } from '@/lib/av-room';
import { CommissionerOnly } from '@/components/ui/commissioner-only';
import { IngestPanel, type IngestEntry, type IngestMember } from '@/components/av-room/ingest-panel';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ synthetic?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `A/V Room ingest · ${id}` };
}

export default async function AvRoomIngestPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { synthetic } = await searchParams;

  const viewer = await getViewer(id);
  if (!viewer.userId) redirect(`/auth/login?redirect=/league/${id}/av-room/ingest`);

  const league = await getLeague(id);
  if (!league) notFound();
  if (!viewer.isCommissioner) {
    return (
      <main style={{ background: 'var(--vault-bg)', minHeight: '100vh' }}>
        <div className="max-w-4xl mx-auto px-6 py-12">
          <CommissionerOnly leagueId={id} leagueName={league.name} />
        </div>
      </main>
    );
  }

  const admin = createAdminClient();
  const room = await loadRoomState(admin, league.id, { includeWithdrawn: true });

  // R3-D1: lists serve a small derived rendition, NEVER the full original. A photo
  // signs its thumb.jpg sibling (~400px, tens of KB); a video signs the SAME poster
  // the room reads. The original is reserved for quick-look (R4) and downloads.
  //
  // R3-D2: ONE signing round-trip for the whole page, not N. We build every sibling
  // path first, then sign them all in a single createSignedUrls() call - so a 1,000-
  // item corpus costs one sign call, not 1,000 serial ones. A missing rendition simply
  // fails to load and the card falls back to a placeholder (onError), never the
  // original; backfill fills the gap for the existing corpus.
  //
  // Videos are still listed per-folder for the honest "no still yet" hint (poster
  // presence) - that is existence, not signing, and is bounded by video count (a small
  // minority in a photo-first corpus); the bulk photo path does zero list calls.
  const THUMB_TTL_SECONDS = 300;
  const videoHasPoster = new Map<string, boolean>();
  const thumbUrl = new Map<string, string>();
  const signPaths: string[] = [];
  const pathOwner = new Map<string, string>(); // sibling path -> entry id
  for (const re of room.entries) {
    const folder = re.entry.storage_path.slice(0, re.entry.storage_path.lastIndexOf('/'));
    if (re.entry.media_kind === 'photo') {
      const p = `${folder}/thumb.jpg`;
      signPaths.push(p);
      pathOwner.set(p, re.entry.id);
      continue;
    }
    // video: existence of poster.jpg drives the de-silence hint AND whether to sign it
    const { data: listed } = await admin.storage.from('league-media').list(folder);
    const hasPoster = !!listed?.some((o) => o.name === 'poster.jpg');
    videoHasPoster.set(re.entry.id, hasPoster);
    if (hasPoster) {
      const p = `${folder}/poster.jpg`;
      signPaths.push(p);
      pathOwner.set(p, re.entry.id);
    }
  }
  if (signPaths.length > 0) {
    const { data: signed } = await admin.storage.from('league-media').createSignedUrls(signPaths, THUMB_TTL_SECONDS);
    for (const s of signed ?? []) {
      const owner = s.path ? pathOwner.get(s.path) : undefined;
      if (owner && !s.error && s.signedUrl) thumbUrl.set(owner, s.signedUrl);
    }
  }

  // Franchise members with a resolvable identity, plus their current 2a grant
  // state (shown read-only beside member-identification tagging).
  const { data: memberRows } = (await admin
    .from('franchises')
    .select('member_user_id, owner_display_name')
    .eq('league_id', league.id)
    .not('member_user_id', 'is', null)
    .order('owner_display_name', { ascending: true })) as {
    data: { member_user_id: string; owner_display_name: string }[] | null;
  };
  const memberList = memberRows ?? [];

  const grantedSet = new Set<string>();
  if (memberList.length > 0) {
    const { data: grants } = (await admin
      .from('member_consent_current')
      .select('member_user_id, current_state')
      .eq('league_id', league.id)
      .eq('category', IDENTIFIED_DISPLAY_CATEGORY)
      .in('member_user_id', memberList.map((m) => m.member_user_id))) as {
      data: { member_user_id: string; current_state: string }[] | null;
    };
    for (const g of grants ?? []) {
      if (g.current_state === 'GRANT') grantedSet.add(g.member_user_id);
    }
  }

  const members: IngestMember[] = memberList.map((m) => ({
    memberUserId: m.member_user_id,
    displayName: m.owner_display_name,
    granted2a: grantedSet.has(m.member_user_id),
  }));

  // R4 derived duplicate indicator: content_hash per entry (migration 013). Queried
  // separately so loadRoomState (shared with the room) stays untouched; graceful if the
  // column is absent in some environment (all null -> indicator simply inactive).
  const contentHashById = new Map<string, string | null>();
  {
    const { data: hashRows, error: hashErr } = (await admin
      .from('media_entries')
      .select('id, content_hash')
      .eq('league_id', league.id)) as {
      data: { id: string; content_hash: string | null }[] | null;
      error: { code?: string } | null;
    };
    if (!hashErr) for (const r of hashRows ?? []) contentHashById.set(r.id, r.content_hash);
  }

  const entries: IngestEntry[] = room.entries.map((re) => ({
    id: re.entry.id,
    mediaKind: re.entry.media_kind,
    uploadNote: re.entry.upload_note,
    createdAt: re.entry.created_at,
    withdrawn: re.withdrawn,
    hasPoster: re.entry.media_kind === 'video' ? (videoHasPoster.get(re.entry.id) ?? false) : false,
    thumbUrl: thumbUrl.get(re.entry.id) ?? null,
    contentHash: contentHashById.get(re.entry.id) ?? null,
    tags: [
      ...re.tagsByKind.contributor,
      ...re.tagsByKind.date,
      ...re.tagsByKind.season,
      ...re.tagsByKind.event,
      ...re.tagsByKind.member_identification,
    ].map((t) => ({
      id: t.id,
      tagKind: t.tag_kind,
      tagValue: t.tag_value,
      datePrecision: t.date_precision,
      taggedMemberUserId: t.tagged_member_user_id,
    })),
  }));

  // D4: the working tool puts the just-added item under your hands - the INGEST list
  // is newest-first (created_at DESC, deterministic). The ROOM stays oldest-first (a
  // founder taste call: an archive reads forward through time; W.2 owns presentation).
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // R3-D3: dev-only synthetic padding to exercise virtualization at scale (?synthetic=1000).
  // NEVER in production and never written to the DB - these are render-only rows that
  // prove the window virtualizer keeps the DOM O(visible). Real prod data is untouched.
  if (process.env.NODE_ENV !== 'production') {
    const n = Math.min(2000, Math.max(0, parseInt(synthetic ?? '0', 10) || 0));
    const base = Date.parse('2000-01-01T00:00:00Z');
    for (let i = 0; i < n; i++) {
      entries.push({
        id: `synthetic-${i}`,
        mediaKind: 'photo',
        uploadNote: `Synthetic test row ${i}`,
        createdAt: new Date(base - i * 1000).toISOString(),
        withdrawn: false,
        hasPoster: false,
        thumbUrl: null,
        contentHash: null,
        tags: [],
      });
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
            A/V Room ingest
          </h1>
          <p
            className="font-ui mt-3"
            style={{ color: 'var(--vault-text2)', fontSize: '0.9rem', lineHeight: 1.5, maxWidth: 560 }}
          >
            Add photographs and video to the league&rsquo;s record, tag what is known about
            each, and ratify the room when it is ready to be shared. Provenance is only ever
            what you record by hand; nothing is guessed, and empty fields stay empty.
          </p>
          <div className="mt-6" style={{ width: 40, height: 1, background: 'rgba(139, 112, 53, 0.4)' }} />
        </header>

        <IngestPanel
          leagueId={league.id}
          canonicalId={id}
          ratified={room.ratified}
          entries={entries}
          members={members}
        />
      </div>
    </main>
  );
}
