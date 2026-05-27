-- supabase/migrations/002_constraints_and_triggers.sql
-- UNIQUE constraints, CHECK constraints, and the approval state-transition trigger
-- SECURITY: approval state machine is enforced at the DB layer — not just application code

-- ── UNIQUE constraints ─────────────────────────────────────────────────
ALTER TABLE franchises ADD CONSTRAINT uq_franchises_league_canonical
  UNIQUE (league_id, canonical_franchise_id);

ALTER TABLE artifact_versions ADD CONSTRAINT uq_artifact_versions_artifact_version
  UNIQUE (artifact_id, version);

ALTER TABLE voice_profiles ADD CONSTRAINT uq_voice_profiles_league_version
  UNIQUE (league_id, version);

-- ── CHECK constraints (enum enforcement at DB layer) ───────────────────
ALTER TABLE artifacts ADD CONSTRAINT chk_artifacts_approval_state
  CHECK (approval_state IN (
    'DRAFT', 'UNDER_REVIEW', 'CHANGES_REQUESTED',
    'APPROVED', 'WITHHELD', 'DISTRIBUTED'
  ));

ALTER TABLE artifacts ADD CONSTRAINT chk_artifacts_artifact_type
  CHECK (artifact_type IN (
    'WEEKLY_RECAP', 'FOUNDING', 'TROPHY_CARD',
    'RIVALRY_CHRONICLE', 'SEASON_RETROSPECTIVE'
  ));

ALTER TABLE artifacts ADD CONSTRAINT chk_artifacts_artifact_class
  CHECK (artifact_class IN ('E1', 'E2', 'A1', 'A2', 'A3', 'F1', 'FOUNDING'));

ALTER TABLE trophy_room_entries ADD CONSTRAINT chk_trophy_provenance
  CHECK (provenance IN ('CANONICAL', 'COMMISSIONER_ATTESTED', 'DEMO'));

ALTER TABLE trophy_room_entries ADD CONSTRAINT chk_trophy_entry_type
  CHECK (entry_type IN (
    'CHAMPIONSHIP', 'PHYSICAL_TROPHY', 'COMMISSIONER_ATTESTED', 'SHAME_RECORD'
  ));

ALTER TABLE friction_log ADD CONSTRAINT chk_friction_severity
  CHECK (severity IN ('low', 'medium', 'high'));

ALTER TABLE friction_log ADD CONSTRAINT chk_friction_stage
  CHECK (stage IN (
    'intake', 'founding', 'record_entry',
    'approval', 'distribution', 'reception'
  ));

ALTER TABLE leagues ADD CONSTRAINT chk_leagues_status
  CHECK (status IN ('founding', 'active', 'archived'));

ALTER TABLE voice_profiles ADD CONSTRAINT chk_voice_profile_key
  CHECK (profile_key IN (
    'BALL_BUSTING_FRIENDS', 'COMPETITIVE_SERIOUS',
    'NOSTALGIC_HISTORIANS', 'CASUAL_SOCIAL', 'MIXED'
  ));

ALTER TABLE founding_sessions ADD CONSTRAINT chk_founding_session_state
  CHECK (state IN (
    'IN_PROGRESS', 'CONSENT_COLLECTION', 'OUTPUT_GENERATION', 'COMPLETE'
  ));

-- ── Approval State-Transition Trigger ──────────────────────────────────
-- Enforces the legal state machine at the Postgres layer.
-- Application code is a second check — this is the first and binding check.
--
-- Legal transitions:
--   DRAFT              → UNDER_REVIEW
--   UNDER_REVIEW       → CHANGES_REQUESTED
--   UNDER_REVIEW       → APPROVED
--   UNDER_REVIEW       → WITHHELD
--   CHANGES_REQUESTED  → UNDER_REVIEW        (re-review after regeneration)
--   APPROVED           → DISTRIBUTED
--   APPROVED           → WITHHELD            (commissioner reversal before distribution)
--   All other transitions: REJECTED

CREATE OR REPLACE FUNCTION enforce_approval_state_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions TEXT[][] := ARRAY[
    ARRAY['DRAFT',             'UNDER_REVIEW'],
    ARRAY['UNDER_REVIEW',      'CHANGES_REQUESTED'],
    ARRAY['UNDER_REVIEW',      'APPROVED'],
    ARRAY['UNDER_REVIEW',      'WITHHELD'],
    ARRAY['CHANGES_REQUESTED', 'UNDER_REVIEW'],
    ARRAY['APPROVED',          'DISTRIBUTED'],
    ARRAY['APPROVED',          'WITHHELD']
  ];
  pair TEXT[];
BEGIN
  -- No-op: same state (e.g. updating other fields)
  IF OLD.approval_state = NEW.approval_state THEN
    RETURN NEW;
  END IF;

  -- Check if transition is in the legal set
  FOREACH pair SLICE 1 IN ARRAY valid_transitions LOOP
    IF pair[1] = OLD.approval_state AND pair[2] = NEW.approval_state THEN
      RETURN NEW;
    END IF;
  END LOOP;

  RAISE EXCEPTION
    'Invalid approval state transition on artifact %: % -> %. '
    'Legal transitions from %: see 002_constraints_and_triggers.sql',
    OLD.id, OLD.approval_state, NEW.approval_state, OLD.approval_state;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_approval_state_transition
  BEFORE UPDATE OF approval_state ON artifacts
  FOR EACH ROW
  EXECUTE FUNCTION enforce_approval_state_transition();

-- ── Auto updated_at triggers ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leagues_updated_at
  BEFORE UPDATE ON leagues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_artifacts_updated_at
  BEFORE UPDATE ON artifacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_founding_sessions_updated_at
  BEFORE UPDATE ON founding_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Trust bar text sync trigger ────────────────────────────────────────
-- When is_demo changes (should never happen post-creation, but defensive),
-- or when a docket_id is assigned, keep trust_bar_text consistent.
-- is_demo immutability is enforced by RLS (no UPDATE on is_demo column).
