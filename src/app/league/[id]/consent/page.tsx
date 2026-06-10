// src/app/league/[id]/consent/page.tsx
// W.6 member consent settings — the member's own ratification surface (memo
// section 5). Authenticated (under the login-gated /league/* tree); reads via
// the SSR client so RLS scopes everything to the viewer's own rows
// (member_user_id = auth.uid()). The subject is the authenticated person
// (W.6 1.2), so this works for any league member; today the resolvable identity
// is the commissioner, and it extends to members once onboarding links
// franchises.member_user_id (E2.3).
//
// NOTE: W.6 names "the Member Office" as the home. The per-franchise Member
// Office page (members/[franchiseId]) is a PUBLIC, admin-read, viewer-agnostic
// surface and cannot host member-only writes, so this lives on its own
// authenticated page. Placement is provisional — W.2 (clubhouse navigation)
// may relocate it into the scene.
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLeague, getViewer } from '@/lib/league';
import { createServerClient } from '@/lib/supabase/server';
import type {
  MemberConsentCategory,
  MemberConsentEvent,
  MemberConsentEventType,
} from '@/lib/supabase/types';
import {
  MemberConsentPanel,
  type ConsentCurrentState,
} from '@/components/consent/member-consent-panel';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Your consent settings · ${id}` };
}

export default async function ConsentSettingsPage({ params }: Props) {
  const { id } = await params;

  const viewer = await getViewer(id);
  if (!viewer.userId) redirect(`/auth/login?redirect=/league/${id}/consent`);

  const league = await getLeague(id);
  if (!league) notFound();

  // SSR client -> RLS scopes both reads to the viewer's own consent rows.
  const supabase = await createServerClient();

  const { data: currentRows } = (await supabase
    .from('member_consent_current')
    .select('category, current_state')
    .eq('member_user_id', viewer.userId)) as {
    data: { category: MemberConsentCategory; current_state: MemberConsentEventType }[] | null;
  };

  const { data: historyRows } = (await supabase
    .from('member_consent_events')
    .select('*')
    .eq('member_user_id', viewer.userId)
    .order('recorded_at', { ascending: false })) as {
    data: MemberConsentEvent[] | null;
  };

  const current: ConsentCurrentState = {};
  for (const r of currentRows ?? []) current[r.category] = r.current_state;

  return (
    <main style={{ background: 'var(--vault-bg)', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: '2.25rem', letterSpacing: '0.02em', lineHeight: 1.05, margin: 0 }}
          >
            Your consent
          </h1>
          <div
            className="mt-6"
            style={{ width: 40, height: 1, background: 'rgba(139, 112, 53, 0.4)' }}
          />
        </header>

        <MemberConsentPanel
          leagueId={league.id}
          current={current}
          history={historyRows ?? []}
        />
      </div>
    </main>
  );
}
