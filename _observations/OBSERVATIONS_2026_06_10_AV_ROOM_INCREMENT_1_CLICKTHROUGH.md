# W.1 A/V Room Increment 1 — live click-through findings + video carry-forwards

Date: 2026-06-10
Authority: W.1 A/V Room four-memo chain (ratified 2026-06-10, SAT #1). Increment 1
discharged at frontend `65da2e6` (PR #2). This note is the click-through record on the
proven foundation; it records state, it does not commission work. Spec refs are to the
W.1 A/V Room spec (engine repo).

Commit chain (all on `main`): `c21e858` foundation (migration 011 + types + governance)
-> `df79a4f` tighten G12-G15 to assert RLS 42501 -> `c284053` server routes + shared
room read-model -> `7eee29d` ingest + display surfaces -> `65da2e6` PR #2 merge.

## Proven live (founder click-through against the live DB)

The Increment 1 surfaces behaved to spec end to end:

- **Fail-closed room (6.6, 5.4).** The display renders a sealed state until a
  `room_ratification_event` exists. No ratification -> nothing shown.
- **Upload (5.2, 6.9).** Photo ingested to the private league-media bucket; original
  retained unmodified; bytes served only via short-TTL server-issued signed URLs.
- **Five-kind provenance tagging (5.3).** All five tag kinds applied.
- **Vacuous-tag rejection (note 2).** The no-vacuous-tag guard fired on the write path
  (and mirrored client-side): a contributor/season/event tag with no value is rejected.
- **Supersession (correction-by-supersession, never edit).** A real correction landed:
  a video's date tag was superseded from **3/26 -> 8/26/2023**. The superseded tag
  remains in the log; "current" derives to the latest non-superseded tag per (entry, kind).
- **Ratification (5.4).** Ratifying the room flips the fail-closed gate; forward display
  populates.
- **Withdrawal (5.5).** A withdrawn item drops from forward display; the underlying
  record is retained (append-only, withdrawal is a forward-display drop, not a delete).
- **Honest gaps (6.8).** The provenance panel shows gaps honestly rather than implying
  completeness.
- **Video present-but-not-playable (deferred).** Video renders an image-only
  placeholder; no playback this increment (founder decision 2026-06-10 — see carry-forwards).

## 2a-silence check is structurally unexercisable until E2.3

The 6.6 fail-closed member-identification path (a name shows only against a current 2a
`media_appearance` grant, else silent) **cannot be exercised live yet.** No franchise has
a linked `member_user_id`, so the identification dropdown is empty: the surface
fail-closes at the *identity layer* before the 2a grant-read is ever reached. There is
nothing wrong with the gate; there is simply no identified member to test it against.

The first live exercise of 2a silence therefore rides **E2.3** (member<->franchise
identity linkage). Spec section **8.1** already anchors the first live test there; this
note confirms the structural reason, not a defect.

## Video-increment carry-forwards (next increment: attestation class + playback gate)

Queued for the video increment, which introduces the structured attestation class and the
2b playback gate:

- **Large-file ingest.** Supabase's global 50 MB request cap rejected a real-corpus
  `.MOV` — a **400 after ~40s** of upload. The byte path needs resumable/direct-to-storage
  upload (or a raised cap) before real video lands.
- **Surface upload-failure reasons to the commissioner.** The 400 above surfaced as a
  generic failure; the commissioner should see *why* (size cap, type, policy) — the ingest
  panel must report the reason, not just "failed."
- **Client-side size pre-check.** Reject oversized files before the ~40s round-trip;
  fail fast in the panel.
- **Poster-frame extraction as a derived rendition.** Extract a still as a *derived*
  rendition with the original untouched (6.9). The poster is image-only — a silent frame,
  **no 2b (voice/playback) read** — so it carries no consent-gate semantics and can show
  in the present-but-not-playable state.

## Option 3 rejected for the attestation decision (closes the routes-memo re-litigation surface)

The routes memo (`c284053` body) recorded that video is present-but-not-playable because
there is no structured voice attestation on the merged schema, and left *how* attestation
should be modeled open. Recording the adjudication so it is not re-litigated:

**Option 3 — model attestation as a provenance tag kind — is rejected.** A provenance tag
is a *soft* descriptive tag: it lives in an append-and-supersede vocabulary, can be
withdrawn or superseded, and carries no authorization semantics. Playback attestation is a
*hard* gate: it governs whether 2b (voice/likeness) content may play at all. Loading a hard
gate onto a soft tag conflates description with authorization — a tag supersession or
withdrawal could silently flip playback, and the tag vocabulary does not read 2b consent.
Attestation must therefore be its **own structured class with its own gate**, queued for
the video increment alongside the playback path — not a sixth tag kind. ("Provenance tag =
soft tag carrying a hard gate" is exactly the failure mode being declined.)

See also `_observations/OBSERVATIONS_2026_06_10_FOUNDING_SESSIONS_CONSENT_REINTERPRETATION.md`
for the consent source-of-truth (`member_consent_current`, 2a/2b) this gate will read.
