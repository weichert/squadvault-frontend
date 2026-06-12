# D-W1-A ruling - voice-attestation class + video playback (RATIFIED 2026-06-11)

Fable DECIDE session 2026-06-11; founder ratified all picks in-session. Engine-side
deferral discharged by this ruling (STATE line: "PLAYBACK still DEFERRED... attestation
is its OWN class + 2b gate, NOT a soft tag; option-3 rejected 2026-06-10" - the
rejection STANDS; this ruling supplies the own-class mechanism). Classification per
D-W1-A5: pure MECHANISM SPECIFICATION under existing W.1 spec section 5.7 - no spec
amendment consumed. 5.7 already states the gate verbatim ("enabled per item only when
(no member voice attested by commissioner tag/note) or (all identified members' 2b
grants current). Fail-closed."); this ruling supplies the class satisfying its first
disjunct. The sign-route "never signed for display" line is code-level and already
scoped to display by the R4-D2 comment block; the playback variant amends code, not
spec.

## D-W1-A1 (RATIFIED: a) - Attestation semantics + supersession

The attestation is VOICE-ONLY: a human commissioner's act asserting "this video
contains no member's voice." Visual presence remains governed by room ratification +
2a-for-identification (W.6 boundary clause) - this class says nothing about likeness.
A contrary or superseding attestation is a NEW append-only event (`member_voice_present`
or a fresh `no_member_voice`); nothing edits or deletes. The gate reads the LATEST
event. Playback fails closed FORWARD the moment current state is not no_member_voice:
precisely, supersession stops future signed-URL ISSUANCE; an already-minted URL lives
out its TTL (<=600s). This is the D-U boundary applied to playback - revocation stops
future use and never rewrites the past; the grant-at-time provenance keeps prior
playback legitimate. Attestation renders visibly on the item (trust legibility):
"No member voice - attested by <name>, <date>" - supersedable, never hidden.

## D-W1-A2 + A2a (RATIFIED: a; A2a yes) - Gate composition

The route-evaluated gate carries BOTH 5.7 legs now:
- Leg 1 (attestation): latest media_voice_attestations event for the entry exists AND
  attested_state = 'no_member_voice'.
- Leg 2 (2b consent, inert-but-real until E2.3): at least ONE identified member
  (current member_identification tags per the established tag read-model) AND every
  identified member has a current 2b grant (member_consent_current, category
  'recorded_voice', state grant).
VACUOUS-TRUTH EXCLUSION (A2a, ratified): Leg 2 is FALSE when zero members are
identified. An untagged, unattested video stays gated; the only path to playback for
an untagged video is the commissioner's attestation. Absence of tags is not evidence
of absence of voices (silence over speculation). Gate = Leg1 OR Leg2; ANY uncertainty,
read error, or missing read-model -> fail closed.

## D-W1-A3 (RATIFIED: a, TTL 600s) - Playback transport

Sign route gains `variant: 'playback'`, valid ONLY for media_kind = 'video' (400
otherwise). Authorization: league-member (the room reads it; the gate is the
protection). The gate is enforced AT THE ROUTE - UI is never the boundary. On pass:
mint a display-signed URL of the ORIGINAL, TTL 600s (playback-specific constant; the
120s display TTL is unchanged). On fail: 403 with a neutral body ('Playback gated') -
no leakage of which leg failed or what tags/grants exist. Transport is direct
Supabase Storage -> <video>; no function transit (4.5 MB edge irrelevant). VERIFY,
don't assume: observe range-request/seek behavior against URL expiry and record the
observed behavior in the build memo. No autoplay, ever. preload="metadata". ZERO
playback logging - no play events, no view counts, no telemetry (invariant 6.3).

## D-W1-A4 (RATIFIED as presented) - Attestation UI + bounds

Attest control beside Set poster in Details/lightbox; commissioner-only this
increment (W.6 deferred posture - all member grants, including the commissioner's
own, wait on E2.3). attested_by + recorded_at required (the event is the claim);
note optional. Supersede affordance: "Record contrary attestation" - a new event,
never an edit. Members see the attestation line and, where the gate passes, the
player; they see no controls.

## Binding build shape

1. Migration 015 `media_voice_attestations` - sibling pattern of 012/014 exactly:
   id uuid PK, league_id uuid NOT NULL REFERENCES leagues(id), media_entry_id uuid
   NOT NULL REFERENCES media_entries(id), attested_state text NOT NULL CHECK
   (attested_state IN ('no_member_voice','member_voice_present')), attested_by uuid
   NOT NULL REFERENCES auth.users(id), note text, recorded_at timestamptz NOT NULL
   DEFAULT now(). Index (media_entry_id, recorded_at DESC). RLS default-deny:
   SELECT league/commissioner/admin; INSERT commissioner/admin; NO UPDATE, NO DELETE.
2. G20 governance test - probe-skip until 015 applied (the G17/G19 rhythm): anon
   INSERT denied 42501. Target 116/0 post-apply.
3. Route-enforced gate in sign/route.ts (playback variant) + attest API route
   (authed-insert = license, the established RLS-enforcement pattern).
4. Player UI in room + quick-look, replacing the "Playback pending voice attestation"
   placeholder ONLY for gate-passing items; signed URL fetched on user intent (open/
   play), never prefetched on grid render.

Inherited boundaries restated: no AI audio analysis proposing or making attestations -
the attestation is a human commissioner's act, full stop. No autoplay, no view counts,
no engagement mechanics. Member 2b grants remain each member's own authenticated act
(E2.3). Verified-vs-testimony layer distinction untouched. Fail closed everywhere.
Option-3 (soft-tag-carrying-hard-gate) rejection stands.
