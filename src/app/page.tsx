import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer, getLeague } from '@/lib/league';

// The root route branches on viewer identity, which means reading the request's
// auth cookies (via getViewer). Force dynamic rendering so it is evaluated per
// request rather than statically prerendered at build time.
export const dynamic = 'force-dynamic';

// Canonical league id lives in the URL, never the leagues UUID (the documented
// 404 trap). No shared constant exists in the codebase; the literal matches how
// every /league/[id] consumer keys getLeague.
const CANONICAL_LEAGUE_ID = '70985';

export default async function HomePage() {
  // Authed viewers never see the splash: redirect server-side to the league
  // home before any markup renders (no interstitial, no flash). getViewer is
  // the existing cached auth helper - no auth logic is duplicated here.
  const viewer = await getViewer(CANONICAL_LEAGUE_ID);
  if (viewer.userId) {
    redirect(`/league/${CANONICAL_LEAGUE_ID}`);
  }

  // Anonymous viewers get the minimal landing. The identity line is resolved
  // live from getLeague (name + founding_year are already in its select) -
  // never hardcoded.
  const league = await getLeague(CANONICAL_LEAGUE_ID);

  return (
    <main style={{ background: 'var(--vault-bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--vault-text3)', marginBottom: '1rem' }}>
          SQUADVAULT
        </p>
        <h1 style={{ fontFamily: 'var(--font-ceremonial)', fontSize: '3rem', fontWeight: 300, color: 'var(--vault-text)', letterSpacing: '0.04em' }}>
          The Clubhouse
        </h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.875rem', color: 'var(--vault-text2)', marginTop: '1rem' }}>
          Your league&apos;s permanent record.
        </p>
        {league && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.12em', color: 'var(--vault-text3)', marginTop: '2rem' }}>
            {league.name} &middot; Est. {league.founding_year}
          </p>
        )}
        <p style={{ marginTop: '2rem' }}>
          <Link
            href={`/auth/login?redirect=/league/${CANONICAL_LEAGUE_ID}`}
            style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--vault-text2)', textDecoration: 'none', letterSpacing: '0.02em' }}
          >
            Member sign-in &rarr;
          </Link>
        </p>
      </div>
    </main>
  );
}
