-- supabase/migrations/031_founders_seal.sql
-- Trophy #31 The Founder's Seal - the league's origin statement. ATTESTED (human testimony), never
-- CANONICAL - the founding predates the digital era and exists only by attestation (David Stuart and
-- Kent Paradis, 2026-06-21). League-level (season NULL, franchise NULL). Idempotent, scoped to league
-- 70985. Paste-safe (no in-comment semicolons). Founder hand-applies - do not auto-apply.
-- Schema notes: entry_type has a CHECK enum (extended here to register FOUNDERS_SEAL) - provenance has a
-- CHECK enum with no bare ATTESTED, so the stored value is COMMISSIONER_ATTESTED (the attested branch)
-- and the frontend renders the Seal with an explicit ATTESTED label plus the basis line.
BEGIN;

-- 1. Correct the league founding year (was 1983, the ingest generator's guess, attested 1984).
UPDATE leagues SET founding_year = 1984 WHERE canonical_id = '70985';

-- 2. Register the new FOUNDERS_SEAL entry_type (additive CHECK extension, idempotent via IF EXISTS).
ALTER TABLE trophy_room_entries DROP CONSTRAINT IF EXISTS chk_trophy_entry_type;
ALTER TABLE trophy_room_entries ADD CONSTRAINT chk_trophy_entry_type
  CHECK (entry_type IN ('CHAMPIONSHIP', 'PHYSICAL_TROPHY', 'COMMISSIONER_ATTESTED', 'SHAME_RECORD', 'FOUNDERS_SEAL'));

-- 3. Seat the Seal - idempotent (delete the league's single FOUNDERS_SEAL row, then insert one).
DELETE FROM trophy_room_entries
 WHERE league_id = (SELECT id FROM leagues WHERE canonical_id = '70985')
   AND entry_type = 'FOUNDERS_SEAL';

INSERT INTO trophy_room_entries
  (league_id, entry_type, season, franchise_id, title, description, provenance, commissioner_note, image_url)
SELECT id, 'FOUNDERS_SEAL', NULL, NULL,
  'The Founder''s Seal',
  'PFL Buddies - founded 1984. All ten of its members have stood together through every season of the digital age, and most go back decades further, to the late 1980s and early 1990s. The newest among them, Brandon Carmichael of Brandon Knows Ball, is the next generation - son of Eddie Carmichael of Eddie & the Cruisers.',
  'COMMISSIONER_ATTESTED',
  'Attested by David Stuart and Kent Paradis, 2026-06-21.',
  NULL
FROM leagues WHERE canonical_id = '70985';

COMMIT;
