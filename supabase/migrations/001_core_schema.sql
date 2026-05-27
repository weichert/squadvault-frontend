-- supabase/migrations/001_core_schema.sql
-- SquadVault complete schema — Milestone 1
-- Apply via: supabase db push

-- ── Extensions ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── leagues ────────────────────────────────────────────────────────────
CREATE TABLE leagues (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id                text UNIQUE NOT NULL,        -- MFL league ID, e.g. 70985
  name                        text NOT NULL,
  founding_year               integer NOT NULL,
  commissioner_user_id        uuid REFERENCES auth.users(id),
  voice_profile_id            uuid,                        -- FK added after voice_profiles
  status                      text NOT NULL DEFAULT 'founding',
  seal_svg_url                text,                        -- Supabase Storage signed URL
  seal_png_url                text,                        -- Supabase Storage signed URL
  first_approval_completed    boolean NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- ── voice_profiles ─────────────────────────────────────────────────────
CREATE TABLE voice_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id           uuid REFERENCES leagues(id) NOT NULL,
  version             integer NOT NULL DEFAULT 1,
  profile_key         text NOT NULL,
  prose               text NOT NULL,
  authored_by         text NOT NULL DEFAULT 'commissioner',
  governance_memo_ref text,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Add FK from leagues to voice_profiles (deferred to avoid circular dependency)
ALTER TABLE leagues ADD CONSTRAINT fk_leagues_voice_profile
  FOREIGN KEY (voice_profile_id) REFERENCES voice_profiles(id);

-- ── franchises ─────────────────────────────────────────────────────────
CREATE TABLE franchises (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id               uuid REFERENCES leagues(id) NOT NULL,
  canonical_franchise_id  text NOT NULL,
  owner_display_name      text NOT NULL,
  member_user_id          uuid REFERENCES auth.users(id),
  is_commissioner         boolean NOT NULL DEFAULT false,
  charter_member          boolean NOT NULL DEFAULT false,
  seasons_active          integer[] NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ── artifacts ──────────────────────────────────────────────────────────
CREATE TABLE artifacts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id             uuid REFERENCES leagues(id) NOT NULL,
  artifact_type         text NOT NULL,
  artifact_class        text NOT NULL,
  season                integer,
  week_index            integer,
  engine_artifact_id    text,
  engine_source_hash    text,         -- SHA-256 of engine artifact content
  approval_state        text NOT NULL DEFAULT 'DRAFT',
  current_version       integer NOT NULL DEFAULT 1,
  is_demo               boolean NOT NULL DEFAULT false,
  docket_id             text UNIQUE,
  -- Trust bar text is stored on the artifact; rendering reads from this field
  trust_bar_text        text NOT NULL DEFAULT 'Entered into the Record | Source Facts Verified | SquadVault',
  approved_by_user_id   uuid REFERENCES auth.users(id),
  approved_at           timestamptz,
  distributed_at        timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── artifact_versions ──────────────────────────────────────────────────
CREATE TABLE artifact_versions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id             uuid REFERENCES artifacts(id) NOT NULL,
  version                 integer NOT NULL,
  content_markdown        text NOT NULL,
  facts_json              jsonb,
  generated_by            text NOT NULL DEFAULT 'engine',
  changes_requested_note  text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ── approval_events ────────────────────────────────────────────────────
-- Append-only event log — every state transition recorded
CREATE TABLE approval_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id     uuid REFERENCES artifacts(id) NOT NULL,
  from_state      text NOT NULL,
  to_state        text NOT NULL,
  actor_user_id   uuid REFERENCES auth.users(id) NOT NULL,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── docket_ids ─────────────────────────────────────────────────────────
CREATE TABLE docket_ids (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id     uuid REFERENCES artifacts(id) UNIQUE NOT NULL,
  docket_value    text UNIQUE NOT NULL,
  year            integer NOT NULL,
  sequence_number integer NOT NULL,
  is_demo         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── trophy_room_entries ────────────────────────────────────────────────
CREATE TABLE trophy_room_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id         uuid REFERENCES leagues(id) NOT NULL,
  entry_type        text NOT NULL,
  season            integer,
  franchise_id      uuid REFERENCES franchises(id),
  title             text NOT NULL,
  description       text,
  provenance        text NOT NULL,
  image_url         text,
  commissioner_note text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── founding_sessions ─────────────────────────────────────────────────
CREATE TABLE founding_sessions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id               uuid REFERENCES leagues(id) NOT NULL,
  commissioner_user_id    uuid REFERENCES auth.users(id) NOT NULL,
  state                   text NOT NULL DEFAULT 'IN_PROGRESS',
  exchanges               jsonb NOT NULL DEFAULT '[]',
  covered_topics          text[] NOT NULL DEFAULT '{}',
  pending_required_topics text[] NOT NULL DEFAULT '{}',
  consent                 jsonb NOT NULL DEFAULT '{}',
  voice_profile_selection text,
  total_tokens_used       integer NOT NULL DEFAULT 0,
  outputs_generated       boolean NOT NULL DEFAULT false,
  outputs_approved        boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ── commissioner_notes ────────────────────────────────────────────────
-- Append-only; commissioners annotate the permanent record
CREATE TABLE commissioner_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id uuid REFERENCES artifacts(id) NOT NULL,
  league_id   uuid REFERENCES leagues(id) NOT NULL,
  content     text NOT NULL,
  authored_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── friction_log ──────────────────────────────────────────────────────
CREATE TABLE friction_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id         uuid REFERENCES leagues(id),
  artifact_id       uuid REFERENCES artifacts(id),
  stage             text NOT NULL,
  friction_type     text NOT NULL,
  severity          text NOT NULL DEFAULT 'low',
  description       text NOT NULL,
  next_action       text,
  logged_by_user_id uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── sync_log ──────────────────────────────────────────────────────────
-- Audit trail for every sync_to_supabase.py run
CREATE TABLE sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_git_hash text,
  tables_synced   jsonb NOT NULL DEFAULT '{}',
  row_counts      jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'success',
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── audit_log ─────────────────────────────────────────────────────────
-- Security-relevant operations only
-- IP/user-agent stored as hashes — never raw PII
CREATE TABLE audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       uuid REFERENCES leagues(id),
  actor_user_id   uuid REFERENCES auth.users(id),
  action          text NOT NULL,
  resource_type   text,
  resource_id     uuid,
  ip_address_hash text,   -- SHA-256 of IP, never raw
  user_agent_hash text,   -- SHA-256 of user agent, never raw
  created_at      timestamptz NOT NULL DEFAULT now()
);
