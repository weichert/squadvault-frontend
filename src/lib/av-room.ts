// src/lib/av-room.ts
// W.1 A/V Room (four-memo chain, ratified 2026-06-10) shared server helpers for
// Increment 1. Three concerns live here so the ingest surface, the display route,
// and the API routes derive identical truth: (1) the tag vocabulary + the
// tag_value-required rule, (2) commissioner verification for a league uuid, and
// (3) the room read-model - which items display, their current (non-superseded)
// provenance tags, and the 2a consent gate on member identification.
//
// Append-only law (6.1): nothing here mutates. "Current" is always a DERIVED read
// over the event logs - latest non-superseded tag per (entry, kind); an item shows
// unless a display withdrawal stands; an identification renders only against a
// current 2a grant (6.6, fail-closed). Honest gaps stay gaps (6.8): a kind with no
// current event is simply absent, never interpolated.
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  MediaEntry,
  MediaKind,
  MediaProvenanceTagEvent,
  MediaProvenanceTagKind,
  MediaDatePrecision,
} from '@/lib/supabase/types';

export const TAG_KINDS: MediaProvenanceTagKind[] = [
  'contributor',
  'date',
  'season',
  'event',
  'member_identification',
];

export const DATE_PRECISIONS: MediaDatePrecision[] = ['exact', 'year', 'season'];

// Kinds whose meaning lives entirely in tag_value: a contributor/season/event
// tag with no value is vacuous and must be rejected at the write path (carry-
// forward note 2). 'date' also needs a value but pairs it with a precision;
// 'member_identification' carries its subject in tagged_member_user_id instead.
export const VALUE_REQUIRED_KINDS: MediaProvenanceTagKind[] = [
  'contributor',
  'season',
  'event',
];

// 2a (media_appearance) is the consent category that gates identified display
// (W.1 spec 5.3 / contract card 7.2). Named here so the gate reads one constant.
export const IDENTIFIED_DISPLAY_CATEGORY = 'media_appearance' as const;

// Allowed content types -> stored file extension. Deliberately small and explicit;
// the original bytes are retained as-is (6.9), so this only governs the key's ext.
// Shared by the grant + finalize routes so they agree on the server-chosen path.
export const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};
const PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

// The media_kind a mime belongs to, or null if unsupported - so the declared kind
// can be checked against the file's actual type (no photo bytes filed as video).
export function mediaKindForMime(mime: string): MediaKind | null {
  if (PHOTO_MIMES.has(mime)) return 'photo';
  if (VIDEO_MIMES.has(mime)) return 'video';
  return null;
}

type AdminClient = SupabaseClient<Database>;

// True iff userId is the commissioner of the given league uuid. Service-role
// read (bypasses RLS) used only to ANSWER the question; every actual write still
// goes through the authed client so RLS is the hard guarantee.
export async function isLeagueCommissioner(
  admin: AdminClient,
  leagueUuid: string,
  userId: string,
): Promise<boolean> {
  const { data } = (await admin
    .from('leagues')
    .select('commissioner_user_id')
    .eq('id', leagueUuid)
    .maybeSingle()) as { data: { commissioner_user_id: string | null } | null };
  return !!data && data.commissioner_user_id === userId;
}

// True iff userId belongs to the league (commissioner or a franchise member) -
// the SELECT scope for reading the corpus / issuing a signed URL.
export async function isLeagueMember(
  admin: AdminClient,
  leagueUuid: string,
  userId: string,
): Promise<boolean> {
  if (await isLeagueCommissioner(admin, leagueUuid, userId)) return true;
  const { data } = (await admin
    .from('franchises')
    .select('id')
    .eq('league_id', leagueUuid)
    .eq('member_user_id', userId)
    .limit(1)
    .maybeSingle()) as { data: { id: string } | null };
  return !!data;
}

// One entry as the room presents it: the row, its current tags grouped by kind
// (corrections folded out), and resolved identification display.
export type IdentifiedDisplay = {
  tagId: string;
  memberUserId: string;
  // The name to show, present ONLY when a current 2a grant exists for this member
  // (6.6 fail-closed). Null = the identification tag stands in the record but the
  // display is silent (W.1 spec 5.3).
  displayName: string | null;
};

export type RoomEntry = {
  entry: MediaEntry;
  tagsByKind: Record<MediaProvenanceTagKind, MediaProvenanceTagEvent[]>;
  identifications: IdentifiedDisplay[];
  // Whether a display withdrawal stands for this item. Always false on the public
  // display route (withdrawn items are excluded); meaningful on the ingest surface
  // (includeWithdrawn=true), where the commissioner manages withdrawal state.
  withdrawn: boolean;
};

export type RoomState = {
  ratified: boolean;
  entries: RoomEntry[];
};

