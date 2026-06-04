// src/lib/founding/config.ts
//
// Founding session runtime config.

// Model string pinned here (D1) — swap in one place. Confirm this model is
// enabled on the frontend's ANTHROPIC_API_KEY.
export const FOUNDING_MODEL = 'claude-sonnet-4-6';

// Safety valve against a runaway / cost loop. NOT a pacing mechanism — pacing
// is the agent's job (spec 1.3 / 5.3). Generous; a normal session is well under
// this many exchanges.
export const MAX_EXCHANGES = 80;
