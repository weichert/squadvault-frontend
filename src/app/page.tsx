export default function HomePage() {
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
      </div>
    </main>
  );
}
