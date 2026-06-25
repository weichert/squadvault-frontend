// src/components/trophy-room/founders-seal.tsx
// Trophy #31 The Founder's Seal - the league's origin statement, rendered as its own band near the top
// of the Trophy Room. Provenance is ATTESTED (human testimony), NEVER canonical: the founding predates
// the digital era, so the basis (who attested, and when) is shown plainly and the trust label reads
// visibly differently from the CANONICAL bar the awards use. Absent entry -> renders nothing (silence
// before migration 031 lands).
import type { FoundersSeal as FoundersSealData } from '@/lib/trophy-room';

// The attested axis colour (matches the COMMISSIONER_ATTESTED trust style), distinct from CANONICAL gold.
const ATTESTED_COLOR = '#3B7A7A';

export function FoundersSeal({ seal }: { seal: FoundersSealData | null }) {
  if (!seal) return null; // silence over speculation - nothing until the entry is seated
  return (
    <section className="mb-12">
      <article style={{ background: 'var(--vault-s1)', border: `1px solid ${ATTESTED_COLOR}55`, borderRadius: 4, overflow: 'hidden' }}>
        <div className="px-8 pt-8 pb-7">
          <p className="font-mono" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: ATTESTED_COLOR, margin: 0 }}>
            The Origin of the League
          </p>
          <h2 className="font-ceremonial font-light text-vault-text" style={{ fontSize: '2rem', letterSpacing: '0.02em', marginTop: 8, marginBottom: 0, lineHeight: 1.1 }}>
            {seal.title}
          </h2>
          {seal.description && (
            <p className="font-ui text-vault-text2" style={{ fontSize: '1rem', lineHeight: 1.6, marginTop: 14, maxWidth: '52ch' }}>
              {seal.description}
            </p>
          )}
          {/* The ATTESTED trust label - human testimony, NOT canonical - with the basis stated plainly. */}
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(139, 112, 53, 0.18)' }}>
            <span className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: ATTESTED_COLOR, border: `1px solid ${ATTESTED_COLOR}66`, borderRadius: 3, padding: '3px 8px' }}>
              Attested &middot; Not Canonical Data
            </span>
            {seal.basis && (
              <p className="font-ui italic" style={{ fontSize: '0.82rem', color: 'var(--vault-text3)', marginTop: 8 }}>
                {seal.basis}
              </p>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}
