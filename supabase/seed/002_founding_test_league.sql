-- supabase/seed/002_founding_test_league.sql
-- Founding-state (State 3) test league for exercising the Commissioner
-- Founding Session surface (D6(c) bootstrap at /founding/[id]).
-- Staging only. NEVER apply to production.
--
-- PFL Buddies (seed 001) is an established league (status 'active'), so the
-- State 3 founding surface cannot be exercised against it. This seed provides
-- a dedicated founding-status league. To drive the session as commissioner,
-- claim it with your auth user id (find it in Supabase Auth):
--
--   UPDATE leagues SET commissioner_user_id = '<your-auth-user-id>'
--   WHERE canonical_id = 'FOUNDING-TEST';

DO $$
BEGIN
  IF current_database() LIKE '%prod%' OR current_database() LIKE '%production%' THEN
    RAISE EXCEPTION 'Refusing to seed demo data into a production database: %', current_database();
  END IF;
END
$$;

INSERT INTO leagues (
  id, canonical_id, name, founding_year, status
) VALUES (
  '00000000-0000-0000-0000-0000000000f3',
  'FOUNDING-TEST',
  'Founding Test League',
  2026,
  'founding'
) ON CONFLICT (canonical_id) DO NOTHING;
