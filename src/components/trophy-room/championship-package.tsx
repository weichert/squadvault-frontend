// src/components/trophy-room/championship-package.tsx
// W.5 Trophy Room - the Championship Package featured band (spec sections 2-3, 8-9). Three Trophy
// Cards, three custody models, ONE completed fact (winning the championship):
//   - The Belt (traveling): derived current holder + the provenance chain (drill-in), COMMISSIONER
//     ATTESTED (the manually-ratified custody ledger);
//   - The Ring (mint-and-keep): an accumulating set, one per champion-season, CANONICAL (derived);
//   - The League Trophy (communal cumulative): the perpetual cumulative name list, CANONICAL.
// Server-rendered; provenance chains and accumulated lists are native <details> drill-ins (on tap,
// never all-expanded - how 16-and-growing seasons stay legible). Governed nameplates: the PFL
// expansion is attested ("Phony Football League", C7); a champion/year with no fact shows blank,
// never a guess (silence over speculation). NO transfer leaderboard, NO streaks (boundary): the
// only count is the trophy's own factual transfer ordinal.
import { TrustBar } from '@/components/ui/trust-bar';
import { PROVENANCE_LABEL, PROVENANCE_STYLE } from '@/lib/trophy-provenance';
import { PFL_EXPANSION, TROPHY_BELT_ID, type ChampionshipPackage } from '@/lib/trophy-room';
import type { TrophyProvenance } from '@/lib/supabase/types';

function ProvenanceBadge({ provenance }: { provenance: TrophyProvenance }) {
  const s = PROVENANCE_STYLE[provenance];
  return (
    <div className="flex justify-end mt-6">
      <span
        className="font-mono"
        style={{ fontSize: '9px', letterSpacing: '0.12em', color: s.color, border: `1px solid ${s.borderColor}`, padding: '3px 8px', borderRadius: 3 }}
      >
        {PROVENANCE_LABEL[provenance]}
      </span>
    </div>
  );
}

// The governed nameplate line: the attested league identity. The PFL expansion is the only
// attested one (C7); never any other.
function Nameplate() {
  return (
    <p className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--vault-text3)', margin: 0 }}>
      {PFL_EXPANSION}
    </p>
  );
}

function Card({
  provenance,
  trophyName,
  category,
  children,
}: {
  provenance: TrophyProvenance;
  trophyName: string;
  category: string;
  children: React.ReactNode;
}) {
  return (
    <article style={{ background: 'var(--vault-s1)', border: '1px solid rgba(139, 112, 53, 0.4)', borderRadius: 4, overflow: 'hidden' }}>
      <div className="px-8 pt-7 pb-6">
        <Nameplate />
        <h3 className="font-ceremonial font-light text-vault-text" style={{ fontSize: '1.7rem', letterSpacing: '0.02em', margin: '0.4rem 0 0', lineHeight: 1.1 }}>
          {trophyName}
        </h3>
        <p className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--vault-text3)', marginTop: 4 }}>
          {category}
        </p>
        {children}
        <ProvenanceBadge provenance={provenance} />
      </div>
      <TrustBar provenance={provenance} />
    </article>
  );
}

// One labeled "derived" line: the current holder is never a stored field (C1) - the label says so.
function DerivedHolder({ name, season, docketId }: { name: string | null; season: number | null; docketId: string | null }) {
  return (
    <div style={{ marginTop: 18 }}>
      <p className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--vault-text3)', margin: 0 }}>
        Current holder (derived)
      </p>
      {name ? (
        <>
          <p className="font-ceremonial text-vault-text" style={{ fontSize: '1.45rem', letterSpacing: '0.01em', marginTop: 4 }}>
            {name}
          </p>
          {season != null && (
            <p className="font-ui text-vault-text2" style={{ fontSize: '0.85rem', marginTop: 2 }}>
              since {season}
            </p>
          )}
          {docketId && (
            <p className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.1em', color: 'var(--vault-text3)', marginTop: 6 }}>
              {docketId}
            </p>
          )}
        </>
      ) : (
        // Silence over speculation: no holder recorded -> no guess.
        <p className="font-ceremonial italic text-vault-text2" style={{ fontSize: '1.05rem', marginTop: 4 }}>
          No holder recorded yet.
        </p>
      )}
    </div>
  );
}

function Drill({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details style={{ marginTop: 14 }}>
      <summary className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--vault-gold-dim)', cursor: 'pointer' }}>
        {summary}
      </summary>
      <div style={{ marginTop: 8 }}>{children}</div>
    </details>
  );
}

