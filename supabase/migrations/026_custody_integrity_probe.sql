-- 026_custody_integrity_probe.sql
-- W.5 Trophy Room - Championship Package (build brief unit 2; spec section 4 + invariant C1). The
-- structural proof that the custody ledger is APPEND-ONLY and that the current holder is a DERIVED
-- read, never stored mutable state. The caption_separation_probe()/G24 and vault_seal_probe()/G22
-- sibling - the inverse-of-G11 discipline (a MISSING object FAILS, never a vacuous pass).
--
-- pg_policy / pg_attribute / pg_class (pg_catalog) are NOT reachable via PostgREST, so the governance
-- harness (G25) cannot assert "no UPDATE/DELETE policy, no holder column" directly. This SECURITY
-- DEFINER helper reads the catalog and returns BOOLEANS ONLY (no custody content). It asserts:
--   (i)   trophy_custody_events exists;
--   (ii)  RLS is enabled (append-only is meaningless without default-deny);
--   (iii) NO UPDATE policy exists (no in-place edit path - a correction is a new event);
--   (iv)  NO DELETE policy exists (no erase path - the ledger is permanent);
--   (v)   NO stored-holder / state column exists (C1: the current holder is DERIVED from the latest
--         event's to_franchise, never a mutable column - guards against a future holder/state column);
--   (vi)  a MISSING object -> the existence boolean is FALSE, so G25 fails closed.
CREATE OR REPLACE FUNCTION custody_integrity_probe()
RETURNS TABLE (
  custody_table_exists  boolean,
  rls_enabled           boolean,
  no_update_policy      boolean,
  no_delete_policy      boolean,
  no_holder_column      boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT
    to_regclass('public.trophy_custody_events') IS NOT NULL,
    COALESCE((
      SELECT c.relrowsecurity
      FROM pg_class c
      WHERE c.oid = to_regclass('public.trophy_custody_events')
    ), false),
    -- no UPDATE policy (polcmd 'w' = UPDATE, '*' = ALL covers update)
    NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = to_regclass('public.trophy_custody_events')
        AND p.polcmd IN ('w', '*')
    ),
    -- no DELETE policy (polcmd 'd' = DELETE, '*' = ALL covers delete)
    NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = to_regclass('public.trophy_custody_events')
        AND p.polcmd IN ('d', '*')
    ),
    -- no stored-holder / state column: the current holder is a DERIVED read (C1), never persisted.
    NOT EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = to_regclass('public.trophy_custody_events')
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attname IN (
          'current_holder', 'holder', 'holder_franchise', 'holder_franchise_id',
          'current_holder_franchise', 'current_holder_id', 'state', 'status'
        )
    );
$$;
