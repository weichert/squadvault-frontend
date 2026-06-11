// src/lib/av-room-limits.ts
// Single source of truth for the A/V Room upload-size ceiling. Both the client
// pre-check (ingest panel) and the server grant route import this, so they always
// report the SAME number. Dependency-free (no server/Supabase imports) so a client
// component can import it safely.
//
// Ceiling = 1 GB, matching the raised Supabase Storage per-file cap (Pro plan, set
// 2026-06-10). Under D-W1-V1 remedy B (Spec 5.1 Amendment 1) the original flows
// CLIENT-DIRECT to Storage under a server-minted grant, so this ceiling is no longer
// bounded by the serverless function's 4.5 MB body limit - the bytes never transit
// the function. See _observations/OBSERVATIONS_2026_06_10_DW1V1_RULING_REMEDY_B.md.
export const MAX_UPLOAD_BYTES = 1073741824; // 1 GiB

// Human-facing label for the ceiling, for copy ("the limit is 1 GB").
export const MAX_UPLOAD_LABEL = '1 GB';

// Human size for an arbitrary byte count: GB at/above 1 GiB, else one-decimal MB.
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
