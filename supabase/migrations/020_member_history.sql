-- 020_member_history.sql
-- L.1 Historian Interviews, capture-only first wave (S5, RATIFIED 2026-06-19; spec engine
-- c9d32d5, sections 5.2 + 6). The oral-history testimony fact class: a two-table append-only
-- split that reuses the founding-session LOGIC but diverges on PERSISTENCE - every turn is an
-- INSERTed row, never an in-place jsonb UPDATE. This is the only shape that satisfies the
-- ratified append-only mandate at the ROW level (stronger than the founding session's mutable
-- exchanges array).
--
--   member_history_sessions   - the interview METADATA (existence + who/when), INSERT-once.
--                               Member-identity-keyed via the franchises.member_user_id
--                               pointer (maintained from franchise_member_links, migration
--                               016) - NOT a flat franchise_id (the slot-0010 multi-owner
--                               hazard). franchise_id is recorded era-correct at capture.
--   member_history_exchanges  - the append-only CHILD, one row per turn (HISTORIAN question
--                               or MEMBER answer). Each row carries the S1 provenance stamp.
--
-- THE PAYLOAD (spec 6.2): testimony is a fact-ABOUT-WHAT-WAS-SAID; it NEVER contaminates the
-- canonical events ledger. That separation is proven STRUCTURALLY by migration 021's
-- testimony_separation_probe() (G23) - these tables carry no FK, trigger, or write path to any
-- fact/event-bearing table. A remembered account provably cannot be read as, or merged into,
-- an event fact.
--
-- Append-only at every surface (invariant 6.1): BOTH tables have no UPDATE policy and no
-- DELETE policy (RLS default-deny - the 010/016/018 idiom). A correction is a NEW exchange,
-- never an edit. Member-only authorship (invariant 6.5): the commissioner cannot proxy a
-- session, a consent, or an exchange. SELECT is author + admin only - NO commissioner read in
-- the capture slice (invariant per spec 7: testimony is display-DEFERRED, not sealed; the
-- display successor unit adjudicates commissioner/rendering access).

-- == Metadata: the interview session (insert-once), member-identity-keyed ==================
CREATE TABLE IF NOT EXISTS member_history_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       uuid REFERENCES leagues(id)     NOT NULL,
  member_user_id  uuid REFERENCES auth.users(id)  NOT NULL,
  franchise_id    uuid REFERENCES franchises(id)  NOT NULL,
  -- The interview is capture-only: no output generation, no COMPLETE-with-outputs state
  -- (spec 5.7). state exists for the metadata record; this slice sets it once at INSERT and
  -- never transitions it (there is no UPDATE policy - ending the interview is the member
  -- stopping; the captured exchanges ARE the durable record). ENDED is reserved for a future
  -- append-only successor, not written here.
  state           text NOT NULL DEFAULT 'IN_PROGRESS' CHECK (state IN ('IN_PROGRESS', 'ENDED')),
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_history_sessions_lookup
  ON member_history_sessions (member_user_id, recorded_at DESC);

ALTER TABLE member_history_sessions ENABLE ROW LEVEL SECURITY;

-- SELECT: the author reads their own interview metadata; is_admin() is operational
-- break-glass. NO commissioner read this slice (narrower-by-default; display-deferred).
CREATE POLICY "member_history_sessions_select" ON member_history_sessions
  FOR SELECT USING (
    member_user_id = auth.uid()
    OR is_admin()
  );

-- INSERT: member-only, own league, own franchise. member_user_id is the authenticated
-- PERSON; league_id must be the member's league; franchise_id must be the member's own
-- franchise (the franchises.member_user_id pointer = the franchise_member_links identity
-- key). The commissioner cannot author or proxy (invariant 6.5, W.6 1.3).
CREATE POLICY "member_history_sessions_insert" ON member_history_sessions
  FOR INSERT WITH CHECK (
    member_user_id = auth.uid()
    AND league_id = get_user_league_id()
    AND EXISTS (
      SELECT 1 FROM franchises f
      WHERE f.id = franchise_id
        AND f.member_user_id = auth.uid()
        AND f.league_id = member_history_sessions.league_id
    )
  );
-- No UPDATE and no DELETE policy: append-only by RLS default-deny.

-- == Append-only child: one row per turn, provenance-stamped ===============================
CREATE TABLE IF NOT EXISTS member_history_exchanges (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid REFERENCES member_history_sessions(id) NOT NULL,
  turn               integer NOT NULL,
  speaker            text NOT NULL CHECK (speaker IN ('HISTORIAN', 'MEMBER')),
  content            text NOT NULL,
  intent_classified  text,
  topic_covered      text,
  -- S1 provenance stamp: a non-strippable discriminator (fixed value) marking every row as
  -- belonging to the oral-history TESTIMONY layer - the thing that makes what-was-said
  -- structurally distinct from an event fact (spec 5.4). NOT NULL + a fixed-value CHECK make
  -- it non-omittable and non-spoofable. The binding triple is completed by session_id (FK to
  -- the member-keyed session) and recorded_at. Visible to every consumer, including the G23
  -- verifier.
  provenance         text NOT NULL DEFAULT 'MEMBER_TESTIMONY'
                       CHECK (provenance = 'MEMBER_TESTIMONY'),
  recorded_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_history_exchanges_session
  ON member_history_exchanges (session_id, turn);

ALTER TABLE member_history_exchanges ENABLE ROW LEVEL SECURITY;

-- SELECT: the author of the parent session reads their own exchanges; is_admin() break-glass.
-- NO commissioner read this slice (display-deferred).
CREATE POLICY "member_history_exchanges_select" ON member_history_exchanges
  FOR SELECT USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM member_history_sessions s
      WHERE s.id = member_history_exchanges.session_id
        AND s.member_user_id = auth.uid()
    )
  );

-- INSERT: only the author of the parent session may append a turn (HISTORIAN or MEMBER). The
-- member's authenticated request records both the historian's question and their own answer;
-- the commissioner cannot proxy (invariant 6.5).
CREATE POLICY "member_history_exchanges_insert" ON member_history_exchanges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM member_history_sessions s
      WHERE s.id = member_history_exchanges.session_id
        AND s.member_user_id = auth.uid()
    )
  );
-- No UPDATE and no DELETE policy: append-only by RLS default-deny. A correction is a new
-- exchange, never an edit (invariant 6.1).
