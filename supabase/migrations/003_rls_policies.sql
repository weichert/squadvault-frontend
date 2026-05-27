-- supabase/migrations/003_rls_policies.sql
-- Row Level Security — every table locked down
-- CRITICAL: verify these policies before any real league data is stored
-- NO DELETE policies exist at any role level (append-only guarantee at DB layer)

-- ── Enable RLS on all tables ────────────────────────────────────────────
ALTER TABLE leagues              ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchises           ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE docket_ids           ENABLE ROW LEVEL SECURITY;
ALTER TABLE trophy_room_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE founding_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissioner_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE friction_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;

-- ── Helper functions ────────────────────────────────────────────────────

-- Returns the league_id for the authenticated user's franchise
CREATE OR REPLACE FUNCTION get_user_league_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT f.league_id
  FROM franchises f
  WHERE f.member_user_id = auth.uid()
  LIMIT 1;
$$;

-- Returns true if the authenticated user is the commissioner of the given league
CREATE OR REPLACE FUNCTION is_commissioner(p_league_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM leagues l
    WHERE l.id = p_league_id
    AND l.commissioner_user_id = auth.uid()
  );
$$;

-- Returns true if the authenticated user has admin role in JWT app_metadata
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
$$;

-- ── leagues policies ────────────────────────────────────────────────────
CREATE POLICY "leagues_select" ON leagues
  FOR SELECT USING (
    commissioner_user_id = auth.uid()
    OR id = get_user_league_id()
    OR is_admin()
  );

CREATE POLICY "leagues_insert" ON leagues
  FOR INSERT WITH CHECK (
    commissioner_user_id = auth.uid()
    OR is_admin()
  );

CREATE POLICY "leagues_update" ON leagues
  FOR UPDATE USING (
    commissioner_user_id = auth.uid()
    OR is_admin()
  );
-- NO DELETE policy on leagues

-- ── voice_profiles policies ─────────────────────────────────────────────
CREATE POLICY "voice_profiles_select" ON voice_profiles
  FOR SELECT USING (
    is_commissioner(league_id)
    OR (league_id = get_user_league_id() AND active = true)
    OR is_admin()
  );

CREATE POLICY "voice_profiles_insert" ON voice_profiles
  FOR INSERT WITH CHECK (is_commissioner(league_id) OR is_admin());

-- ── franchises policies ─────────────────────────────────────────────────
CREATE POLICY "franchises_select" ON franchises
  FOR SELECT USING (
    league_id = get_user_league_id()
    OR is_commissioner(league_id)
    OR is_admin()
  );

CREATE POLICY "franchises_insert" ON franchises
  FOR INSERT WITH CHECK (is_commissioner(league_id) OR is_admin());

CREATE POLICY "franchises_update" ON franchises
  FOR UPDATE USING (is_commissioner(league_id) OR is_admin());

-- ── artifacts policies ──────────────────────────────────────────────────
-- GOVERNANCE: members can only see APPROVED or DISTRIBUTED artifacts
CREATE POLICY "artifacts_select" ON artifacts
  FOR SELECT USING (
    -- Members: only approved/distributed artifacts for their league
    (league_id = get_user_league_id() AND approval_state IN ('APPROVED', 'DISTRIBUTED'))
    -- Commissioner: sees all states for their league
    OR is_commissioner(league_id)
    -- Admin: sees all
    OR is_admin()
  );

CREATE POLICY "artifacts_insert" ON artifacts
  FOR INSERT WITH CHECK (is_commissioner(league_id) OR is_admin());

CREATE POLICY "artifacts_update" ON artifacts
  FOR UPDATE USING (is_commissioner(league_id) OR is_admin());
-- NO DELETE policy — artifacts are append-only

-- ── artifact_versions policies ──────────────────────────────────────────
CREATE POLICY "artifact_versions_select" ON artifact_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM artifacts a WHERE a.id = artifact_id
      AND (
        (a.league_id = get_user_league_id() AND a.approval_state IN ('APPROVED', 'DISTRIBUTED'))
        OR is_commissioner(a.league_id)
        OR is_admin()
      )
    )
  );

