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

-- ============================================================================
-- 3. APPLY A - GROUP C PROOF (positional awards #13-18) - run AFTER seed 004
--    Extends section 1 to cover the six positional awards added with Group C.
-- ============================================================================

-- 3a. All six Group C awards present with the expected row counts.
SELECT award_id, count(*) AS rows
FROM season_award_winners
WHERE league_id = (SELECT id FROM leagues WHERE canonical_id = '70985')
  AND award_id IN ('13','14','15','16','17','18')
GROUP BY award_id ORDER BY award_id;
-- EXPECT: 13->16  14->16  15->16  16->16  17->17  18->16   (97 rows; #17 PK has one co-holder tie)

-- 3b. All-time leader per position (the max started-points season) lands on the known star season.
SELECT award_id, season, franchise_id, value, detail->>'player_id' AS player_id, detail->>'position' AS position
FROM season_award_winners s
WHERE league_id = (SELECT id FROM leagues WHERE canonical_id = '70985')
  AND award_id IN ('13','14','15','16','17','18')
  AND value = (SELECT max(value) FROM season_award_winners s2
               WHERE s2.league_id = s.league_id AND s2.award_id = s.award_id)
ORDER BY award_id;
-- EXPECT (award -> season, franchise, value):
--   13 The Signal Caller (QB)  -> 2011, 0009, 724.0   (Drew Brees)
--   14 The Workhorse (RB)      -> 2019, 0009, 369.1   (Christian McCaffrey)
--   15 The Deep Threat (WR)    -> 2021, 0007, 309.1   (Cooper Kupp)
--   16 The Tight Window (TE)   -> 2020, 0002, 260.3   (Travis Kelce)
--   17 The Boot (PK)           -> 2024, 0002, 194.1   (Brandon Aubrey)
--   18 The Wall (Def)          -> 2019, 0004, 171.0   (Patriots, New England)

-- 3c. The one Group C co-holder tie - #17 PK 2011, two franchises at 131.0 (distinct kickers).
SELECT season, franchise_id, value, detail->>'player_id' AS player_id
FROM season_award_winners
WHERE league_id = (SELECT id FROM leagues WHERE canonical_id = '70985')
  AND award_id = '17' AND season = 2011
ORDER BY franchise_id;
-- EXPECT: two rows - 0004 / 131.0 / 1383  and  0005 / 131.0 / 8742  (cross-franchise C6 tie; unique key holds)

-- 3d. detail shape (factual fields only - no editorializing), sampled on the QB all-time leader.
SELECT jsonb_object_keys(detail) AS detail_key
FROM season_award_winners
WHERE league_id = (SELECT id FROM leagues WHERE canonical_id = '70985')
  AND award_id = '13' AND season = 2011
ORDER BY detail_key;
-- EXPECT keys: player_id, position, started_points, weeks

-- ============================================================================
-- 4. MIGRATION 030 PROOF - W-L + points_for regular-season correction - run AFTER 030
--    030 re-points wins/losses/points_for to regular-season (exclude the championship final)
--    for all 16 seasons. Supersedes 029's W-L for 2021+ and adds the 2010-2020 finalists.
-- ============================================================================

-- 4a. Corrected W-L + PF anchors (the finalists' title game no longer counts).
SELECT f.canonical_franchise_id AS code, r.season, r.wins, r.losses, r.points_for, r.result
FROM franchise_season_records r
JOIN franchises f ON f.id = r.franchise_id
WHERE r.league_id = (SELECT id FROM leagues WHERE canonical_id = '70985')
  AND (f.canonical_franchise_id, r.season) IN (('0005',2024),('0001',2021),('0004',2015))
ORDER BY code, season;
-- EXPECT: 0004|2015|12|3|1590.5|CHAMPION   0001|2021|10|6|1690.1|CHAMPION   0005|2024|10|6|1917.1|CHAMPION
--         (each was champion - the title win + its points are now excluded - 11-6 -> 10-6, 13-3 -> 12-3)

-- 4b. The Engine (#11, most points in a season) - the 6 PF-driven flips land on the corrected leader.
WITH e AS (
  SELECT r.season, f.canonical_franchise_id AS code, r.points_for,
         max(r.points_for) OVER (PARTITION BY r.season) AS season_max
  FROM franchise_season_records r JOIN franchises f ON f.id = r.franchise_id
  WHERE r.league_id = (SELECT id FROM leagues WHERE canonical_id = '70985'))
SELECT season, string_agg(code, ',' ORDER BY code) AS engine_holder, round(season_max,2) AS pf
FROM e WHERE points_for = season_max AND season IN (2010,2015,2016,2019,2020,2023)
GROUP BY season, season_max ORDER BY season;
-- EXPECT: 2010->0002 (1682.5)  2015->0009 (1691.0)  2016->0002 (1585.0)
--         2019->0009 (1719.1)  2020->0001 (1782.25) 2023->0006 (1924.85)

-- 4c. The Banner (#10, best regular-season win pct) - the 2 W-L-driven ties.
WITH b AS (
  SELECT r.season, f.canonical_franchise_id AS code,
         (r.wins::numeric / NULLIF(r.wins+r.losses+r.ties,0)) AS wp,
         max(r.wins::numeric / NULLIF(r.wins+r.losses+r.ties,0)) OVER (PARTITION BY r.season) AS season_max
  FROM franchise_season_records r JOIN franchises f ON f.id = r.franchise_id
  WHERE r.league_id = (SELECT id FROM leagues WHERE canonical_id = '70985'))
SELECT season, string_agg(code, ',' ORDER BY code) AS banner_holders
FROM b WHERE wp = season_max AND season IN (2016,2019)
GROUP BY season ORDER BY season;
-- EXPECT: 2016->0006,0010  2019->0002,0005  (champion's title win removed -> a second team ties)

-- 4d. The Climb (#8, biggest year-over-year win-pct gain) - a DERIVED read of the corrected W-L
--      (no stored column), so it is asserted directly from franchise_season_records. This is the
--      kind of second-order read that slipped past the engine-side preview, so it is a standing check.
WITH wp AS (
  SELECT f.canonical_franchise_id AS code, r.season,
         (r.wins::numeric / NULLIF(r.wins + r.losses + r.ties, 0)) AS pct
  FROM franchise_season_records r
  JOIN franchises f ON f.id = r.franchise_id
  WHERE r.league_id = (SELECT id FROM leagues WHERE canonical_id = '70985')),
gain AS (
  SELECT c.season, c.code, c.pct - p.pct AS delta
  FROM wp c JOIN wp p ON p.code = c.code AND p.season = c.season - 1)
SELECT season, string_agg(code, ',' ORDER BY code) AS climb_holder
FROM gain g
WHERE season IN (2012, 2015)
  AND delta = (SELECT max(delta) FROM gain g2 WHERE g2.season = g.season)
GROUP BY season ORDER BY season;
-- EXPECT: 2012 -> 0008  2015 -> 0005  (verified live on prod 2026-06-24)
