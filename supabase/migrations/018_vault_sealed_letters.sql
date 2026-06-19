-- 018_vault_sealed_letters.sql
-- L.3 The Vault, capture slice (D-L3-1, RATIFIED 2026-06-19; spec engine fee0725,
-- sections 5.2 + 5.3 + 6). The sealed-letter fact class + the RLS-enforced seal.
--
-- THE SEAL (founder-ratified mechanism 2026-06-19, the two-table split). The DoR is
-- explicit: "Sealed (commissioner cannot read; enforce at RLS layer)." Because RLS gates
-- ROWS not COLUMNS, the body and its metadata are split across two tables:
--
--   vault_sealed_letters        - the readable sealed-fact METADATA (existence + sealed_at
--                                 + author/franchise/season). A normal SELECT policy.
--   vault_sealed_letter_bodies  - the BODY, held where NO SELECT policy grants it to ANY
--                                 role (author, commissioner, admin) while sealed and
--                                 pre-reveal. The seal IS the absence of a read policy:
--                                 default-deny, fails closed (invariant 1).
--
-- Both append-only (no UPDATE, no DELETE policy) - the 010/015/016 idiom. A SEAL is a
-- terminal event; a correction is a NEW sealed letter, never an edit (invariant 2). The
-- reveal mechanism (a season-end successor unit) adds a gated SELECT on the bodies table;
-- it changes READABILITY, never the stored row (invariant 6). This slice builds only the
-- CLOSED state and proves it is closed (G22).

-- ── Metadata: the sealed-fact (existence + sealed_at), no body ──────────────────────────
CREATE TABLE IF NOT EXISTS vault_sealed_letters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       uuid REFERENCES leagues(id)     NOT NULL,
  member_user_id  uuid REFERENCES auth.users(id)  NOT NULL,
  franchise_id    uuid REFERENCES franchises(id)  NOT NULL,
  season          integer NOT NULL,
  sealed_at       timestamptz NOT NULL DEFAULT now(),
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vault_sealed_letters_lookup
  ON vault_sealed_letters (member_user_id, season, sealed_at DESC);

ALTER TABLE vault_sealed_letters ENABLE ROW LEVEL SECURITY;

-- SELECT: the author reads their own sealed-letter metadata (existence + sealed_at are
-- facts, invariant 3). is_admin() is operational break-glass. The COMMISSIONER is NOT
-- granted metadata read in the capture slice (narrower-by-default, W.6 append-only ethic);
-- the reveal unit adjudicates commissioner/ceremony metadata access. No other member reads
-- another's metadata or existence-count (invariant 5).
CREATE POLICY "vault_sealed_letters_select" ON vault_sealed_letters
  FOR SELECT USING (
    member_user_id = auth.uid()
    OR is_admin()
  );

-- INSERT: author-only, own league. The commissioner cannot author or proxy (invariant 4,
-- W.6 section 1.3).
CREATE POLICY "vault_sealed_letters_insert" ON vault_sealed_letters
  FOR INSERT WITH CHECK (
    member_user_id = auth.uid()
    AND league_id = get_user_league_id()
  );
-- No UPDATE and no DELETE policy: append-only by RLS default-deny.

-- ── Body: the sealed words, unreadable by every role pre-reveal ──────────────────────────
CREATE TABLE IF NOT EXISTS vault_sealed_letter_bodies (
  letter_id  uuid PRIMARY KEY REFERENCES vault_sealed_letters(id),
  body       text NOT NULL
);

ALTER TABLE vault_sealed_letter_bodies ENABLE ROW LEVEL SECURITY;

-- INSERT: only the author of the parent letter, bound by an authorship check against the
-- metadata row (which the author can see via the metadata SELECT policy). No proxy.
CREATE POLICY "vault_sealed_letter_bodies_insert" ON vault_sealed_letter_bodies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vault_sealed_letters l
      WHERE l.id = letter_id
        AND l.member_user_id = auth.uid()
    )
  );
-- THE SEAL: deliberately NO SELECT, NO UPDATE, NO DELETE policy. Default-deny means NO
-- role - author, commissioner, admin - can read, rewrite, or remove a sealed body. The
-- reveal unit (season-end) will add a reveal-gated SELECT; until then the body is closed.

-- ── G22 seal-fails-closed introspection (read-only, no body access) ──────────────────────
-- pg_policies (pg_catalog) is NOT reachable via PostgREST, so the governance harness cannot
-- assert "no read policy exists" directly. This SECURITY DEFINER helper reads the catalog
-- and returns booleans only (no letter data, no body). It exists so G22 can PROVE the seal
-- structurally and FAIL when the table or its expected governance is MISSING - the inverse
-- of the G11 false-pass (absence must deny, never read as a vacuous pass).
CREATE OR REPLACE FUNCTION vault_seal_probe()
RETURNS TABLE (
  body_table_exists       boolean,
  body_has_read_policy    boolean,
  body_has_insert_policy  boolean,
  meta_table_exists       boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT
    to_regclass('public.vault_sealed_letter_bodies') IS NOT NULL,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'vault_sealed_letter_bodies'
        AND cmd IN ('SELECT', 'ALL')
    ),
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'vault_sealed_letter_bodies'
        AND cmd = 'INSERT'
    ),
    to_regclass('public.vault_sealed_letters') IS NOT NULL;
$$;
