// src/lib/chronicle.ts
//
// Presentational helpers for RIVALRY_CHRONICLE (F1) artifacts.
//
// The engine persists the two franchises and the temporal scope only inside
// the rendered content_markdown — the contract formatter emits a
// "## {team_a} vs {team_b}" header. There are no structured Supabase columns
// for them, so the archive surface derives its matchup label by parsing that
// header, falling back to a generic label for the legacy upstream-quote
// format (which has no such header).
//
// The contract-compliant output also carries a "## Trace" block (raw franchise
// IDs, canonical event fingerprints, deterministic fact-block hash). That is
// the same audit category the WEEKLY_RECAP audience-split hides from the public
// (engine _observations/OBSERVATIONS_2026_05_29_AUDIENCE_SPLIT_DECISION_
// OPTION_B.md). The public chronicle surface strips it while keeping the
// "## Disclosures" section that follows.

/**
 * Parse "Team A vs Team B" from a chronicle's content_markdown header.
 * Returns the first "## " heading that reads as a matchup, or null when no
 * contract-format header is present (e.g. the legacy upstream-quote format).
 */
export function parseRivalryTitle(contentMarkdown: string): string | null {
  for (const raw of contentMarkdown.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("## ")) continue;
    const heading = line.slice(3).trim();
    if (/\svs\s/.test(heading)) return heading;
  }
  return null;
}

/**
 * Remove the "## Trace" section (its heading through the line before the next
 * "## " heading, or end-of-document) for public rendering. The Disclosures
 * section that follows Trace is preserved. No-op when no Trace heading exists.
 */
export function stripTraceBlock(contentMarkdown: string): string {
  const lines = contentMarkdown.split("\n");
  const start = lines.findIndex((l) => l.trim() === "## Trace");
  if (start === -1) return contentMarkdown;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith("## ")) {
      end = i;
      break;
    }
  }

  const kept = [...lines.slice(0, start), ...lines.slice(end)];
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
