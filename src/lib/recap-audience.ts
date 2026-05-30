// src/lib/recap-audience.ts
//
// Audience-split utility for WEEKLY_RECAP rendered content.
//
// The engine emits weekly recaps with two audience segments inside a
// single `content_markdown` string, separated by literal delimiters:
//
//   [commissioner audit trail - window timestamps, selection
//    fingerprint, event-class breakdown, full trace IDs,
//    "summary-only / no fabrication" self-declaration, bulleted
//    source events]
//   --- SHAREABLE RECAP ---
//   [league-facing prose - score callouts, bench-misplay
//    observations, FAAB pricing context, playoff-implication framing]
//   --- END SHAREABLE RECAP ---
//
// When the engine cannot honestly produce a shareable recap (silence-
// over-fabrication case, e.g. W18-2025 platform-duplicate week), it
// emits only the audit trail with its own "Creative narrative skipped"
// note, and no delimiter pair appears.
//
// This utility honors the audience split: the public archive surface
// renders only the shareable segment (or a principled silence
// acknowledgment when absent); the commissioner approve surface
// continues to render the full content unchanged.
//
// References:
//   - engine _observations/OBSERVATIONS_2026_05_28_PUBLIC_ARTIFACT_
//     AUDIENCE_SPLIT.md (recommendation: Option B)
//   - engine _observations/OBSERVATIONS_2026_05_29_FRONTEND_INCLUSIVE_
//     GAP_ANALYSIS.md section 9.1 (decision: Option B)
//   - engine _observations/OBSERVATIONS_2026_05_29_AUDIENCE_SPLIT_
//     DECISION_OPTION_B.md (closure memo with implementation pointer)

const SHAREABLE_START = "--- SHAREABLE RECAP ---";
const SHAREABLE_END = "--- END SHAREABLE RECAP ---";

/**
 * Extract the public-audience segment from a content_markdown blob.
 *
 * @param contentMarkdown - the artifact_versions.content_markdown field
 * @param artifactType - the artifacts.artifact_type discriminator
 * @returns the shareable prose for public surfaces; `null` when the
 *          engine has declared silence over fabrication for this
 *          artifact. Non-WEEKLY_RECAP types pass through unchanged.
 */
export function extractShareableSegment(
  contentMarkdown: string,
  artifactType: string,
): string | null {
  // Non-WEEKLY_RECAP types pass through. The audience-split is a
  // WEEKLY_RECAP-only construct of the engine selection layer; other
  // artifact classes (FOUNDING, A1/A2/A3, RIVALRY_CHRONICLE_V1) are
  // already curated for their audience by the engine.
  if (artifactType !== "WEEKLY_RECAP") return contentMarkdown;

  const startIdx = contentMarkdown.indexOf(SHAREABLE_START);
  if (startIdx === -1) {
    // No start delimiter - the engine emitted audit content only.
    // This is the silence-over-fabrication case; the public surface
    // must not display the audit trail. Return null so the renderer
    // can surface a principled silence acknowledgment.
    return null;
  }

  const bodyStart = startIdx + SHAREABLE_START.length;
  const endIdx = contentMarkdown.indexOf(SHAREABLE_END, bodyStart);

  if (endIdx === -1) {
    // Malformed artifact: start delimiter present but end missing.
    // Bias toward showing - the engine clearly intended a shareable
    // segment if it emitted the start delimiter. The commissioner
    // approval gate is the upstream check that should have caught
    // truncation; log and proceed.
    console.warn(
      "[recap-audience] WEEKLY_RECAP has SHAREABLE start delimiter but no end delimiter; rendering from start to EOF",
    );
    return contentMarkdown.slice(bodyStart).trim();
  }

  return contentMarkdown.slice(bodyStart, endIdx).trim();
}
