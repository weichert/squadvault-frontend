import { getLeague } from '@/lib/league';
import { LockedRoom } from '@/components/ui/locked-room';
import { TrophyPreview } from '@/components/ui/trophy-preview';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

// Server Component reading live Supabase state. Skip Next.js route segment
// caching so synced artifacts surface without a hard reload. See
// _observations/OBSERVATIONS_2026_05_28_LEAGUE_PAGES_FORCE_DYNAMIC.md in the
// engine repo for the full rationale.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const league = await getLeague(id);
  if (!league) return { title: 'Clubhouse' };
  return {
    title: league.name,
    description: `The official Clubhouse for ${league.name}, established ${league.founding_year}.`,
    openGraph: { images: [`/api/og?leagueId=${id}`] },
  };
}

export default async function LeaguePage({ params }: Props) {
  const { id } = await params;
  const league = await getLeague(id);
  if (!league) notFound();
  if (league.status === 'founding') {
    return <LockedRoom leagueName={league.name} />;
  }
  return (
    <main className="plaque-overlap" style={{ background: 'var(--vault-bg)', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="vault-plaque mb-16">
          <p className="font-mono text-[9px] tracking-[0.2em] text-vault-text3 mb-4">ESTABLISHED</p>
          <h1 className="font-ceremonial font-light text-vault-text mb-2" style={{ fontSize: '2.8rem', letterSpacing: '0.04em' }}>
            {league.name}
          </h1>
          <p className="font-ceremonial text-sm text-vault-text2 italic mb-6">Est. {league.founding_year}</p>
          <div className="mx-auto mb-6" style={{ width: 40, height: 1, background: 'rgba(139, 112, 53, 0.5)' }} />
          <p className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 leading-loose">COMMISSIONER: FOUNDING MEMBER</p>
        </div>
        <TrophyPreview leagueId={id} />
        <div className="text-center">
          <p className="font-ui text-sm text-vault-text3">The archive is being populated. Check back soon.</p>
        </div>
      </div>
    </main>
  );
}
