// src/app/api/av-room/tag/route.ts
// W.1 A/V Room provenance tagging - commissioner-only in Increment 1 (spec 5.3).
// Appends one provenance tag event to media_provenance_tag_events. A correction
// names what it supersedes (the self-ref); the superseded event drops out of the
// current read but is never edited or deleted (append-only, 6.1).
//
// Validation mirrors the DB CHECK constraints AND the no-vacuous-tag rule (carry-
// forward note 2): contributor/season/event REQUIRE a non-empty tag_value; date
// requires value + precision; member_identification requires a tagged member and
// carries no free value. RLS (commissioner on the parent league, ratified_by =
// auth.uid()) remains the hard guarantee; these checks give clean 4xx + honest data.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import {
  TAG_KINDS,
  DATE_PRECISIONS,
  VALUE_REQUIRED_KINDS,
  isLeagueCommissioner,
} from '@/lib/av-room';
import type {
  Database,
  MediaProvenanceTagKind,
  MediaDatePrecision,
} from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TagInsert = Database['public']['Tables']['media_provenance_tag_events']['Insert'];

export async function POST(req: NextRequest) {
  let body: {
    mediaEntryId?: unknown;
    tag_kind?: unknown;
    tag_value?: unknown;
    date_precision?: unknown;
    tagged_member_user_id?: unknown;
    note?: unknown;
    supersedes?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { mediaEntryId, tag_kind: tagKind } = body;
  if (typeof mediaEntryId !== 'string' || mediaEntryId.length === 0) {
    return NextResponse.json({ error: 'mediaEntryId is required' }, { status: 400 });
  }
  if (typeof tagKind !== 'string' || !TAG_KINDS.includes(tagKind as MediaProvenanceTagKind)) {
    return NextResponse.json({ error: 'Invalid tag_kind' }, { status: 400 });
  }
  const kind = tagKind as MediaProvenanceTagKind;

  const tagValue =
    typeof body.tag_value === 'string' && body.tag_value.trim().length > 0
      ? body.tag_value.trim()
      : null;
  const note =
    typeof body.note === 'string' && body.note.trim().length > 0 ? body.note.trim() : null;
  const supersedes =
    typeof body.supersedes === 'string' && body.supersedes.length > 0 ? body.supersedes : null;

  // member_identification: subject is the tagged member, no free value.
  const isIdentification = kind === 'member_identification';
  const taggedMember =
    typeof body.tagged_member_user_id === 'string' && body.tagged_member_user_id.length > 0
      ? body.tagged_member_user_id
      : null;
  if (isIdentification && !taggedMember) {
    return NextResponse.json(
      { error: 'member_identification requires tagged_member_user_id' },
      { status: 400 },
    );
  }
  if (!isIdentification && taggedMember) {
    return NextResponse.json(
      { error: 'tagged_member_user_id is only valid for member_identification' },
      { status: 400 },
    );
  }

  // date: precision required + a value carrying the (possibly partial) date.
  const isDate = kind === 'date';
  let datePrecision: MediaDatePrecision | null = null;
  if (isDate) {
    if (
      typeof body.date_precision !== 'string' ||
      !DATE_PRECISIONS.includes(body.date_precision as MediaDatePrecision)
    ) {
      return NextResponse.json(
        { error: 'date requires date_precision (exact|year|season)' },
        { status: 400 },
      );
    }
    datePrecision = body.date_precision as MediaDatePrecision;
    if (!tagValue) {
      return NextResponse.json({ error: 'date requires a tag_value' }, { status: 400 });
    }
  } else if (body.date_precision != null) {
    return NextResponse.json(
      { error: 'date_precision is only valid for date tags' },
      { status: 400 },
    );
  }

  // No-vacuous-tag rule (note 2): a contributor/season/event tag with no value
  // carries no provenance - reject it rather than record an empty event.
  if (VALUE_REQUIRED_KINDS.includes(kind) && !tagValue) {
    return NextResponse.json({ error: `${kind} requires a tag_value` }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // The parent entry resolves the league; commissioner-gate against it.
  const admin = createAdminClient();
  const { data: entry } = (await admin
    .from('media_entries')
    .select('id, league_id')
    .eq('id', mediaEntryId)
    .maybeSingle()) as { data: { id: string; league_id: string } | null };
  if (!entry) return NextResponse.json({ error: 'Media entry not found' }, { status: 404 });
  if (!(await isLeagueCommissioner(admin, entry.league_id, user.id))) {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 });
  }

  // A supersedes target must be a tag on the same entry (a correction is scoped
  // to its own item; you cannot retarget another entry's provenance).
  if (supersedes) {
    const { data: prior } = (await admin
      .from('media_provenance_tag_events')
      .select('id, media_entry_id')
      .eq('id', supersedes)
      .maybeSingle()) as { data: { id: string; media_entry_id: string } | null };
    if (!prior || prior.media_entry_id !== mediaEntryId) {
      return NextResponse.json({ error: 'Invalid supersedes target' }, { status: 400 });
    }
  }

  const row: TagInsert = {
    media_entry_id: mediaEntryId,
    tag_kind: kind,
    tag_value: isIdentification ? null : tagValue,
    date_precision: datePrecision,
    tagged_member_user_id: taggedMember,
    ratified_by: user.id,
    note,
    supersedes,
  };
  const { error: insErr } = await supabase
    .from('media_provenance_tag_events')
    .insert(row as never);
  if (insErr) {
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
