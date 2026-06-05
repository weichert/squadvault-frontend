-- 006_oral_history_eligible.sql
-- F4-B3 / spec section 9.3. Durable, league-level State-2 (oral-history)
-- eligibility flag. Promoted from the founding session's covered_topics
-- (PRE_DIGITAL_HISTORY) at output generation so the signal survives the
-- ephemeral founding session. Consumer is the future State-2 oral-history
-- session; nothing reads it yet.
ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS oral_history_eligible boolean NOT NULL DEFAULT false;
