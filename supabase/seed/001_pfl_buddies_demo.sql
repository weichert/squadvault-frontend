-- supabase/seed/001_pfl_buddies_demo.sql
-- PFL Buddies demo data for staging environment
-- ALL RECORDS MARKED is_demo = true
-- NEVER apply to production database

-- ── Safety check ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF current_database() LIKE '%prod%' OR current_database() LIKE '%production%' THEN
    RAISE EXCEPTION 'Refusing to seed demo data into a production database: %', current_database();
  END IF;
END
$$;

-- ── Demo league ────────────────────────────────────────────────────────
INSERT INTO leagues (
  id, canonical_id, name, founding_year, status
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '70985',
  'PFL Buddies',
  1983,
  'active'
) ON CONFLICT (canonical_id) DO NOTHING;

-- ── Demo voice profile ─────────────────────────────────────────────────
INSERT INTO voice_profiles (
  id, league_id, version, profile_key, prose, active
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  1,
  'BALL_BUSTING_FRIENDS',
  'This league is written in the register of affectionate brutality — sharp enough to sting, grounded enough that everyone knows it comes from love. Competition is real but secondary to the relationship; the game is the excuse. Avoid earnestness that doesn''t earn itself, and avoid irony that punches down.',
  true
) ON CONFLICT (league_id, version) DO NOTHING;

-- Update league with voice profile FK
UPDATE leagues
SET voice_profile_id = '00000000-0000-0000-0000-000000000010'
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND voice_profile_id IS NULL;

-- ── Demo franchises (10) ───────────────────────────────────────────────
INSERT INTO franchises (id, league_id, canonical_franchise_id, owner_display_name, charter_member)
VALUES
  ('00000000-0000-0001-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'F01', 'Paradis'' Playmakers', true),
  ('00000000-0000-0001-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'F02', 'Brandon Knows Ball',  true),
  ('00000000-0000-0001-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'F03', 'Miller Time',          true),
  ('00000000-0000-0001-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'F04', 'Weichert FC',          true),
  ('00000000-0000-0001-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'F05', 'Pat''s Punters',       true),
  ('00000000-0000-0001-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'F06', 'Eddie''s Elites',      true),
  ('00000000-0000-0001-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'F07', 'Stu''s Studs',         true),
  ('00000000-0000-0001-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'F08', 'Nocero''s Nitros',     true),
  ('00000000-0000-0001-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'F09', 'Ben''s Bunch',         true),
  ('00000000-0000-0001-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'F10', 'Cavallini Classic',    true)
ON CONFLICT (league_id, canonical_franchise_id) DO NOTHING;

-- ── Demo artifact (approved weekly recap) ──────────────────────────────
INSERT INTO artifacts (
  id, league_id, artifact_type, artifact_class,
  season, week_index, approval_state, is_demo,
  trust_bar_text, docket_id, approved_at
) VALUES (
  '00000000-0000-0002-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'WEEKLY_RECAP',
  'E1',
  2025,
  7,
  'APPROVED',
  true,
  'Demo Artifact | Example Record | SquadVault',
  'DEMO-2025-001',
  now() - interval '2 days'
) ON CONFLICT (id) DO NOTHING;

-- ── Demo artifact version ──────────────────────────────────────────────
INSERT INTO artifact_versions (artifact_id, version, content_markdown, generated_by)
VALUES (
  '00000000-0000-0002-0000-000000000001',
  1,
  E'# Week 7, 2025\n\nParadis'' Playmakers extended their winning streak to four with a commanding 131\u201394 win over Brandon Knows Ball, whose six-game losing streak is now the longest active run of futility in the league. The group chat, predictably, was merciless.\n\nMiller Time moved quietly to 5\u20132. Nobody is talking about Miller. That is how Miller prefers it.\n\nStu''s Studs climbed back to .500 after a strong week from their receiver corps. Stu has been here before. It did not end well last time.',
  'engine'
) ON CONFLICT (artifact_id, version) DO NOTHING;

-- ── Demo docket ID ─────────────────────────────────────────────────────
INSERT INTO docket_ids (artifact_id, docket_value, year, sequence_number, is_demo)
VALUES (
  '00000000-0000-0002-0000-000000000001',
  'DEMO-2025-001',
  2025,
  1,
  true
) ON CONFLICT (artifact_id) DO NOTHING;

-- ── Demo trophy room entries (select championships) ────────────────────
INSERT INTO trophy_room_entries (league_id, entry_type, season, franchise_id, title, provenance)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'CHAMPIONSHIP', 2024, '00000000-0000-0001-0000-000000000001', 'KP''s Fourth Ring — 2024 PFL Buddies Champion', 'CANONICAL'),
  ('00000000-0000-0000-0000-000000000001', 'CHAMPIONSHIP', 2025, '00000000-0000-0001-0000-000000000007', 'Stu''s Studs — Most Improbable Run in League History', 'CANONICAL'),
  ('00000000-0000-0000-0000-000000000001', 'CHAMPIONSHIP', 2019, '00000000-0000-0001-0000-000000000001', 'Barkley at $76 — The Record Bid — 2019 Champion', 'CANONICAL')
ON CONFLICT DO NOTHING;

-- ── Verify seed completed ──────────────────────────────────────────────
DO $$
DECLARE
  league_count    integer;
  franchise_count integer;
  artifact_count  integer;
BEGIN
  SELECT COUNT(*) INTO league_count    FROM leagues    WHERE canonical_id = '70985';
  SELECT COUNT(*) INTO franchise_count FROM franchises WHERE league_id = '00000000-0000-0000-0000-000000000001';
  SELECT COUNT(*) INTO artifact_count  FROM artifacts  WHERE league_id = '00000000-0000-0000-0000-000000000001';

  RAISE NOTICE 'Seed complete: % league, % franchises, % artifacts',
    league_count, franchise_count, artifact_count;

  IF league_count = 0 THEN
    RAISE EXCEPTION 'Seed failed: no league record found';
  END IF;
  IF franchise_count != 10 THEN
    RAISE EXCEPTION 'Seed failed: expected 10 franchises, got %', franchise_count;
  END IF;
END
$$;
