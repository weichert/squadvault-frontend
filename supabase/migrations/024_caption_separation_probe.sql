-- 024_caption_separation_probe.sql
-- W.1 Increment 2 member captions (spec engine 905cb1c, sections 5.5 + 6.2; D-W1I2-4). The
-- structural proof of THE PAYLOAD: a member caption provably cannot be read as, or merged
-- into, a human-ratified provenance fact. This is the L.1 testimony_separation_probe() (021)
-- RE-POINTED at the media FACT layer - the inverse-of-G11 discipline (a MISSING object FAILS,
-- never a vacuous pass).
--
-- The W.1-specific sharp edge vs L.1 (D-W1I2-4): a caption legitimately FKs the ITEM layer
-- (media_entries) - that is the structural meaning of "caption ON this item" and is the ONLY
-- permitted FK target. The human-ratified FACT layer (media_provenance_tag_events) JOINS the
-- forbidden confrelid set, alongside the broader event ledger. So this probe makes a SHARPER
-- claim than L.1's zero-ledger-FK: allowed item-attach vs forbidden fact-write.
--
-- pg_constraint / pg_trigger (pg_catalog) are NOT reachable via PostgREST, so the governance
-- harness (G24) cannot assert "no FK/trigger into the FACT layer" directly. This SECURITY
-- DEFINER helper reads the catalog and returns BOOLEANS ONLY (no caption content). It asserts:
--   (i)   media_captions exists;
--   (ii)  media_captions.provenance is present AND NOT NULL (the non-strippable stamp);
--   (iii) NO foreign key FROM media_captions references the human-ratified FACT layer
--         (media_provenance_tag_events) OR any event-ledger table (artifacts,
--         artifact_versions, approval_events, franchise_season_records, trophy_room_entries) -
--         i.e. the ONLY permitted confrelid is media_entries (the item attach point); any FK
--         into the FACT layer or ledger fails the probe;
--   (iv)  NO user-defined (non-internal) trigger fires on media_captions (no trigger can copy
--         a remembered caption into a fact table);
--   (v)   a MISSING object -> the existence boolean is FALSE, so G24 fails closed.
CREATE OR REPLACE FUNCTION caption_separation_probe()
RETURNS TABLE (
  captions_table_exists  boolean,
  provenance_not_null    boolean,
  no_fact_layer_fk       boolean,
  no_triggers            boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT
    to_regclass('public.media_captions') IS NOT NULL,
    COALESCE((
      SELECT a.attnotnull
      FROM pg_attribute a
      WHERE a.attrelid = to_regclass('public.media_captions')
        AND a.attname = 'provenance'
        AND a.attnum > 0
        AND NOT a.attisdropped
    ), false),
    NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.conrelid = to_regclass('public.media_captions')
        AND c.confrelid IN (
          -- the human-ratified FACT layer (the W.1 sharp edge) ...
          to_regclass('public.media_provenance_tag_events'),
          -- ... and the broader event ledger.
          to_regclass('public.artifacts'),
          to_regclass('public.artifact_versions'),
          to_regclass('public.approval_events'),
          to_regclass('public.franchise_season_records'),
          to_regclass('public.trophy_room_entries')
        )
    ),
    NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid = to_regclass('public.media_captions')
        AND NOT t.tgisinternal
    );
$$;
