-- Migration 004: add commissioner_email to leagues
-- Used during magic-link callback to claim commissioner_user_id
-- without requiring the commissioner to already exist in auth.users.

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS commissioner_email text;

-- Index for the callback lookup (email -> unclaimed league)
CREATE INDEX IF NOT EXISTS leagues_commissioner_email_idx
  ON leagues (commissioner_email)
  WHERE commissioner_user_id IS NULL;

COMMENT ON COLUMN leagues.commissioner_email IS
  ''Expected commissioner email. Set at league creation. Used during
    first magic-link sign-in to claim commissioner_user_id.'';
