// src/app/founding/[id]/page.tsx
// Commissioner Founding Session (State 3) — chrome-less full-screen surface.
//
// Top-level route (outside the league nav layout) so it renders without app
// chrome, per Design Brief section 7.4. Server component: authenticate, guard
// (founding-status league + commissioner), resolve an existing session to
// resume into the interactive conversation, else show the "Begin" entry.
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLeague, getViewer } from '@/lib/league';
import { createServerClient } from '@/lib/supabase/server';
import type { FoundingSession } from '@/lib/supabase/types';
import { BeginButton } from '@/components/founding/begin-button';
import { FoundingConversation } from '@/components/founding/conversation';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Founding Session · ${id}` };
}

export default async function FoundingPage({ params }: Props) {
  const { id } = await params;

  const viewer = await getViewer(id);
  if (!viewer.userId) redirect(`/auth/login?redirect=/founding/${id}`);

  const league = await getLeague(id);
  if (!league) notFound();

  // State 3 is for founding-status leagues only. An already-founded league
  // belongs in the established experience (spec section 1.4).
  if (league.status !== 'founding') redirect(`/league/${id}`);

  if (!viewer.isCommissioner) {
    return (
      <main
        style={{
          background: 'var(--vault-bg)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <p
          className="font-ui"
          style={{ color: 'var(--vault-text2)', fontSize: '0.95rem' }}
        >
          The founding session is administered by the commissioner.
        </p>
      </main>
    );
  }

  // Resolve an existing session. SSR client -> RLS scopes to this commissioner.
  const supabase = await createServerClient();
  const { data: sessions } = await supabase
    .from('founding_sessions')
    .select('*')
    .eq('league_id', league.id)
    .order('created_at', { ascending: false })
    .limit(1);
  const session = (sessions?.[0] as FoundingSession | undefined) ?? null;

  if (session && session.state === 'COMPLETE') redirect(`/league/${id}`);

  return (
    <main
      style={{
        background: 'var(--vault-bg)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.5rem 2rem',
        }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--vault-text2)',
            textTransform: 'uppercase',
          }}
        >
          {league.name}
        </span>
      </header>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: session ? 'flex-start' : 'center',
          padding: '2rem',
          gap: '2rem',
        }}
      >
        {session ? (
          <FoundingConversation
            sessionId={session.id}
            initialExchanges={session.exchanges}
            initialState={session.state}
            initialCoveredTopics={session.covered_topics}
            initialVoiceSelection={session.voice_profile_selection}
          />
        ) : (
          <div
            style={{
              textAlign: 'center',
              maxWidth: 560,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
            }}
          >
            <p
              className="font-ceremonial"
              style={{
                fontSize: '1.5rem',
                lineHeight: 1.4,
                color: 'var(--vault-text)',
              }}
            >
              Nothing is in the vault yet.
            </p>
            <p
              className="font-ui"
              style={{ color: 'var(--vault-text2)', fontSize: '0.95rem' }}
            >
              The founding session takes about 20 minutes. By the end,{' '}
              {league.name} will have a founding record, a voice, and a set of
              spaces ready for the people about to join.
            </p>
            <BeginButton canonicalId={id} />
          </div>
        )}
      </div>
    </main>
  );
}