export function ChampionshipPackage({ pkg }: { pkg: ChampionshipPackage }) {
  const { belt, champions } = pkg;
  const beltDocket = belt.currentSeason != null ? `${TROPHY_BELT_ID}-${belt.currentSeason}` : null;

  return (
    <section className="mb-12">
      <h2 className="font-mono" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--vault-gold-dim)', marginBottom: 14 }}>
        The Championship Package
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>

        {/* The Belt - traveling individual; manually-ratified custody ledger. */}
        <Card provenance="COMMISSIONER_ATTESTED" trophyName="The Belt" category="Traveling - passes to each new champion">
          <DerivedHolder name={belt.currentHolderName} season={belt.currentSeason} docketId={beltDocket} />
          {belt.transferCount > 0 && (
            <p className="font-ui text-vault-text2" style={{ fontSize: '0.82rem', marginTop: 10 }}>
              {belt.transferCount === 1 ? '1st transfer' : `${ordinal(belt.transferCount)} transfer`} in trophy history.
            </p>
          )}
          {belt.chain.length > 0 && (
            <Drill summary={`Provenance chain (${belt.chain.length})`}>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {belt.chain.map((t, i) => (
                  <li key={i} className="font-ui" style={{ fontSize: '0.82rem', color: 'var(--vault-text2)', padding: '5px 0', borderTop: i === 0 ? 'none' : '1px solid var(--vault-border)' }}>
                    <span className="text-vault-text">{t.toName ?? 'an unnamed franchise'}</span>
                    {' '}held it from {t.season}{t.week != null ? ` W${t.week}` : ''}
                    {t.fromName ? <> — taken from {t.fromName}</> : <> — first held</>}
                    {t.occasion && (
                      <span className="italic" style={{ color: 'var(--vault-text3)', display: 'block', marginTop: 2 }}>
                        &ldquo;{t.occasion}&rdquo;
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </Drill>
          )}
        </Card>

        {/* The Ring - mint-and-keep; one per champion-season, derived. */}
        <Card provenance="CANONICAL" trophyName="The Ring" category="Mint-and-keep - one per champion, kept forever">
          {champions.length > 0 ? (
            <>
              <p className="font-ceremonial text-vault-text" style={{ fontSize: '1.45rem', marginTop: 18 }}>
                {champions.length === 1 ? '1 ring minted' : `${champions.length} rings minted`}
              </p>
              <Drill summary={`Every champion's ring (${champions.length})`}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {champions.map((c, i) => (
                    <li key={i} className="font-ui" style={{ fontSize: '0.85rem', color: 'var(--vault-text2)', padding: '4px 0', borderTop: i === 0 ? 'none' : '1px solid var(--vault-border)' }}>
                      <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--vault-text3)' }}>{c.season}</span>
                      {'  '}<span className="text-vault-text">{c.eraName ?? '(champion not recorded)'}</span>
                    </li>
                  ))}
                </ul>
              </Drill>
            </>
          ) : (
            <p className="font-ceremonial italic text-vault-text2" style={{ fontSize: '1.05rem', marginTop: 18 }}>
              The first ring is minted with the first champion.
            </p>
          )}
        </Card>

        {/* The League Trophy - communal perpetual; cumulative name list, derived. */}
        <Card provenance="CANONICAL" trophyName="The League Trophy" category="Communal - one perpetual trophy, every name added">
          {champions.length > 0 ? (
            <>
              <p className="font-ceremonial text-vault-text" style={{ fontSize: '1.45rem', marginTop: 18 }}>
                {`${champions.length} ${champions.length === 1 ? 'name' : 'names'} engraved`}
              </p>
              <Drill summary={`The cumulative record (${champions.length})`}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {champions.map((c, i) => (
                    <li key={i} className="font-ui" style={{ fontSize: '0.85rem', color: 'var(--vault-text2)', padding: '4px 0', borderTop: i === 0 ? 'none' : '1px solid var(--vault-border)' }}>
                      <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--vault-text3)' }}>{c.season}</span>
                      {'  '}<span className="text-vault-text">{c.eraName ?? '(champion not recorded)'}</span>
                    </li>
                  ))}
                </ul>
              </Drill>
            </>
          ) : (
            <p className="font-ceremonial italic text-vault-text2" style={{ fontSize: '1.05rem', marginTop: 18 }}>
              The first name is engraved with the first champion.
            </p>
          )}
        </Card>
      </div>
    </section>
  );
}

// A small factual ordinal (1st/2nd/7th transfer in the trophy's own history). NOT a leaderboard or
// a streak - it is the trophy's provenance count, per spec section 8.1.
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
