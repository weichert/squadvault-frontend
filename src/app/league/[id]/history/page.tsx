// src/app/league/[id]/history/page.tsx
// L.1 Historian Interviews, capture-only first wave (spec engine c9d32d5, section 5.1). The
// member's oral-history interview surface. Authenticated (login-gated /league/* tree); the SSR
// client scopes reads to the viewer's own rows (member_history_sessions_select =
// member_user_id = auth.uid()). A subject is a franchise-linked member (rides E2.3 linkage);
// the unlinked actor sees the surface but cannot be interviewed (the API enforces the same
// boundary). CAPTURE ONLY: no outputs, no other member's testimony, no commissioner read.
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLeague, getViewer } from '@/lib/league';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import type { MemberHistoryExchange } from '@/lib/supabase/types';
import { HistorianConversation } from '@/components/history/historian-conversation';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `The Historian · ${id}` };
}

type ExchangeView = Pick<
  MemberHistoryExchange,
  'turn' | 'speaker' | 'content' | 'intent_classified' | 'topic_covered'
>;

export default async function HistoryPage({ params }: Props) {
  const { id } = await params;

  const viewer = await getViewer(id);
  if (!viewer.userId) redirect(`/auth/login?redirect=/league/${id}/history`);

  const league = await getLeague(id);
  if (!league) notFound();

  const supabase = await createServerClient();

  // Is the viewer a franchise-linked member of this league? Only a linked member is
  // interviewed. Resolve via the admin client (franchises is RLS-gated; this read just answers
  // the linkage question, the same pattern the vault page + seal route use).
  const admin = createAdminClient();
  const { data: franchise } = (await admin
    .from('franchises')
    .select('id, owner_display_name')
    .eq('league_id', league.id)
    .eq('member_user_id', viewer.userId)
    .limit(1)
    .maybeSingle()) as { data: { id: string; owner_display_name: string } | null };

  // Resume an in-progress interview (RLS author-only). If one exists, seed the conversation
  // with its exchanges; otherwise the client shows the consent-grant gate to begin.
  let sessionId: string | null = null;
  let exchanges: ExchangeView[] = [];
  if (franchise) {
    const { data: existing } = (await supabase
      .from('member_history_sessions')
      .select('id')
      .eq('member_user_id', viewer.userId)
      .eq('league_id', league.id)
      .eq('state', 'IN_PROGRESS')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: { id: string } | null };
    if (existing) {
      sessionId = existing.id;
      const { data: rows } = (await supabase
        .from('member_history_exchanges')
        .select('turn, speaker, content, intent_classified, topic_covered')
        .eq('session_id', existing.id)
        .order('turn', { ascending: true })) as { data: ExchangeView[] | null };
      exchanges = rows ?? [];
    }
  }

  return (
    <main style={{ background: 'var(--vault-bg)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: '2.25rem', letterSpacing: '0.02em', lineHeight: 1.05, margin: 0 }}
          >
            The Historian
          </h1>
          <p className="mt-4 text-vault-text" style={{ opacity: 0.7, maxWidth: '38rem' }}>
            Before the season, the league historian sits down with you to record your account of
            what {league.name} was — the games people still bring up, the trade nobody agrees on,
            how you got here. Your words are kept attributed to you, never merged with anyone
            else&rsquo;s into an &ldquo;official&rdquo; version. You can skip anything and stop
            anytime.
          </p>
          <div
            className="mt-6"
            style={{ width: 40, height: 1, background: 'rgba(139, 112, 53, 0.4)' }}
          />
        </header>

        <HistorianConversation
          leagueId={league.id}
          canInterview={!!franchise}
          memberName={franchise?.owner_display_name ?? null}
          initialSessionId={sessionId}
          initialExchanges={exchanges}
        />
      </div>
    </main>
  );
}