function emptyTagsByKind(): Record<MediaProvenanceTagKind, MediaProvenanceTagEvent[]> {
  return {
    contributor: [],
    date: [],
    season: [],
    event: [],
    member_identification: [],
  };
}

// Load the room read-model for a league. Pass includeWithdrawn=true for the
// ingest surface (the commissioner manages withdrawals there); the public display
// route leaves it false so withdrawn items drop out of forward rendering (5.5).
//
// All arguments are the league UUID (media_entries.league_id), not the canonical
// id. Reads via the admin client are safe: callers gate on isLeagueMember first,
// and this function applies the 2a consent gate itself rather than leaking names.
export async function loadRoomState(
  admin: AdminClient,
  leagueUuid: string,
  opts: { includeWithdrawn?: boolean } = {},
): Promise<RoomState> {
  const { data: ratifications } = (await admin
    .from('room_ratification_events')
    .select('id')
    .eq('league_id', leagueUuid)
    .limit(1)) as { data: { id: string }[] | null };
  const ratified = !!ratifications && ratifications.length > 0;

  const { data: entryRows } = (await admin
    .from('media_entries')
    .select('*')
    .eq('league_id', leagueUuid)
    .order('created_at', { ascending: true })) as { data: MediaEntry[] | null };
  const entries = entryRows ?? [];
  if (entries.length === 0) return { ratified, entries: [] };

  const entryIds = entries.map((e) => e.id);

  // Display state is DERIVED from two append-only logs (D5): an item is withdrawn
  // iff its LATEST withdrawal postdates its LATEST reinstatement. A withdrawal with
  // no later reinstatement stands; a reinstatement after the latest withdrawal
  // restores the item; a fresh withdrawal after that withdraws it again. The full
  // history stays in the logs - nothing is edited. (The reinstatements table is
  // graceful-absent: before migration 012 is applied the query yields nothing and
  // behaviour matches the prior withdrawal-only model.)
  const { data: withdrawalRows } = (await admin
    .from('media_display_withdrawals')
    .select('media_entry_id, recorded_at')
    .in('media_entry_id', entryIds)) as {
    data: { media_entry_id: string | null; recorded_at: string }[] | null;
  };
  const { data: reinstateRows } = (await admin
    .from('media_display_reinstatements')
    .select('media_entry_id, recorded_at')
    .in('media_entry_id', entryIds)) as {
    data: { media_entry_id: string | null; recorded_at: string }[] | null;
  };
  const latestAt = (rows: { media_entry_id: string | null; recorded_at: string }[] | null) => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) {
      if (!r.media_entry_id) continue;
      const prev = m.get(r.media_entry_id);
      if (!prev || r.recorded_at > prev) m.set(r.media_entry_id, r.recorded_at);
    }
    return m;
  };
  const latestWithdrawal = latestAt(withdrawalRows);
  const latestReinstatement = latestAt(reinstateRows);
  const withdrawn = new Set<string>();
  latestWithdrawal.forEach((wAt, id) => {
    const rAt = latestReinstatement.get(id);
    if (!rAt || wAt > rAt) withdrawn.add(id);
  });

  const { data: tagRows } = (await admin
    .from('media_provenance_tag_events')
    .select('*')
    .in('media_entry_id', entryIds)
    .order('recorded_at', { ascending: false })) as { data: MediaProvenanceTagEvent[] | null };
  const tags = tagRows ?? [];

  // A correction names what it supersedes; the superseded event drops out of the
  // current view. Everything not pointed at by some supersedes is current.
  const superseded = new Set(
    tags.map((t) => t.supersedes).filter((id): id is string => !!id),
  );
  const currentTags = tags.filter((t) => !superseded.has(t.id));

  // Resolve display names for current member-identification tags, gated on a
  // current 2a grant. Build the granted set + the name map in one pass each.
  const identifiedUserIds = Array.from(
    new Set(
      currentTags
        .filter((t) => t.tag_kind === 'member_identification' && t.tagged_member_user_id)
        .map((t) => t.tagged_member_user_id as string),
    ),
  );

  const grantedSet = new Set<string>();
  const nameByUserId = new Map<string, string>();
  if (identifiedUserIds.length > 0) {
    const { data: grants } = (await admin
      .from('member_consent_current')
      .select('member_user_id, current_state')
      .eq('league_id', leagueUuid)
      .eq('category', IDENTIFIED_DISPLAY_CATEGORY)
      .in('member_user_id', identifiedUserIds)) as {
      data: { member_user_id: string; current_state: string }[] | null;
    };
    for (const g of grants ?? []) {
      if (g.current_state === 'GRANT') grantedSet.add(g.member_user_id);
    }

    const { data: members } = (await admin
      .from('franchises')
      .select('member_user_id, owner_display_name')
      .eq('league_id', leagueUuid)
      .in('member_user_id', identifiedUserIds)) as {
      data: { member_user_id: string | null; owner_display_name: string }[] | null;
    };
    for (const m of members ?? []) {
      if (m.member_user_id) nameByUserId.set(m.member_user_id, m.owner_display_name);
    }
  }

  const visible = entries.filter(
    (e) => opts.includeWithdrawn || !withdrawn.has(e.id),
  );

  const roomEntries: RoomEntry[] = visible.map((entry) => {
    const tagsByKind = emptyTagsByKind();
    for (const t of currentTags) {
      if (t.media_entry_id === entry.id) tagsByKind[t.tag_kind].push(t);
    }
    const identifications: IdentifiedDisplay[] = tagsByKind.member_identification.map(
      (t) => {
        const memberUserId = t.tagged_member_user_id as string;
        const granted = grantedSet.has(memberUserId);
        return {
          tagId: t.id,
          memberUserId,
          displayName: granted ? (nameByUserId.get(memberUserId) ?? null) : null,
        };
      },
    );
    return { entry, tagsByKind, identifications, withdrawn: withdrawn.has(entry.id) };
  });

  return { ratified, entries: roomEntries };
}

