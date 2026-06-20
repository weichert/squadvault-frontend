-- 022_media_caption_consent.sql
-- W.1 Increment 2 member captions (capture + two-layer display; spec engine 905cb1c,
-- sections 5.1 + 7; scope ruling D-W1I2-3). Adds the `media_caption` consent category to
-- the W.6 consent system of record (member_consent_events, migration 010). Consent for an
-- attributed member CAPTION on an A/V Room media item: member-authored only, append-only,
-- revocable-forward (a REVOKE withholds FUTURE display, never rewrites the captured row).
--
-- A NEW dedicated category (not attributed_quotes) per the 019/L.3 precedent: revocation
-- granularity over an A/V Room caption is distinct from quote-attribution across the vault.
-- Revoking attributed_quotes to withdraw one caption would also withdraw every attributed
-- quote elsewhere (recaps, the future press-conference class); a member must revoke a caption
-- without collapsing all quote attribution (D-W1I2-3). GRANT-PRECEDES-CAPTURE (spec 5.6 /
-- invariant 6.4): no caption is stored without a prior media_caption GRANT; absence = no
-- grant (W.6 default-posture 1.4).
--
-- `media_caption` carries NO rendering_class: the existing biconditional CHECK
-- (member_consent_events_class_iff_synth: (category='synthesized_voice') = (rendering_class
-- IS NOT NULL)) holds unchanged. No other column or policy change; the
-- member_consent_current view picks the category up for free. The member-only INSERT policy
-- (member_user_id = auth.uid()) already holds — the commissioner cannot proxy a grant
-- (W.6 1.3: no proxy, not to get the feature working).
--
-- FOUNDER-ESCALATION (charter section 7): this widens a CHECK on live consent infra, the
-- same class as the 010/017/019 applies. Applied deliberately by the founder via the Supabase
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
    'oral_history_testimony',
    'media_caption'
  ));
