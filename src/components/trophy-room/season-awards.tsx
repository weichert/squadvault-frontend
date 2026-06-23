// src/components/trophy-room/season-awards.tsx
// W.5 Increment 3 Wave A - the Annual + Permanent award sections (spec engine
// OBSERVATIONS_2026_06_23_W5_INC3_SPECIFICATION.md, section 3). The per-season grants (#2/#5/#8/#10/
// #11) and the fixed Inaugural Champion (#32) reuse the Trophy Card idiom (RecordSection); the two
// multi-lists (#34 Back-to-Back, #35 The Perfect Storm) render as entry lists. All DERIVED (C1),
// multi-valued on tie (C6), era-correct, CANONICAL trust bar. No counts-as-contest, no leaderboard.
import { TrustBar } from '@/components/ui/trust-bar';
import { PROVENANCE_LABEL, PROVENANCE_STYLE } from '@/lib/trophy-provenance';
import { RecordSection, TrophyCard } from '@/components/trophy-room/live-records';
import type { LiveRecordList, SeasonAwards as SeasonAwardsData } from '@/lib/trophy-room';

// A list-shaped award (#34 Back-to-Back, #35 The Perfect Storm) - one entry per qualifying row,
// rather than a single derived holder. Same card chrome + CANONICAL trust bar.
function ListCard({ list }: { list: LiveRecordList }) {
  const s = PROVENANCE_STYLE.CANONICAL;
  return (
    <article style={{ background: 'var(--vault-s1)', border: '1px solid rgba(139, 112, 53, 0.4)', borderRadius: 4, overflow: 'hidden' }}>
      <div className="px-8 pt-7 pb-6">
        <h3 className="font-ceremonial font-light text-vault-text" style={{ fontSize: '1.6rem', letterSpacing: '0.02em', margin: 0, lineHeight: 1.1 }}>
          {list.trophyName}
        </h3>
        <p className="font-ui text-vault-text2" style={{ fontSize: '0.85rem', marginTop: 6, lineHeight: 1.4 }}>
          {list.qualification}
        </p>
        <div style={{ marginTop: 16 }}>
          <p className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--vault-text3)', margin: 0 }}>
            {list.entries.length === 1 ? 'The record (derived)' : `Every entry (derived, ${list.entries.length})`}
          </p>
          {list.entries.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
              {list.entries.map((e, i) => (
                <li key={i} className="font-ui" style={{ fontSize: '0.9rem', color: 'var(--vault-text2)', padding: '4px 0', borderTop: i === 0 ? 'none' : '1px solid var(--vault-border)' }}>
                  <span className="font-ceremonial text-vault-text" style={{ fontSize: '1.05rem' }}>{e.name ?? 'an unrecorded franchise'}</span>
                  {e.valueText && <span style={{ color: 'var(--vault-text3)' }}> — {e.valueText}</span>}
                </li>
              ))}
            </ul>
          ) : (
            // Silence over speculation: nothing qualifies yet -> no guess.
            <p className="font-ceremonial italic text-vault-text2" style={{ fontSize: '1.05rem', marginTop: 4 }}>
              No record set yet.
            </p>
          )}
          <p className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.1em', color: 'var(--vault-text3)', marginTop: 8 }}>
            {list.docketId}
          </p>
        </div>
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

export function SeasonAwards({ awards }: { awards: SeasonAwardsData }) {
  const { annual, permanentCards, permanentLists } = awards;
  const hasPermanent = permanentCards.length > 0 || permanentLists.length > 0;
  return (
    <>
      <RecordSection title="Annual Awards" records={annual} />
      {hasPermanent && (
        <section className="mb-12">
          <h2 className="font-mono" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--vault-gold-dim)', marginBottom: 14 }}>
            Permanent Records
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {permanentCards.map((rec) => <TrophyCard key={rec.docketNumber} rec={rec} />)}
            {permanentLists.map((list) => <ListCard key={list.docketNumber} list={list} />)}
          </div>
        </section>
      )}
    </>
  );
}