CREATE POLICY "artifact_versions_insert" ON artifact_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM artifacts a WHERE a.id = artifact_id
      AND (is_commissioner(a.league_id) OR is_admin())
    )
  );

-- ── approval_events policies ────────────────────────────────────────────
CREATE POLICY "approval_events_select" ON approval_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM artifacts a WHERE a.id = artifact_id
      AND (is_commissioner(a.league_id) OR is_admin())
    )
  );

CREATE POLICY "approval_events_insert" ON approval_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM artifacts a WHERE a.id = artifact_id
      AND (is_commissioner(a.league_id) OR is_admin())
    )
    -- GOVERNANCE: admin cannot insert approval_events as commissioner
    -- The actor_user_id must be the league's actual commissioner
    AND actor_user_id = auth.uid()
  );

-- ── docket_ids policies ─────────────────────────────────────────────────
CREATE POLICY "docket_ids_select" ON docket_ids
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM artifacts a WHERE a.id = artifact_id
      AND (
        (a.league_id = get_user_league_id() AND a.approval_state IN ('APPROVED', 'DISTRIBUTED'))
        OR is_commissioner(a.league_id)
        OR is_admin()
      )
    )
  );

CREATE POLICY "docket_ids_insert" ON docket_ids
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM artifacts a WHERE a.id = artifact_id
      AND (is_commissioner(a.league_id) OR is_admin())
    )
  );

-- ── trophy_room_entries policies ────────────────────────────────────────
CREATE POLICY "trophy_select" ON trophy_room_entries
  FOR SELECT USING (
    league_id = get_user_league_id()
    OR is_commissioner(league_id)
    OR is_admin()
  );

CREATE POLICY "trophy_insert" ON trophy_room_entries
  FOR INSERT WITH CHECK (is_commissioner(league_id) OR is_admin());

CREATE POLICY "trophy_update" ON trophy_room_entries
  FOR UPDATE USING (is_commissioner(league_id) OR is_admin());

-- ── founding_sessions policies ──────────────────────────────────────────
CREATE POLICY "founding_sessions_select" ON founding_sessions
  FOR SELECT USING (
    commissioner_user_id = auth.uid()
    OR is_admin()
  );

CREATE POLICY "founding_sessions_insert" ON founding_sessions
  FOR INSERT WITH CHECK (
    commissioner_user_id = auth.uid()
    OR is_admin()
  );

CREATE POLICY "founding_sessions_update" ON founding_sessions
  FOR UPDATE USING (
    commissioner_user_id = auth.uid()
    OR is_admin()
  );

-- ── commissioner_notes policies ─────────────────────────────────────────
CREATE POLICY "commissioner_notes_select" ON commissioner_notes
  FOR SELECT USING (
    league_id = get_user_league_id()
    OR is_commissioner(league_id)
    OR is_admin()
  );

CREATE POLICY "commissioner_notes_insert" ON commissioner_notes
  FOR INSERT WITH CHECK (is_commissioner(league_id) OR is_admin());
-- NO UPDATE, NO DELETE — notes are append-only and permanent

-- ── friction_log policies ───────────────────────────────────────────────
CREATE POLICY "friction_log_select" ON friction_log
  FOR SELECT USING (is_commissioner(league_id) OR is_admin());

CREATE POLICY "friction_log_insert" ON friction_log
  FOR INSERT WITH CHECK (is_commissioner(league_id) OR is_admin());

-- ── sync_log policies ───────────────────────────────────────────────────
-- Only admin and service role can read/write sync_log
CREATE POLICY "sync_log_select" ON sync_log
  FOR SELECT USING (is_admin());

CREATE POLICY "sync_log_insert" ON sync_log
  FOR INSERT WITH CHECK (true);   -- Service role inserts; Postgres bypasses RLS for service role

-- ── audit_log policies ──────────────────────────────────────────────────
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (is_admin());

CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (true);   -- Service role inserts from API routes
