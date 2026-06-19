-- 019_oral_history_testimony_consent.sql
-- L.1 Historian Interviews, capture-only first wave (S4, RATIFIED 2026-06-19; spec engine
-- c9d32d5, sections 5.3 + 7). Adds the `oral_history_testimony` consent category to the W.6
-- consent system of record (member_consent_events, migration 010). Consent-at-interview for
-- captured oral-history testimony: member-authored only, append-only, revocable-forward (a
-- REVOKE withholds FUTURE display, never rewrites the captured record).
--
-- A NEW dedicated category (not attributed_quotes) per the L.3 precedent: revocation
-- granularity over testimony is distinct from quote-attribution, and the member governs each
-- independently. GRANT-PRECEDES-CAPTURE (spec 5.3 / invariant 6.4): no exchange is stored
-- without a prior oral_history_testimony GRANT; absence = no grant (W.6 default-posture 1.4).
--
-- `oral_history_testimony` carries NO rendering_class: the existing biconditional CHECK
-- (member_consent_events_class_iff_synth: (category='synthesized_voice') = (rendering_class
-- IS NOT NULL)) holds unchanged. No other column or policy change; the
-- member_consent_current view picks the category up for free. The member-only INSERT policy
-- (member_user_id = auth.uid()) already holds — the commissioner cannot proxy a grant
-- (W.6 1.3: not during onboarding, not for the deceased, not to get the feature working).
--
-- FOUNDER-ESCALATION (charter section 7): this widens a CHECK on live consent infra, the
-- same class as the 010 and 017 applies. Applied deliberately by the founder via the Supabase
-- SQL editor; the EXECUTE agent prepares + verifies, never self-applies. Widening a CHECK
-- touches no existing row (all current categories remain valid) and adds no data.
ALTER TABLE member_consent_events DROP CONSTRAINT member_consent_events_category_check;
ALTER TABLE member_consent_events ADD CONSTRAINT member_consent_events_category_check
  CHECK (category IN (
    'media_appearance',
    'recorded_voice',
    'likeness_derived',
    'attributed_quotes',
    'synthesized_voice',
    'sealed_testimony',
    'oral_history_testimony'
  ));
