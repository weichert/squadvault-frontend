-- 013_media_entries_content_hash.sql
-- W.1 R4-D3: deterministic duplicate detection. A nullable sha256 hex of the original
-- file's bytes, plus an index for the existence lookup.
--
-- CONVENIENCE, NOT PROVENANCE. content_hash is NOT a fact about the artifact and is not
-- part of the provenance record - it is purely a byte-identity convenience so the
-- commissioner can be warned "this is already in the record" before re-uploading the
-- same file. It carries no meaning a member ever sees, never gates display, and is
-- freely re-derivable from the original (regenerable, like a thumbnail). It is nullable
-- precisely because it is non-essential: older rows and any row whose hash was never
-- computed simply read NULL, and duplicate detection is best-effort, never load-bearing.
-- Zero AI, pure byte equality (sha256). Collisions are not a security boundary here;
-- a false "duplicate" is at worst an overridable warning.
--
-- No new table, no new RLS: content_hash rides media_entries' existing policies (011).
-- Nullable + IF NOT EXISTS so the column add is safe and the code degrades gracefully
-- until this is applied (the finalize insert omits it on undefined-column, the dup-check
-- and hash-backfill routes report "inactive" - the 012/G17 dashboard-apply rhythm).
ALTER TABLE media_entries
  ADD COLUMN IF NOT EXISTS content_hash text;

-- Existence lookup is always league-scoped (a duplicate only matters within a league's
-- own record), so the index leads with league_id. Partial on NOT NULL - unhashed rows
-- never need to be found by hash.
CREATE INDEX IF NOT EXISTS media_entries_content_hash_lookup
  ON media_entries (league_id, content_hash)
  WHERE content_hash IS NOT NULL;
