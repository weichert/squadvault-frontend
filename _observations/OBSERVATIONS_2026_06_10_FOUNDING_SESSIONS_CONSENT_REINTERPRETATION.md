# founding_sessions.consent is the LEAGUE-DEFAULTS layer, not per-member consent

Date: 2026-06-10
Authority: W.6 Consent Governance Memo v1.2, RATIFIED 2026-06-10 (decision D-X; sections 0
and 7.1). Canonical memo in the engine repo:
`docs/SquadVault_W6_Consent_Governance_Memo_v1_2.md`. This note is the W.6 7.1 record in the
frontend repo.

## The reinterpretation

`founding_sessions.consent` (`supabase/migrations/001_core_schema.sql:137`; typed as
`ConsentRecord` in `src/lib/supabase/types.ts`) is, and remains, the **league-defaults
layer**: a commissioner-set, league-level feature posture (are photos / voice-recording /
names-in-the-record features enabled for the league at all). It is:

- mutable (written via UPDATE in the founding consent route),
- league-level (one value per founding session, keyed to the commissioner),
- a three-boolean bundle (`photos`, `voice_recording`, `text_likeness`).

W.6 verified these properties at frontend `4e44bb3` (memo Appendix A). They are structural,
so per-member / append-only / revocable-forward consent **cannot** be produced by extending
this field. W.6 D-X therefore left it **unmodified** and established a separate system of
record.

## What IS the per-member consent source of truth

`member_consent_events` (migration `010_member_consent_events.sql`) and its derived view
`member_consent_current` — append-only, member-only-INSERT, per-member, per-category,
revocable-forward. See the W.6 memo and the member consent surface at
`src/app/league/[id]/consent`.

## Developer guidance (binding)

- Do NOT read or write `founding_sessions.consent` as per-member consent. It grants nothing
  about any individual member.
- Any feature gating on whether a member has consented to media / voice / quotes reads
  `member_consent_current` (or the events log), never `founding_sessions.consent`.
- The DoR's "extends `founding_sessions.consent`" phrasing (Part 3, Unit W.6) is superseded by
  the ratified memo (recorded as the DoR's own v2.1.1 supersession note). No migration of the
  field is planned; this is a naming/role clarification, not a schema change.
