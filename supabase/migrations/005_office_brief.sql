-- 005_office_brief.sql
-- Office Brief storage for the Commissioner Founding Session (State 3, spec 7.2).
-- The structured brief is league-level configuration produced at the end of the
-- founding session, applied automatically at setup, and editable by the
-- commissioner. A nullable jsonb column keeps the shape flexible (schemaless)
-- without a separate table; there is exactly one brief per league.
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS office_brief jsonb;
