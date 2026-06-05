// src/components/founding/founding-outputs.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { FoundingSessionState } from '@/lib/supabase/types';
import { foundingOutputStatus } from '@/lib/founding/actions';

type Phase = 'checking' | 'generating' | 'ready' | 'complete' | 'error';

// The OUTPUT_GENERATION / COMPLETE surface (spec sections 7-8). On mount it
// reconciles status: if outputs are not yet generated it triggers the generate
// route (F3-3a) behind a ceremonial loading state; once generated it surfaces
// the review link into the existing approval workflow; once the Founding
// Artifact is approved the status action transitions the session to COMPLETE
// and this shows the closing sequence.
export function FoundingOutputs({
  sessionId,
  canonicalId,
  initialState,
  initialOutputsGenerated,
}: {
  sessionId: string;
  canonicalId: string;
  initialState: FoundingSessionState;
  initialOutputsGenerated: boolean;
}) {
  void initialOutputsGenerated;
  const [phase, setPhase] = useState<Phase>(
    initialState === 'COMPLETE' ? 'complete' : 'checking',
  );
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (initialState === 'COMPLETE') return;
    void (async () => {
      try {
        let status = await foundingOutputStatus(sessionId);
        if (!status.ok) return setPhase('error');
        if (status.state === 'COMPLETE') return setPhase('complete');
        if (!status.outputsGenerated) {
          setPhase('generating');
          const res = await fetch(`/api/founding/${sessionId}/generate`, {
            method: 'POST',
          });
          if (!res.ok) return setPhase('error');
          status = await foundingOutputStatus(sessionId);
          if (!status.ok) return setPhase('error');
          if (status.state === 'COMPLETE') return setPhase('complete');
        }
        setArtifactId(status.artifactId ?? null);
        setPhase('ready');
      } catch {
        setPhase('error');
      }
    })();
  }, [sessionId, initialState]);

  const heading = (text: string) => (
    <p
      className="font-ceremonial"
      style={{ color: 'var(--vault-text)', fontSize: '1.5rem', lineHeight: 1.3 }}
    >
      {text}
    </p>
  );
  const body = (text: string) => (
    <p
      className="font-ui"
      style={{ color: 'var(--vault-text2)', fontSize: '0.95rem', lineHeight: 1.6 }}
    >
      {text}
    </p>
  );
  const linkButton = (href: string, label: string) => (
    <a
      href={href}
      className="font-ui font-medium"
      style={{
        display: 'inline-block',
        padding: '0.75rem 1.5rem',
        fontSize: '0.95rem',
        color: 'var(--vault-bg)',
        background: 'var(--vault-gold)',
        borderRadius: 4,
        textDecoration: 'none',
      }}
    >
      {label}
    </a>
  );

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 720,
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        alignItems: 'flex-start',
      }}
    >
      {(phase === 'checking' || phase === 'generating') &&
        body('Reading back everything you told us, and composing the founding record\u2026')}

      {phase === 'ready' && (
        <>
          {heading('Your founding record is ready.')}
          {body(
            'Review the League Founding Artifact before it enters the record. Your Office Brief and Voice Profile have already been applied.',
          )}
          {artifactId
            ? linkButton(
                `/league/${canonicalId}/approve/${artifactId}`,
                'Review the founding record \u2192',
              )
            : body('The record could not be located. Refresh to try again.')}
        </>
      )}

      {phase === 'complete' && (
        <>
          {heading('The founding record is set.')}
          {body(
            'The League Founding Artifact has entered the record. Your league\u2019s voice and office are configured and ready.',
          )}
          {body(
            'What happens next: invite your charter members, and their offices \u2014 founding plaque, charter seal, and an empty trophy wall \u2014 are already waiting. After your first season, the Clubhouse moves into its established rhythm.',
          )}
          {linkButton(`/league/${canonicalId}`, 'Enter the Clubhouse \u2192')}
        </>
      )}

      {phase === 'error' &&
        body(
          'Something interrupted the record. Refresh the page to pick up where you left off.',
        )}
    </div>
  );
}
