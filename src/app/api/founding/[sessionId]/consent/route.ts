// src/app/api/founding/[sessionId]/consent/route.ts
//
// Commissioner Founding Session (State 3) — consent collection (spec section 6).
//
// The consent panel posts three booleans (photos, voice_recording,
// text_likeness). We map them to the OPT_IN/OPT_OUT record, store them on the
// session, and advance CONSENT_COLLECTION -> OUTPUT_GENERATION (F3-2-B). This
// route is structural only -- no agent loop. Same SSR/RLS write path as the
// turn and voice routes; the in-code transition guard mirrors session-state.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { isLegalFoundingTransition } from '@/lib/founding/session-state';
import type {
  ConsentRecord,
  Database,
  FoundingSession,
} from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FoundingSessionUpdate =
  Database['public']['Tables']['founding_sessions']['Update'];

const flag = (b: boolean): 'OPT_IN' | 'OPT_OUT' => (b ? 'OPT_IN' : 'OPT_OUT');

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  let body: {
    photos?: unknown;
    voice_recording?: unknown;
    text_likeness?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (
    typeof body.photos !== 'boolean' ||
    typeof body.voice_recording !== 'boolean' ||
    typeof body.text_likeness !== 'boolean'
  ) {
    return NextResponse.json(
      { error: 'Invalid consent values' },
      { status: 400 },
    );
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: sessionRow } = await supabase
    .from('founding_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  const session = (sessionRow as FoundingSession | null) ?? null;
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.state !== 'CONSENT_COLLECTION') {
    return NextResponse.json({ error: 'Not awaiting consent' }, { status: 409 });
  }

  const consent: ConsentRecord = {
    photos: flag(body.photos),
    voice_recording: flag(body.voice_recording),
    text_likeness: flag(body.text_likeness),
  };
  const nextState = isLegalFoundingTransition(
    'CONSENT_COLLECTION',
    'OUTPUT_GENERATION',
  )
    ? 'OUTPUT_GENERATION'
    : session.state;

  const update: FoundingSessionUpdate = { consent, state: nextState };
  const { error: updErr } = await supabase
    .from('founding_sessions')
    .update(update as never)
    .eq('id', sessionId);
  if (updErr) {
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 });
  }

  return NextResponse.json({ state: nextState, consent });
}
