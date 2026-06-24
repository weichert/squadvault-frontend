-- supabase/proofs/champ_week_correction_and_b2_awards_probes.sql
-- Paste-ready PROBE + PROOF blocks for the combined frontend prod-apply:
--   Apply A - B2 sub-wave 1 award seed 004 (#3/#6/#7/#9 added; B1 #4/#12/#33 unchanged)
--   Apply B - championship-week record correction (migration 029, targeted FK-safe UPDATE)
-- READ-ONLY (SELECT only). Run each block in the Supabase SQL editor. Expected output is in
-- the comment under each block. League canonical_id = '70985'. Paste-safe (no in-comment semicolons).
-- Each statement is its own paste - never chain apply and proof.

-- ============================================================================
-- 0. PRE-APPLY PROBE - confirm the starting state (run BEFORE Apply A / Apply B)
-- ============================================================================

-- 0a. Current awards on prod (expected: only B1 - 3 distinct award_ids 4/12/33, 34 rows)
SELECT count(*) AS rows, count(DISTINCT award_id) AS distinct_awards,
       string_agg(DISTINCT award_id, ',' ORDER BY award_id) AS award_ids
FROM season_award_winners
WHERE league_id = (SELECT id FROM leagues WHERE canonical_id = '70985');
-- EXPECT: rows=34  distinct_awards=3  award_ids=12,33,4

-- 0b. Current holders of the three plaques that will move (derived from franchise_season_records,
--     by canonical code). Banner = best regular-season win pct that season; Sieve = most points
--     allowed that season.
WITH fsr AS (
  SELECT f.canonical_franchise_id AS code, r.season, r.wins, r.losses, r.ties, r.points_against,
         (r.wins::numeric / NULLIF(r.wins + r.losses + r.ties, 0)) AS win_pct
  FROM franchise_season_records r
  JOIN franchises f ON f.id = r.franchise_id
  WHERE r.league_id = (SELECT id FROM leagues WHERE canonical_id = '70985')
)
SELECT 'Banner 2021' AS plaque, string_agg(code, ',' ORDER BY code) AS holders
FROM fsr WHERE season = 2021 AND win_pct = (SELECT max(win_pct) FROM fsr WHERE season = 2021)
UNION ALL
SELECT 'Banner 2024', string_agg(code, ',' ORDER BY code)
FROM fsr WHERE season = 2024 AND win_pct = (SELECT max(win_pct) FROM fsr WHERE season = 2024)
UNION ALL
SELECT 'Sieve 2025', string_agg(code, ',' ORDER BY code)
FROM fsr WHERE season = 2025 AND points_against = (SELECT max(points_against) FROM fsr WHERE season = 2025);
-- EXPECT (pre-apply, the bug state): Banner 2021 = 0001,0004 | Banner 2024 = 0005,0009 | Sieve 2025 = 0005

-- ============================================================================
-- 1. APPLY A PROOF - run AFTER pasting seed 004
-- ============================================================================

-- 1a. All seven awards present with the expected row counts; B1 unchanged.
SELECT award_id, count(*) AS rows
FROM season_award_winners
WHERE league_id = (SELECT id FROM leagues WHERE canonical_id = '70985')
GROUP BY award_id ORDER BY award_id;
-- EXPECT: 12->16  3->24  33->2  4->16  6->16  7->17  9->28   (7 awards, 119 rows total)

-- 1b. B1 #4/#12/#33 rows byte-identical to before (spot-anchors unchanged).
SELECT award_id, season, value
FROM season_award_winners
WHERE league_id = (SELECT id FROM leagues WHERE canonical_id = '70985')
  AND award_id IN ('4','12','33') AND (award_id, season) IN (('4',2024),('12',2019),('33',2013))
ORDER BY award_id, season;
-- EXPECT: 4|2024|198.8   12|2019|174.5   33|2013|1.0   (unchanged B1 anchors)

-- ============================================================================
-- 2. APPLY B PROOF - run AFTER pasting migration 029
-- ============================================================================

-- 2a. The three plaques now show the CORRECTED holders (same query as 0b).
WITH fsr AS (
  SELECT f.canonical_franchise_id AS code, r.season, r.wins, r.losses, r.ties, r.points_against,
         (r.wins::numeric / NULLIF(r.wins + r.losses + r.ties, 0)) AS win_pct
  FROM franchise_season_records r
  JOIN franchises f ON f.id = r.franchise_id
  WHERE r.league_id = (SELECT id FROM leagues WHERE canonical_id = '70985')
)
SELECT 'Banner 2021' AS plaque, string_agg(code, ',' ORDER BY code) AS holders
FROM fsr WHERE season = 2021 AND win_pct = (SELECT max(win_pct) FROM fsr WHERE season = 2021)
UNION ALL
SELECT 'Banner 2024', string_agg(code, ',' ORDER BY code)
FROM fsr WHERE season = 2024 AND win_pct = (SELECT max(win_pct) FROM fsr WHERE season = 2024)
UNION ALL
SELECT 'Sieve 2025', string_agg(code, ',' ORDER BY code)
FROM fsr WHERE season = 2025 AND points_against = (SELECT max(points_against) FROM fsr WHERE season = 2025);
-- EXPECT (corrected): Banner 2021 = 0004 | Banner 2024 = 0009 | Sieve 2025 = 0009

-- 2b. The 10 corrected 2021+ cells match the engine artifact (spot-check the flip drivers).
SELECT f.canonical_franchise_id AS code, r.season, r.wins, r.losses, r.points_for, r.points_against
FROM franchise_season_records r
JOIN franchises f ON f.id = r.franchise_id
WHERE r.league_id = (SELECT id FROM leagues WHERE canonical_id = '70985')
  AND (f.canonical_franchise_id, r.season) IN
      (('0001',2021),('0005',2024),('0002',2024),('0005',2025),('0009',2023))
ORDER BY code, season;
-- EXPECT: 0001|2021|11|6|1822.85|1572.1   0002|2024|10|7|2265.4|1986.1
--         0005|2024|11|6|2066.0|1798.95   0005|2025|11|6|1988.7|1817.9   0009|2023|10|7|1990.85|1672.15

-- 2c. 2010-2020 UNTOUCHED - aggregate of pre-expansion records is unchanged by the correction.
--     (029 only writes season >= 2021; this confirms the boundary held.)
SELECT count(*) AS pre2021_rows, sum(wins) AS total_wins, round(sum(points_against)::numeric, 2) AS total_pa
FROM franchise_season_records
WHERE league_id = (SELECT id FROM leagues WHERE canonical_id = '70985') AND season <= 2020;
-- EXPECT: pre2021_rows=110  (total_wins / total_pa identical to the pre-apply values - 029 never
--         touches season <= 2020; capture these in the pre-apply probe and confirm they match)
