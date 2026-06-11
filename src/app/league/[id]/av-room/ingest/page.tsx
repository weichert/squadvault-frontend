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
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `A/V Room ingest · ${id}` };
}

export default async function AvRoomIngestPage({ params }: Props) {
  const { id } = await params;

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

  // Per-entry thumbnail + poster presence, signed server-side (round 2): a photo signs
  // its original; a VIDEO signs the SAME poster object the room reads
  // ({folder}/poster.jpg) - never the video itself (D0). Auto-extraction is best-effort
  // and silent for codecs the upload browser can't decode, so videoHasPoster also drives
  // the honest "set poster" affordance where one is missing.
  const THUMB_TTL_SECONDS = 300;
  const videoHasPoster = new Map<string, boolean>();
  const thumbUrl = new Map<string, string>();
  for (const re of room.entries) {
    const folder = re.entry.storage_path.slice(0, re.entry.storage_path.lastIndexOf('/'));
    if (re.entry.media_kind === 'photo') {
      const { data } = await admin.storage.from('league-media').createSignedUrl(re.entry.storage_path, THUMB_TTL_SECONDS);
      if (data) thumbUrl.set(re.entry.id, data.signedUrl);
      continue;
    }
    // video
    const { data: listed } = await admin.storage.from('league-media').list(folder);
    const hasPoster = !!listed?.some((o) => o.name === 'poster.jpg');
    videoHasPoster.set(re.entry.id, hasPoster);
    if (hasPoster) {
      const { data } = await admin.storage.from('league-media').createSignedUrl(`${folder}/poster.jpg`, THUMB_TTL_SECONDS);
      if (data) thumbUrl.set(re.entry.id, data.signedUrl);
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

  const entries: IngestEntry[] = room.entries.map((re) => ({
    id: re.entry.id,
    mediaKind: re.entry.media_kind,
    uploadNote: re.entry.upload_note,
    createdAt: re.entry.created_at,
    withdrawn: re.withdrawn,
    hasPoster: re.entry.media_kind === 'video' ? (videoHasPoster.get(re.entry.id) ?? false) : false,
    thumbUrl: thumbUrl.get(re.entry.id) ?? null,
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
