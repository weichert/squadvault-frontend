-- 017_sealed_testimony_consent.sql
-- L.3 The Vault, capture slice (D-L3-4, RATIFIED 2026-06-19; spec engine fee0725,
-- sections 5.1 + 3.3). Adds the `sealed_testimony` consent category to the W.6 consent
-- system of record (member_consent_events, migration 010). Consent-at-writing for a
-- sealed letter: member-authored only, append-only, revocable-forward (a REVOKE before
-- reveal withholds the letter from reveal; it never rewrites the sealed record).
--
-- REPUBLICATION SCOPE IS DEFINITIONAL, NOT A COLUMN (D-SEQ-6, held in-ceremony-only
-- 2026-06-19): a `sealed_testimony` GRANT covers IN-CEREMONY REVEAL ONLY. Republication
-- of a revealed letter outside the reveal gate (Season-Finale artifact, Almanac, any
-- surface beyond the ceremony) is a DISTINCT future consent act, adjudicated at the
-- reveal/republication build, never inherited from the capture grant. No scope column is
-- added now; the narrowing lives in the contract card and the seal-surface copy.
--
-- `sealed_testimony` carries NO rendering_class: the existing biconditional CHECK
-- (member_consent_events_class_iff_synth: (category='synthesized_voice') = (rendering_class
-- IS NOT NULL)) holds unchanged. No other column or policy change; the
-- member_consent_current view picks the category up for free.
--
-- FOUNDER-ESCALATION (charter section 7): this widens a CHECK on live consent infra, the
-- same class as the 010 apply. Applied deliberately by the founder via the Supabase SQL
-- editor; the EXECUTE agent prepares + verifies, never self-applies. Widening a CHECK
-- touches no existing row (all current categories remain valid) and adds no data.
ALTER TABLE member_consent_events DROP CONSTRAINT member_consent_events_category_check;
ALTER TABLE member_consent_events ADD CONSTRAINT member_consent_events_category_check
  CHECK (category IN (
    'media_appearance',
    'recorded_voice',
    'likeness_derived',
    'attributed_quotes',
    'synthesized_voice',
    'sealed_testimony'
  ));
