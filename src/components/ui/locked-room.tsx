// src/components/ui/locked-room.tsx
// The Locked Room appears when a Clubhouse URL is visited before the founding session is complete.
// This is the product's first visual impression. It must be beautifully executed.
// The vault door communicates: this is intentional, this is coming, this is worth waiting for.

interface LockedRoomProps {
  leagueName?: string;
}

export function LockedRoom({ leagueName }: LockedRoomProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
         style={{ background: 'var(--vault-bg)' }}>

      {/* Vault door SVG */}
      <div className="mb-12">
        <svg
          width="180"
          height="220"
          viewBox="0 0 180 220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="SquadVault — this Clubhouse is being prepared"
          role="img"
        >
          {/* Vault door frame */}
          <rect x="10" y="10" width="160" height="200" rx="8"
            fill="#141418" stroke="#2C2C34" strokeWidth="2"/>

          {/* Inner door panel */}
          <rect x="20" y="20" width="140" height="180" rx="5"
            fill="#0B0B0E" stroke="#2C2C34" strokeWidth="1"/>

          {/* Corner bolts */}
          {[[32, 32], [148, 32], [32, 188], [148, 188]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="5" fill="#1D1D23" stroke="#3A3A44" strokeWidth="1"/>
          ))}

          {/* Combination dial — animates slowly */}
          <g style={{ transformOrigin: '90px 110px' }} className="animate-dial-spin">
            <circle cx="90" cy="110" r="30" fill="#141418" stroke="#8B7035" strokeWidth="1.5"/>
            <circle cx="90" cy="110" r="22" fill="#0B0B0E" stroke="#2C2C34" strokeWidth="1"/>
            {/* Tick marks */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const x1 = 90 + 24 * Math.sin(angle);
              const y1 = 110 - 24 * Math.cos(angle);
              const x2 = 90 + 27 * Math.sin(angle);
              const y2 = 110 - 27 * Math.cos(angle);
              return (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={i === 0 ? '#C9A84C' : '#3A3A44'}
                  strokeWidth={i === 0 ? 2 : 1}/>
              );
            })}
            {/* Center spindle */}
            <circle cx="90" cy="110" r="4" fill="#8B7035"/>
            <circle cx="90" cy="110" r="2" fill="#C9A84C"/>
            {/* Pointer line */}
            <line x1="90" y1="110" x2="90" y2="84"
              stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"/>
          </g>

          {/* Handle */}
          <rect x="115" y="106" width="22" height="8" rx="4"
            fill="#1D1D23" stroke="#3A3A44" strokeWidth="1"/>
          <circle cx="137" cy="110" r="4" fill="#1D1D23" stroke="#3A3A44" strokeWidth="1"/>

          {/* SquadVault SV mark */}
          <text x="90" y="72" textAnchor="middle"
            fontFamily="'Cormorant Garamond', Georgia, serif"
            fontSize="11" fontWeight="300" letterSpacing="0.2em"
            fill="#514D47">
            SV
          </text>

          {/* Bottom label */}
          <text x="90" y="176" textAnchor="middle"
            fontFamily="'DM Mono', Courier New, monospace"
            fontSize="7" letterSpacing="0.15em"
            fill="#514D47">
            SQUADVAULT
          </text>
        </svg>
      </div>

      {/* Message */}
      <div className="text-center max-w-sm">
        {leagueName && (
          <p className="font-mono text-[10px] tracking-[0.2em] text-vault-text3 uppercase mb-4">
            {leagueName}
          </p>
        )}

        <h1 className="font-ceremonial text-2xl font-light text-vault-text2 italic mb-3"
            style={{ letterSpacing: '0.04em' }}>
          This Clubhouse is being prepared.
        </h1>

        <p className="font-ui text-sm text-vault-text3 leading-relaxed">
          The record will open when it&apos;s ready.
        </p>
      </div>

      {/* Commissioner sign-in link */}
      <div className="mt-16">
        <a
          href="/auth/login"
          className="font-mono text-[10px] tracking-[0.12em] text-vault-text3 hover:text-vault-gold transition-colors"
        >
          Commissioner sign in
        </a>
      </div>
    </div>
  );
}
