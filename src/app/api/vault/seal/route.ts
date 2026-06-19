// src/app/api/vault/seal/route.ts
//
// L.3 The Vault, capture slice (spec engine fee0725, sections 5.2-5.4 + 6). The
// member's compose -> grant -> SEAL action, in one authored, irreversible request.
//
// MEMBER-ONLY, NO PROXY (invariant 4, W.6 1.3): member_user_id is taken from the
// authenticated session, never the body; the RLS INSERT policies (member_user_id =
// auth.uid()) are the hard guarantee. The commissioner cannot author, seal, or proxy.
//
// Order is constitutional (spec 5.4: "the member grants before sealing"):
//   1. record the sealed_testimony consent GRANT (member_consent_events, append-only)
//   2. insert the sealed-letter METADATA (vault_sealed_letters)
//   3. insert the BODY (vault_sealed_letter_bodies, behind no read policy = the seal)
// A SEAL is terminal; there is no edit. The body, once written, is readable by NO role
// until the reveal unit (season-end) adds a gated read.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ConsentInsert = Database['public']['Tables']['member_consent_events']['Insert'];
type LetterInsert = Database['public']['Tables']['vault_sealed_letters']['Insert'];
type BodyInsert = Database['public']['Tables']['vault_sealed_letter_bodies']['Insert'];

const MAX_BODY = 10_000; // a letter, not an essay; a sane ceiling, not an engagement metric.

export async function POST(req: NextRequest) {
  let body: { season?: unknown; body?: unknown; grantConsent?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const letterText = typeof body.body === 'string' ? body.body.trim() : '';
  const season = typeof body.season === 'number' ? body.season : NaN;

  if (letterText.length === 0 || letterText.length > MAX_BODY) {
    return NextResponse.json(
      { error: 'A non-empty letter (max 10,000 characters) is required.' },
      { status: 400 },
    );
  }
  if (!Number.isInteger(season) || season < 2000 || season > 2100) {
    return NextResponse.json({ error: 'A valid season is required.' }, { status: 400 });
  }
  // The seal is irreversible; the consent grant is its precondition (spec 5.4). The member
  // must affirm the sealed_testimony grant in the same act. No grant, no seal.
  if (body.grantConsent !== true) {
    return NextResponse.json(
      { error: 'The sealed_testimony consent grant is required before sealing.' },
      { status: 400 },
    );
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Resolve the author's franchise + league from the E2.3 linkage. A letter author is a
  // franchise-linked member; the commissioner-only or unlinked actor has no franchise here.
  const admin = createAdminClient();
  const { data: fr } = (await admin
    .from('franchises')
    .select('id, league_id')
    .eq('member_user_id', user.id)
    .limit(1)
    .maybeSingle()) as { data: { id: string; league_id: string } | null };
  if (!fr) {
    return NextResponse.json(
      { error: 'No linked franchise for this member; cannot seal a letter.' },
      { status: 403 },
    );
  }

  // 1. Consent-at-writing: the sealed_testimony GRANT, member-authored (RLS member-only).
  const consent: ConsentInsert = {
    member_user_id: user.id,
    league_id: fr.league_id,
    event_type: 'GRANT',
    category: 'sealed_testimony',
    rendering_class: null,
    context: 'vault_seal',
    note: null,
  };
  const { error: consentErr } = await supabase
    .from('member_consent_events')
    .insert(consent as never);
  if (consentErr) {
    return NextResponse.json({ error: 'Could not record the consent grant.' }, { status: 500 });
  }

  // 2. The sealed-letter metadata fact (existence + sealed_at). RLS: author-only insert.
  const letter: LetterInsert = {
    league_id: fr.league_id,
    member_user_id: user.id,
    franchise_id: fr.id,
    season,
  };
  const { data: sealed, error: letterErr } = (await supabase
    .from('vault_sealed_letters')
    .insert(letter as never)
    .select('id, sealed_at')
    .single()) as { data: { id: string; sealed_at: string } | null; error: unknown };
  if (letterErr || !sealed) {
    return NextResponse.json({ error: 'Could not seal the letter.' }, { status: 500 });
  }

  // 3. The body, into the table with no read policy. This is the seal: once written, no
  // role reads it until reveal. RLS verifies authorship of the parent letter.
  const bodyRow: BodyInsert = { letter_id: sealed.id, body: letterText };
  const { error: bodyErr } = await supabase
    .from('vault_sealed_letter_bodies')
    .insert(bodyRow as never);
  if (bodyErr) {
    // The metadata row is an inert sealed-without-body fact (itself unreadable as a body);
    // surface partial so the member re-seals rather than believing the words were captured.
    return NextResponse.json(
      { error: 'The letter metadata sealed but the body did not persist; please re-seal.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, sealedAt: sealed.sealed_at });
}
