-- supabase/migrations/010_member_consent_events.sql
-- W.6 Consent Governance Memo v1.2 (RATIFIED 2026-06-10) — the consent system
-- of record. See engine docs/SquadVault_W6_Consent_Governance_Memo_v1_2.md.
--
-- D-V: a NEW append-only event class. Current consent state is a DERIVED read
-- over this log (view below), never stored mutable state (W.6 section 1.1).
-- This SUPERSEDES founding_sessions.consent as the per-member source of truth;
-- that field is reinterpreted as the league-defaults layer (D-X) and is NOT
-- touched by this migration.
--
-- D-S: five independent categories, no bundles; synthesized_voice is scoped
-- per rendering_class. D-T: one event per (member, category[, class]); current
-- state = latest event. D-W: grants are member-level; item-level acts READ them.
--
-- Append-only via RLS default-deny: SELECT + INSERT policies only, NO UPDATE and
-- NO DELETE policy (matching the approval_events sibling). The subject is the
-- PERSON (auth.users), not the franchise (W.6 section 1.2).

CREATE TABLE IF NOT EXISTS member_consent_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_user_id  uuid REFERENCES auth.users(id) NOT NULL,
  league_id       uuid REFERENCES leagues(id)    NOT NULL,
  event_type      text NOT NULL CHECK (event_type IN ('GRANT', 'REVOKE')),
  category        text NOT NULL CHECK (category IN (
                    'media_appearance',
                    'recorded_voice',
                    'likeness_derived',
                    'attributed_quotes',
                    'synthesized_voice'
                  )),
  -- 2e (synthesized_voice) is scoped per rendering class; all other categories
  -- carry no class. Enforced as a biconditional so neither half can drift.
  rendering_class text,
  context         text NOT NULL,
  note            text,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_consent_events_class_iff_synth
    CHECK ((category = 'synthesized_voice') = (rendering_class IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS member_consent_events_lookup
  ON member_consent_events (member_user_id, category, recorded_at DESC);

ALTER TABLE member_consent_events ENABLE ROW LEVEL SECURITY;

-- SELECT: the member themselves, the commissioner of the event's league, or admin.
CREATE POLICY "member_consent_events_select" ON member_consent_events
  FOR SELECT USING (
    member_user_id = auth.uid()
    OR is_commissioner(league_id)
    OR is_admin()
  );

-- INSERT: MEMBER ONLY. Deliberately NO is_commissioner()/is_admin() here —
-- W.6 section 1.3: the commissioner cannot proxy a grant for another member,
-- "not during onboarding, not for the deceased, not to get the feature working."
-- Only the member's own auth.uid() may author GRANT and REVOKE events.
CREATE POLICY "member_consent_events_insert" ON member_consent_events
  FOR INSERT WITH CHECK (member_user_id = auth.uid());

-- No UPDATE policy and no DELETE policy: append-only via RLS default-deny
-- (the repo's no-rewrite mechanism — W.6 Appendix A). A correction is a new
-- REVOKE/GRANT event, never an edit.

-- Derived current state (W.6 section 1.1): latest event per
-- (member, category, rendering_class). A current GRANT exists iff a row here
-- has current_state = 'GRANT'. ABSENCE of a row = ungranted (default-posture
-- law, W.6 section 1.4) — consumers MUST treat missing as no-grant.
-- security_invoker so the base-table RLS applies to the querying member /
-- commissioner (Postgres 15+; Supabase). If on PG < 15, replace with a
-- SECURITY INVOKER function so one member's state cannot leak to another.
CREATE OR REPLACE VIEW member_consent_current
  WITH (security_invoker = true) AS
SELECT DISTINCT ON (member_user_id, category, COALESCE(rendering_class, ''))
  member_user_id,
  league_id,
  category,
  rendering_class,
  event_type AS current_state,
  recorded_at
FROM member_consent_events
ORDER BY member_user_id, category, COALESCE(rendering_class, ''), recorded_at DESC;
