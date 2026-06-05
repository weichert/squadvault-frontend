// src/app/api/founding/[sessionId]/generate/route.ts
//
// F3-3a: the founding output-generation phase. Runs when the session has
// reached OUTPUT_GENERATION (consent collected). Generates the three outputs,
// then persists them via the service-role admin client (artifacts RLS blocks
// member inserts) -- mirroring the approve route's pattern -- after verifying
// the caller is the session's commissioner through the SSR/RLS load.
//
// Idempotent: if outputs were already generated, returns the existing FOUNDING
// artifact instead of creating a second one. The Voice Profile insert is
// skipped if the league already has one; the Office Brief overwrite is safe.
// outputs_generated is set LAST, after every write succeeds. The COMPLETE
// transition is NOT made here -- it follows the commissioner's approval of the
// Founding Artifact (reconciled on the founding page, F3-3b).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient as createUntypedAdmin } from '@supabase/supabase-js';
import { generateFoundingOutputs } from '@/lib/founding/output-generator';
import type { FoundingOutputContext } from '@/lib/founding/generators';
import type {
  Database,
  FoundingSession,
  VoiceProfileKey,
} from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FoundingSessionUpdate =
  Database['public']['Tables']['founding_sessions']['Update'];

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

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
  if (session.commissioner_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createUntypedAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: league } = (await admin
    .from('leagues')
    .select('id, canonical_id, name, founding_year, voice_profile_id')
    .eq('id', session.league_id)
    .maybeSingle()) as {
    data: {
      id: string;
      canonical_id: string;
      name: string;
      founding_year: number;
      voice_profile_id: string | null;
    } | null;
  };
  if (!league) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 });
  }

  const { data: existing } = (await admin
    .from('artifacts')
    .select('id')
    .eq('league_id', session.league_id)
    .eq('artifact_type', 'FOUNDING')
    .maybeSingle()) as { data: { id: string } | null };

  // Idempotent fast path.
  if (session.outputs_generated && existing) {
    return NextResponse.json({
      artifact_id: existing.id,
      canonical_id: league.canonical_id,
      already: true,
    });
  }

  if (session.state !== 'OUTPUT_GENERATION') {
    return NextResponse.json({ error: 'Not ready for outputs' }, { status: 409 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  const ctx: FoundingOutputContext = {
    leagueName: league.name,
    foundingYear: league.founding_year,
    commissionerName: null,
    charterMemberCount: null,
    voiceKey:
      (session.voice_profile_selection as VoiceProfileKey | null) ?? 'MIXED',
    consent: session.consent,
    exchanges: session.exchanges,
  };

  let outputs;
  try {
    outputs = await generateFoundingOutputs(ctx, apiKey);
  } catch {
    return NextResponse.json({ error: 'Generation failed' }, { status: 502 });
  }

  // 1) Founding Artifact: DRAFT artifact + v1 version (reuse if one exists).
  let artifactId = existing?.id ?? null;
  if (!artifactId) {
    const { data: art, error: artErr } = (await admin
      .from('artifacts')
      .insert({
        league_id: session.league_id,
        artifact_type: 'FOUNDING',
        artifact_class: 'FOUNDING',
        approval_state: 'DRAFT',
      })
      .select('id')
      .maybeSingle()) as { data: { id: string } | null; error: unknown };
    if (artErr || !art) {
      return NextResponse.json(
        { error: 'Artifact create failed' },
        { status: 500 },
      );
    }
    artifactId = art.id;
    const { error: verErr } = await admin.from('artifact_versions').insert({
      artifact_id: artifactId,
      version: 1,
      content_markdown: outputs.foundingArtifact,
      generated_by: 'founding-session',
    });
    if (verErr) {
      return NextResponse.json(
        { error: 'Version create failed' },
        { status: 500 },
      );
    }
  }

  // 2) Voice Profile: insert + point the league at it, only if none exists.
  if (!league.voice_profile_id) {
    const { data: vp } = (await admin
      .from('voice_profiles')
      .insert({
        league_id: session.league_id,
        profile_key: ctx.voiceKey,
        prose: outputs.voiceProfile,
        authored_by: 'founding-session',
      })
      .select('id')
      .maybeSingle()) as { data: { id: string } | null };
    if (vp) {
      await admin
        .from('leagues')
        .update({ voice_profile_id: vp.id })
        .eq('id', session.league_id);
    }
  }

  // 3) Office Brief + State-2 eligibility (spec section 9.3): idempotent.
  // oral_history_eligible is promoted to the league from the session's
  // covered_topics so the State-2 (oral-history) signal survives the
  // ephemeral founding session. Consumer is the future State-2 offer; not
  // read yet.
  await admin
    .from('leagues')
    .update({
      office_brief: outputs.officeBrief,
      oral_history_eligible:
        session.covered_topics.includes('PRE_DIGITAL_HISTORY'),
    })
    .eq('id', session.league_id);

  // 4) Mark generated LAST, through the RLS-scoped client.
  const update: FoundingSessionUpdate = { outputs_generated: true };
  await supabase.from('founding_sessions').update(update as never).eq('id', sessionId);

  return NextResponse.json({
    artifact_id: artifactId,
    canonical_id: league.canonical_id,
  });
}
