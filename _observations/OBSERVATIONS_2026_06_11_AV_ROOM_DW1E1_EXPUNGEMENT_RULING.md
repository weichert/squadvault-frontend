# Observations - D-W1-E1 RULED (a): media EXPUNGEMENT class ADMITTED

Dated 2026-06-11. Ruling by the founder (Fable chat). Recorded here because git is the
read-model and chat is write-only (charter 4): a ratified spec amendment must live in the
repo, not only in chat. Branch `feat/w1-ingest-round4-cont-b2`.

## Provenance note (charter 3.4 - git wins, flagged)

The build directive said "update the parked-candidate memo to ADMITTED." There is NO
`expung`/parked-candidate record anywhere in the FRONTEND repo (`git grep expung` = zero
hits across `_observations/`, `docs/`, `ROADMAP.md`, source). The parked candidate must be
tracked engine-side (`docs/STATE.md`) or in chat. Nothing in THIS repo needs flipping;
this memo is the frontend's first record of the class. Flagged, not guessed.

## The ruling (Spec 5.2 Amendment 1, ratified VERBATIM)

> Spec 5.2 Amendment 1 (D-W1-E1). "Removal from display is a display-withdrawal event,
> never a row deletion" is extended: a media item MAY be expunged via an append-only
> expungement event (commissioner-ratified, reason required). Expungement deletes the
> stored bytes - original and all renditions - and tombstones the entry: the row is never
> deleted, and the log permanently records that an item existed and was expunged (when /
> by whom / why). Expunged items render nowhere except an explicit ingest filter showing
> the tombstone. The entry's content_hash survives, so re-upload of expunged content
> surfaces as a duplicate of an expunged item and requires explicit override. Deferred
> clause: post-E2.3, expungement of media in which a member appears acquires a consent
> dimension (member-requested expungement; commissioner-initiated expungement of
> member-likeness media) to be adjudicated with Increment 2 - until then the class is
> commissioner-only and self-consistent.

Trigger: the parked candidate's "founder call" condition fired (second ask in 48 hours).

## What makes this constitutionally coherent

Byte deletion is the RULED EXCEPTION to "facts are immutable, append-only." It does not
break append-only: the EVENT is append-only and the ROW is never deleted - only the
derived bytes (which were always regenerable-in-principle renditions of a real-world
artifact the league owns) are destroyed, and the tombstone permanently testifies that the
item existed and was expunged. Withdrawal hides; expungement destroys-the-bytes-and-
testifies. The two are different events, both append-only.

## Build shape (binding) - to be built LAST in batch 2 (founder sequencing)

- **Migration 014 `media_expungement_events`** - the established sibling pattern:
  `league_id` NOT NULL, `media_entry_id`, `reason text NOT NULL`, `expunged_by`,
  `recorded_at`; RLS SELECT league / INSERT commissioner / no UPDATE / no DELETE.
  Matching G-test (the G17 probe-skip rhythm; new table = new G-test).
- **Route** - commissioner check -> insert the event via the AUTHED client (RLS-backed,
  the event is the fact) -> delete storage objects via the ADMIN client (original + thumb
  + poster). Constitutional reasoning recorded in the route: byte deletion is the ruled
  exception, the admin client is its instrument, the event row is its license.
- **Read-model** - expunged = an expungement event exists. TERMINAL by design: NO
  reinstatement path (reinstating content whose bytes are gone is incoherent). The
  withdrawn-state derivation pattern, but one-way.
- **Dup-check** - the duplicate message distinguishes "expunged" from "in the record"
  (content_hash survives expungement, so re-upload surfaces as a duplicate-of-expunged and
  requires explicit override).
- **UI** - an Expunge action (Details / lightbox) behind a required-reason confirm that
  states plainly what will happen (bytes destroyed, permanent, tombstone remains).
  "Expunged" added to the deterministic filters, showing tombstones.

## Sequencing (founder-ratified)

Batch 2 off clean `main`: R4-D4 autocomplete (+ ordering assertion), R4-D6 keyboard-first,
R4-D7 retry-failed, jump-to-item link, derived duplicate indicator - THEN expungement as
its own commit series within the batch (or a separate PR if sizing favors it - builder's
call). Migration 014 follows the dashboard-apply rhythm either way.

## Batch 1 discharge (this same founder word)

Round-4 continuation batch 1 (PR #18, merged `a97fd15`) click-through PASSED IN FULL:
quick-look walks the filtered corpus with the tag panel alongside; the HEIC item shows the
honest can't-preview fallback and Download original retrieves it; downloads work for photo
+ video; untagged queue + select-all-in-filter verified; override-prepend fix confirmed
(the duplicate landed at the top). Incidental, approved, no action: the lightbox surfaces
Set-poster with the de-silenced explanation for the new posterless video. Batch 1 is
DISCHARGED.