// W.1 Increment 2 (spec 5.6 / 5.7): the "as remembered by [member]" caption layer. A caption
// is the member-CAPTION layer - structurally separate from the human-ratified provenance FACT
// layer (loadRoomState above). The two are NEVER merged; this function deliberately lives apart
// so a caption can never be folded into ProvenancePanel data.
export const MEDIA_CAPTION_CATEGORY = 'media_caption' as const;

// One caption as the room presents it: attributed to the authoring member, body verbatim.
export type DisplayCaption = {
  id: string;
  mediaEntryId: string;
  body: string;
  authorName: string | null;
  recordedAt: string;
};

// Load the DISPLAYABLE captions for a league's items, keyed by media_entry_id. A caption shows
// IFF (spec 5.7): it is the latest in its supersession chain, its author holds a CURRENT
// media_caption GRANT (revocable-forward: a REVOKE withholds future display), and no display
// withdrawal stands against it. The captured rows are never edited - "current" is a derived
// read over the append-only logs, exactly like loadRoomState. Returns an empty map on any
// missing-table condition (graceful before migration 023 is applied).
export async function loadCaptionsForLeague(
  admin: AdminClient,
  leagueUuid: string,
  entryIds: string[],
): Promise<Map<string, DisplayCaption[]>> {
  const byEntry = new Map<string, DisplayCaption[]>();
  if (entryIds.length === 0) return byEntry;

  const { data: capRows, error: capErr } = (await admin
    .from('media_captions')
    .select('id, media_entry_id, author_user_id, body, recorded_at, supersedes')
    .in('media_entry_id', entryIds)
    .order('recorded_at', { ascending: false })) as {
    data: {
      id: string;
      media_entry_id: string;
      author_user_id: string;
      body: string;
      recorded_at: string;
      supersedes: string | null;
    }[] | null;
    error: { code?: string } | null;
  };
  if (capErr || !capRows || capRows.length === 0) return byEntry;

  // Supersession: a correction names what it supersedes; the superseded caption drops out.
  const superseded = new Set(capRows.map((c) => c.supersedes).filter((x): x is string => !!x));
  const current = capRows.filter((c) => !superseded.has(c.id));
  if (current.length === 0) return byEntry;

  // Display withdrawal: a caption is withheld iff a withdrawal stands against its caption_id.
  // (Caption withdrawals are withdrawal-only this increment - no reinstatement path was minted;
  // the captured row is never touched.) Graceful if the caption_id column is absent.
  const withdrawnCaptions = new Set<string>();
  {
    const { data: wRows } = (await admin
      .from('media_display_withdrawals')
      .select('caption_id')
      .in('caption_id', current.map((c) => c.id))) as {
      data: { caption_id: string | null }[] | null;
    };
    for (const w of wRows ?? []) if (w.caption_id) withdrawnCaptions.add(w.caption_id);
  }

  // Grant gate: only captions whose AUTHOR holds a current media_caption GRANT display.
  const authorIds = Array.from(new Set(current.map((c) => c.author_user_id)));
  const grantedAuthors = new Set<string>();
  const nameByAuthor = new Map<string, string>();
  {
    const { data: grants } = (await admin
      .from('member_consent_current')
      .select('member_user_id, current_state')
      .eq('league_id', leagueUuid)
      .eq('category', MEDIA_CAPTION_CATEGORY)
      .in('member_user_id', authorIds)) as {
      data: { member_user_id: string; current_state: string }[] | null;
    };
    for (const g of grants ?? []) if (g.current_state === 'GRANT') grantedAuthors.add(g.member_user_id);

    const { data: members } = (await admin
      .from('franchises')
      .select('member_user_id, owner_display_name')
      .eq('league_id', leagueUuid)
      .in('member_user_id', authorIds)) as {
      data: { member_user_id: string | null; owner_display_name: string }[] | null;
    };
    for (const m of members ?? []) {
      if (m.member_user_id) nameByAuthor.set(m.member_user_id, m.owner_display_name);
    }
  }

  // Oldest-first within an item (chronological account order); only granted + not-withdrawn.
  for (const c of [...current].reverse()) {
    if (withdrawnCaptions.has(c.id)) continue;
    if (!grantedAuthors.has(c.author_user_id)) continue;
    const list = byEntry.get(c.media_entry_id) ?? [];
    list.push({
      id: c.id,
      mediaEntryId: c.media_entry_id,
      body: c.body,
      authorName: nameByAuthor.get(c.author_user_id) ?? null,
      recordedAt: c.recorded_at,
    });
    byEntry.set(c.media_entry_id, list);
  }
  return byEntry;
}

