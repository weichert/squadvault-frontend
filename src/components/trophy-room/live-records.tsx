// src/components/trophy-room/live-records.tsx
// W.5 Increment 2 Wave 1 - the Live Records section (spec memo 3, sections 2-3, 6). The 4 Group-A
// traveling-record plaques, each a DERIVED read off the championship/season record (C1, never
// stored), multi-valued on tie (C6 - The Floor lists every co-holder). Reuses the increment-1 card
// idiom: holder labeled derived, immutable qualification, Docket ID (TR-LRC-<#>-<season>), trust bar
// (CANONICAL = engine-derived facts), a <details> drill-in for the leader-over-time history. No
// counts-as-contest, no leaderboard, no live counter (boundary) - the value and its history are
// displayed as record, not competition.
import { TrustBar } from '@/components/ui/trust-bar';
import { PROVENANCE_LABEL, PROVENANCE_STYLE } from '@/lib/trophy-provenance';
import type { LiveRecord, LiveRecordHolder, LiveRecords } from '@/lib/trophy-room';

function holderLine(h: LiveRecordHolder): string {
  const name = h.name ?? 'an unrecorded franchise';
  return h.season != null ? `${name} (${h.season})` : name;
}

export function TrophyCard({ rec }: { rec: LiveRecord }) {
  const s = PROVENANCE_STYLE.CANONICAL;
  return (
    <article style={{ background: 'var(--vault-s1)', border: '1px solid rgba(139, 112, 53, 0.4)', borderRadius: 4, overflow: 'hidden' }}>
      <div className="px-8 pt-7 pb-6">
        <h3 className="font-ceremonial font-light text-vault-text" style={{ fontSize: '1.6rem', letterSpacing: '0.02em', margin: 0, lineHeight: 1.1 }}>
          {rec.trophyName}
        </h3>
        {/* Immutable qualification - no baked-in holder. */}
        <p className="font-ui text-vault-text2" style={{ fontSize: '0.85rem', marginTop: 6, lineHeight: 1.4 }}>
          {rec.qualification}
        </p>

        {/* The DERIVED holder(s) - labeled derived (C1); multi-valued on tie (C6). */}
        <div style={{ marginTop: 16 }}>
          <p className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--vault-text3)', margin: 0 }}>
            {rec.holders.length > 1 ? 'Held by (derived, co-held)' : 'Held by (derived)'}
          </p>
          {rec.holders.length > 0 ? (
            <>
              {rec.holders.map((h, i) => (
                <p key={i} className="font-ceremonial text-vault-text" style={{ fontSize: '1.35rem', letterSpacing: '0.01em', marginTop: i === 0 ? 4 : 1 }}>
                  {holderLine(h)}
                </p>
              ))}
              {rec.valueText && (
                <p className="font-ui text-vault-text2" style={{ fontSize: '0.85rem', marginTop: 3 }}>{rec.valueText}</p>
              )}
            </>
          ) : (
            // Silence over speculation: nothing recorded yet -> no guess.
            <p className="font-ceremonial italic text-vault-text2" style={{ fontSize: '1.05rem', marginTop: 4 }}>
              No record set yet.
            </p>
          )}
          <p className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.1em', color: 'var(--vault-text3)', marginTop: 8 }}>
            {rec.docketId}
          </p>
        </div>

        {rec.history.length > 1 && (
          <details style={{ marginTop: 12 }}>
            <summary className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--vault-gold-dim)', cursor: 'pointer' }}>
              How the mark moved ({rec.history.length})
            </summary>
            <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
              {rec.history.map((h, i) => (
                <li key={i} className="font-ui" style={{ fontSize: '0.82rem', color: 'var(--vault-text2)', padding: '4px 0', borderTop: i === 0 ? 'none' : '1px solid var(--vault-border)' }}>
                  <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--vault-text3)' }}>{h.season}</span>
                  {'  '}<span className="text-vault-text">{h.names.join(' & ')}</span>
                  {h.valueText && <span style={{ color: 'var(--vault-text3)' }}> — {h.valueText}</span>}
                </li>
              ))}
            </ol>
          </details>
        )}

        {/* Provenance badge - the engine-derived facts read as CANONICAL. */}
        <div className="flex justify-end mt-6">
          <span className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.12em', color: s.color, border: `1px solid ${s.borderColor}`, padding: '3px 8px', borderRadius: 3 }}>
            {PROVENANCE_LABEL.CANONICAL}
          </span>
        </div>
      </div>
      <TrustBar provenance="CANONICAL" />
    </article>
  );
}

// A titled grid of Trophy Cards - reused by Live Records (inc-2 Wave 1) and the inc-3 Wave A
// Annual / Permanent sections. Renders nothing when empty.
export function RecordSection({ title, records }: { title: string; records: LiveRecord[] }) {
  if (records.length === 0) return null;
  return (
    <section className="mb-12">
      <h2 className="font-mono" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--vault-gold-dim)', marginBottom: 14 }}>
        {title}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {records.map((rec) => <TrophyCard key={rec.docketNumber} rec={rec} />)}
      </div>
    </section>
  );
}

export function LiveRecords({ live }: { live: LiveRecords }) {
  return <RecordSection title="Live Records" records={live.records} />;
}
