// src/app/league/[id]/vault/page.tsx
// L.3 The Vault, capture slice (spec engine fee0725, section 5.4). The member's
// compose -> grant -> SEAL surface for the 2026 draft. Authenticated (login-gated
// /league/* tree); the SSR client scopes reads to the viewer's own rows
// (vault_sealed_letters_select = member_user_id = auth.uid()). A letter author is a
// franchise-linked member (rides E2.3 linkage); the unlinked actor sees the surface but
// cannot seal (the API enforces the same boundary).
//
// Capture only: no reveal, no body read-back, no other member's letters or counts
// (invariant 5). The reveal ceremony is a deferred season-end unit (spec 5.5).
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLeague, getViewer } from '@/lib/league';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import type { VaultSealedLetter } from '@/lib/supabase/types';
import { VaultComposePanel } from '@/components/vault/vault-compose-panel';

export const dynamic = 'force-dynamic';

// Capture is scoped to a single season (spec 3.4); 2026 is the D-O hard anchor.
const SEASON = 2026;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `The Vault · ${id}` };
}

export default async function VaultPage({ params }: Props) {
  const { id } = await params;

  const viewer = await getViewer(id);
  if (!viewer.userId) redirect(`/auth/login?redirect=/league/${id}/vault`);

  const league = await getLeague(id);
  if (!league) notFound();

  const supabase = await createServerClient();

  // Is the viewer a franchise-linked member of this league? Only a linked member may author.
  // Resolve via the admin client (franchises is RLS-gated; this is a read to ANSWER the
  // linkage question, the same pattern the seal route uses). Filter on league.id (the UUID);
  // the [id] route param is the canonical slug.
  const admin = createAdminClient();
  const { data: franchise } = (await admin
    .from('franchises')
    .select('id, owner_display_name')
    .eq('league_id', league.id)
    .eq('member_user_id', viewer.userId)
    .limit(1)
    .maybeSingle()) as { data: { id: string; owner_display_name: string } | null };

  // The viewer's own sealed letters — METADATA ONLY (existence + sealed_at). The body is
  // never read here; there is no read path to it (the seal). RLS returns only own rows.
  const { data: sealed } = (await supabase
    .from('vault_sealed_letters')
    .select('id, season, sealed_at')
    .eq('member_user_id', viewer.userId)
    .order('sealed_at', { ascending: false })) as {
    data: Pick<VaultSealedLetter, 'id' | 'season' | 'sealed_at'>[] | null;
  };

  return (
    <main style={{ background: 'var(--vault-bg)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: '2.25rem', letterSpacing: '0.02em', lineHeight: 1.05, margin: 0 }}
          >
            The Vault
          </h1>
          <p className="mt-4 text-vault-text" style={{ opacity: 0.7, maxWidth: '38rem' }}>
            A sealed letter to your December self — trash talk, a bold claim, a note before the
            {' '}
            {SEASON} draft. Once sealed it is timestamped, immutable, and unreadable by anyone —
            including the commissioner — until the season-end reveal. The system keeps your words
            and the honest books; the comedy is the collision.
          </p>
          <div
            className="mt-6"
            style={{ width: 40, height: 1, background: 'rgba(139, 112, 53, 0.4)' }}
          />
        </header>

        <VaultComposePanel
          leagueId={league.id}
          season={SEASON}
          canCompose={!!franchise}
          franchiseName={franchise?.owner_display_name ?? null}
          sealed={sealed ?? []}
        />
      </div>
    </main>
  );
}
