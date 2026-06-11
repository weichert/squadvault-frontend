// src/lib/av-room-limits.ts
// Single source of truth for the A/V Room upload-size ceiling. Both the client
// pre-check (ingest panel) and the server upload route import this, so they always
// report the SAME number - no drift between "the button refused it" and "the route
// rejected it". This module is intentionally dependency-free (no server/Supabase
// imports) so a client component can import it safely.
//
// The ceiling is Supabase Storage's global per-file cap (50 MB), which is the real
// wall the spec-5.1 passthrough hits today (a real-corpus .MOV 400'd above it).
// This constant makes that cap HONEST - pre-checked client-side, explained
// server-side; it does NOT raise it. Raising the true ceiling is decision-gate
// D-W1-V1 (founder call: raise the storage cap, or move to client-direct upload),
// not a code change here.
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Whole-MB form for the limit, for human-facing copy ("the limit is 50 MB").
export const MAX_UPLOAD_MB = Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024));

// One-decimal MB rendering of an arbitrary byte count, for "this file is 73.4 MB".
export function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
