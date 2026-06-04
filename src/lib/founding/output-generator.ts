// src/lib/founding/output-generator.ts
//
// F3-3: runs the three founding-session output generators against the Anthropic
// API and returns their results. The prompt construction lives in generators.ts
// (F3-1b); this module is the SDK call + parse layer. Same model + envelope
// discipline as the turn engine.
//
// The two prose outputs (Founding Artifact, Voice Profile) come back as prose
// and are de-fenced/trimmed. The Office Brief comes back as JSON; it gets one
// repair retry (D8) and, on exhaustion, a safe fallback built from known facts
// rather than a crash -- silence/derivation over invention.

import Anthropic from '@anthropic-ai/sdk';
import { FOUNDING_MODEL } from '@/lib/founding/config';
import {
  buildFoundingArtifactPrompt,
  buildOfficeBriefPrompt,
  buildVoiceProfilePrompt,
  type FoundingOutputContext,
} from '@/lib/founding/generators';
import type { OfficeBrief } from '@/lib/supabase/types';

export interface FoundingOutputs {
  foundingArtifact: string;
  voiceProfile: string;
  officeBrief: OfficeBrief;
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

function stripFence(text: string): string {
  let t = text.trim();
  const fence = t.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1].trim();
  return t;
}

async function proseCall(
  anthropic: Anthropic,
  system: string,
  user: string,
): Promise<string> {
  const resp = await anthropic.messages.create({
    model: FOUNDING_MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return stripFence(extractText(resp.content));
}

function parseOfficeBrief(
  text: string,
  ctx: FoundingOutputContext,
): OfficeBrief | null {
  let obj: unknown;
  try {
    obj = JSON.parse(stripFence(text));
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;
  const theme = typeof o.theme === 'string' ? o.theme : null;
  const founding_plaque =
    typeof o.founding_plaque === 'string' ? o.founding_plaque : null;
  if (theme === null || founding_plaque === null) return null;
  const physical_artifact =
    typeof o.physical_artifact === 'string' ? o.physical_artifact : null;
  const notes = Array.isArray(o.notes)
    ? o.notes.filter((n): n is string => typeof n === 'string')
    : [];
  // voice_calibration is pinned to the session's selection regardless of what
  // the model echoed -- the selection is canonical, not the prose.
  return {
    theme,
    voice_calibration: ctx.voiceKey,
    physical_artifact,
    founding_plaque,
    notes,
  };
}

function fallbackOfficeBrief(ctx: FoundingOutputContext): OfficeBrief {
  return {
    theme: 'Founding',
    voice_calibration: ctx.voiceKey,
    physical_artifact: null,
    founding_plaque: `League established ${ctx.foundingYear}.`,
    notes: [
      'Empty trophy wall, labeled "Season 1 Pending".',
      'Charter member seal on each founding office.',
    ],
  };
}

export async function generateFoundingOutputs(
  ctx: FoundingOutputContext,
  apiKey: string,
): Promise<FoundingOutputs> {
  const anthropic = new Anthropic({ apiKey });

  const fa = buildFoundingArtifactPrompt(ctx);
  const vp = buildVoiceProfilePrompt(ctx);
  const ob = buildOfficeBriefPrompt(ctx);

  const foundingArtifact = await proseCall(anthropic, fa.system, fa.user);
  const voiceProfile = await proseCall(anthropic, vp.system, vp.user);

  const first = await anthropic.messages.create({
    model: FOUNDING_MODEL,
    max_tokens: 1024,
    system: ob.system,
    messages: [{ role: 'user', content: ob.user }],
  });
  const firstText = extractText(first.content);
  let officeBrief = parseOfficeBrief(firstText, ctx);
  if (!officeBrief) {
    const repair = await anthropic.messages.create({
      model: FOUNDING_MODEL,
      max_tokens: 1024,
      system: ob.system,
      messages: [
        { role: 'user', content: ob.user },
        { role: 'assistant', content: firstText || '{}' },
        {
          role: 'user',
          content:
            'Your previous reply was not valid JSON matching the required shape. Respond again with ONLY the JSON object and nothing else.',
        },
      ],
    });
    officeBrief = parseOfficeBrief(extractText(repair.content), ctx);
  }
  if (!officeBrief) officeBrief = fallbackOfficeBrief(ctx);

  return { foundingArtifact, voiceProfile, officeBrief };
}
