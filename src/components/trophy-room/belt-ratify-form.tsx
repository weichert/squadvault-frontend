'use client';

// src/components/trophy-room/belt-ratify-form.tsx
// W.5 Trophy Room - the commissioner ratify UI (the thin follow-on to the shipped, proven route
// POST /api/trophy-room/custody). A client island, rendered ONLY for the league commissioner (the
// page gates on viewer.isCommissioner; the route + RLS are the hard guarantee). The commissioner
// records one Belt custody transfer - a per-championship handoff or a historical backfill row. This
// is a publication of a fact that happened, not fact-creation; append-only (a correction is a new
// transfer). No member/anon path. No leaderboard, no streaks - just the transfer.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type FranchiseOpt = { id: string; name: string };

export function BeltRatifyForm({ leagueId, franchises }: { leagueId: string; franchises: FranchiseOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toFranchise, setTo] = useState('');
  const [fromFranchise, setFrom] = useState('');
  const [season, setSeason] = useState('');
  const [week, setWeek] = useState('');
  const [occasion, setOccasion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!toFranchise) { setError('Choose the new holder.'); return; }
    const seasonNum = Number(season);
    if (!season || !Number.isInteger(seasonNum)) { setError('Enter the season (a year).'); return; }
    if (fromFranchise && fromFranchise === toFranchise) { setError('The prior and new holder cannot be the same.'); return; }
    const weekNum = week ? Number(week) : null;
    if (week && !Number.isInteger(weekNum)) { setError('Week must be a whole number, or leave it blank.'); return; }

    setBusy(true);
    try {
      const res = await fetch('/api/trophy-room/custody', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          toFranchise,
          fromFranchise: fromFranchise || undefined,
          season: seasonNum,
          week: weekNum ?? undefined,
          occasion: occasion.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? 'Could not record the transfer.');
        setBusy(false);
        return;
      }
      setTo(''); setFrom(''); setSeason(''); setWeek(''); setOccasion('');
      setOpen(false);
      setBusy(false);
      router.refresh();
    } catch {
      setError('Could not record the transfer.');
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: '0.85rem', color: 'var(--vault-text)', background: 'var(--vault-bg)',
    border: '1px solid var(--vault-border)', borderRadius: 4, padding: '6px 8px', marginTop: 4,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--vault-text3)',
  };

  if (!open) {
    return (
      <div className="mb-8">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-mono"
          style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--vault-text2)', background: 'transparent', border: '1px solid var(--vault-gold-dim)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
        >
          + Ratify a Belt transfer
        </button>
      </div>
    );
  }

  return (
    <div className="mb-8" style={{ padding: '14px 16px', border: '1px solid var(--vault-gold-dim)', borderRadius: 6, background: 'var(--vault-s1)' }}>
      <p className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--vault-gold-dim)', margin: 0 }}>
        Ratify a Belt transfer
      </p>
      <p className="font-ui" style={{ fontSize: '0.78rem', color: 'var(--vault-text3)', marginTop: 4, lineHeight: 1.4 }}>
        Record a handoff that happened, or backfill a historical one. A correction is a new transfer; nothing is ever edited.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 12 }}>
        <label style={labelStyle}>
          New holder
          <select value={toFranchise} onChange={(e) => setTo(e.target.value)} className="font-ui" style={inputStyle}>
            <option value="">Choose a franchise...</option>
            {franchises.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label style={labelStyle}>
          Taken from (optional)
          <select value={fromFranchise} onChange={(e) => setFrom(e.target.value)} className="font-ui" style={inputStyle}>
            <option value="">First held / origin</option>
            {franchises.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label style={labelStyle}>
          Season
          <input type="number" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2025" className="font-ui" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Week (optional)
          <input type="number" value={week} onChange={(e) => setWeek(e.target.value)} placeholder="9" className="font-ui" style={inputStyle} />
        </label>
      </div>
      <label style={{ ...labelStyle, display: 'block', marginTop: 10 }}>
        Occasion (optional)
        <input type="text" value={occasion} onChange={(e) => setOccasion(e.target.value)} maxLength={280} placeholder="How it changed hands" className="font-ui" style={inputStyle} />
      </label>

      {error && <p className="font-ui" style={{ fontSize: '0.72rem', color: '#b4654a', marginTop: 8 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={submit} disabled={busy} className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--vault-text)', background: 'transparent', border: '1px solid var(--vault-gold)', borderRadius: 4, padding: '5px 12px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}>
          {busy ? 'Recording...' : 'Ratify transfer'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} disabled={busy} className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--vault-text3)', background: 'transparent', border: '1px solid var(--vault-border)', borderRadius: 4, padding: '5px 12px', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
