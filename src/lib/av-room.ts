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

  // Standing withdrawals (item-level). A row here = the item is withdrawn from
  // forward display, effective at insert (carry-forward note 3).
  const { data: withdrawalRows } = (await admin
    .from('media_display_withdrawals')
    .select('media_entry_id')
    .in('media_entry_id', entryIds)) as { data: { media_entry_id: string | null }[] | null };
  const withdrawn = new Set(
    (withdrawalRows ?? []).map((w) => w.media_entry_id).filter((id): id is string => !!id),
  );

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