// D-W1-A: the 2b consent category (recorded voice) - the second playback-gate leg. Inert
// but real until E2.3: when members can hold grants, this leg becomes live with NO schema
// change. Distinct from the 2a (media_appearance) category that gates identified display.
export const RECORDED_VOICE_CATEGORY = 'recorded_voice' as const;

// D-W1-A: the video-playback gate (spec 5.7), evaluated server-side - the UI is NEVER the
// boundary. Returns { allowed } ONLY; the route returns a NEUTRAL 403 on fail, leaking
// neither which leg failed nor what tags/grants exist. Gate = Leg1 OR Leg2:
//   Leg1 - the LATEST media_voice_attestations event for the entry is 'no_member_voice'.
//   Leg2 - at least ONE identified member (current, non-superseded member_identification
//          tags, reused from the room read-model - no twin) AND every identified member
//          has a current 'recorded_voice' (2b) grant.
//   A2a - zero identified members => Leg2 is FALSE (absence of tags is not evidence of
//         absence of voices; an untagged video plays only via an attestation).
// ANY uncertainty - read error, missing read-model, non-video, missing table - FAILS
// CLOSED ({ allowed: false }). content_hash/withdrawal are orthogonal and not consulted.
export async function evaluatePlaybackGate(
  admin: AdminClient,
  mediaEntryId: string,
): Promise<{ allowed: boolean }> {
  try {
    const { data: entry } = (await admin
      .from('media_entries')
      .select('league_id, media_kind')
      .eq('id', mediaEntryId)
      .maybeSingle()) as { data: { league_id: string; media_kind: string } | null };
    if (!entry || entry.media_kind !== 'video') return { allowed: false };

    // Leg 1 - latest attestation is 'no_member_voice'. A missing table (migration 015 not
    // applied) yields an error -> leg 1 is simply not satisfied, not a throw.
    const { data: attRows, error: attErr } = (await admin
      .from('media_voice_attestations')
      .select('attested_state, recorded_at')
      .eq('media_entry_id', mediaEntryId)
      .order('recorded_at', { ascending: false })
      .limit(1)) as {
      data: { attested_state: string; recorded_at: string }[] | null;
      error: { code?: string } | null;
    };
    if (!attErr && attRows && attRows[0]?.attested_state === 'no_member_voice') {
      return { allowed: true };
    }

    // Leg 2 - reuse the room read-model for current member_identification tags (no twin).
    const room = await loadRoomState(admin, entry.league_id, { includeWithdrawn: true });
    const re = room.entries.find((e) => e.entry.id === mediaEntryId);
    const identifiedIds = Array.from(
      new Set(
        (re?.tagsByKind.member_identification ?? [])
          .map((t) => t.tagged_member_user_id)
          .filter((x): x is string => !!x),
      ),
    );
    // A2a vacuous-truth exclusion: no identified members => leg 2 false.
    if (identifiedIds.length === 0) return { allowed: false };

    const { data: grants, error: grantErr } = (await admin
      .from('member_consent_current')
      .select('member_user_id, current_state')
      .eq('league_id', entry.league_id)
      .eq('category', RECORDED_VOICE_CATEGORY)
      .in('member_user_id', identifiedIds)) as {
      data: { member_user_id: string; current_state: string }[] | null;
      error: { code?: string } | null;
    };
    if (grantErr) return { allowed: false };
    const granted = new Set(
      (grants ?? []).filter((g) => g.current_state === 'GRANT').map((g) => g.member_user_id),
    );
    return { allowed: identifiedIds.every((id) => granted.has(id)) };
  } catch {
    return { allowed: false };
  }
}
