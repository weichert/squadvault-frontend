# Observations - A/V Room round-4 continuation, batch 2

Dated 2026-06-11. Session: Claude Code / Opus 4.8 (EXECUTE). Branch
`feat/w1-ingest-round4-cont-b2` off `main` at `4a3bf2f`. In-spec (D-G photo-first tooling
+ spec 5.1/5.2); D-W1-E1 is a ruled amendment (see the ruling memo). PR #19. Discharge
held pending migration 014 apply + one consolidated founder click-through.

## Shipped (founder-ratified order)

- **R4-D4 tag autocomplete + ordering assertion** (`6d8ed09`): contributor/season/event
  value fields offer the league's OWN previously-recorded values via a datalist (suggests,
  never constrains - free-text new values stay first-class; date stays open). Kills
  "Draft Day"/"draft day" drift. Vocabulary threaded to the shared EntryDetailPanel.
  Ordering assertion: a dev tripwire asserts the ingest list is newest-first so a silent
  regression of that invariant can't pass unnoticed.
- **R4-D7 retry-failed** (`1eb5520`): every failed upload keeps its File; per-file "Retry"
  + "Retry all (N)". Retry re-enqueues as a normal upload (dup/HEIC checks run again - a
  retry is not an override); duplicates keep "Upload anyway" instead.
- **R4-D6 keyboard-first** (`312938a`): J/K move a focused row (gold ring, scrolled into
  view), Space = quick-look, Enter = expand, shift-click = range select. Expand + focus
  lifted to IngestPanel so the keyboard drives them; ignored while typing / lightbox open.
- **jump-to-item link** (`8d7582c`): the duplicate refusal offers "Show original" - focuses
  + scrolls the existing item into view (clearing filters if it's hidden). Reuses D6's
  focus/scroll; the derived dup indicator reuses jumpToItem in turn.
- **derived duplicate indicator** (`a594cec`): byte-duplicates surface from content_hash
  equality (earliest per hash = original; later copies render "· DUPLICATE" + Show
  original). Read-model derived - NO migration / NO tag kind / NO stored state. A
  "Duplicates only" filter joins the dropdowns.
- **D-W1-E1 media expungement** (`7119651`): the terminal, ruled byte-deletion exception.
  Migration 014 `media_expungement_events` + G19 (probe-skips until applied). The route's
  sequence is constitutional: commissioner check -> insert the event via the AUTHED client
  (the event IS the license; no event, no deletion) -> delete the bytes via the ADMIN
  client (its instrument). Read-model: expunged = an event exists; TERMINAL (no
  reinstatement). The room excludes expunged entries entirely; the ingest list hides them
  unless the new "Expunged (tombstones)" filter asks; the tombstone shows the reason.
  Expunge action behind a required-reason confirm. Dup-check distinguishes "duplicate of an
  expunged item" from "already in the record" (content_hash survives expungement). See
  `_observations/OBSERVATIONS_2026_06_11_AV_ROOM_DW1E1_EXPUNGEMENT_RULING.md`.

## Gates

`npm run type-check` clean; `npm run build` compiled; `npm run test:governance` 114/0
(G19 probe-skips until migration 014; self-activates to 115 once applied, the G17/G18
rhythm). Migration 014 is the only new migration in this batch.

## Founder apply-steps + one consolidated click-through (then discharge)

1. **Apply migration 014** via the Supabase dashboard SQL editor (the established rhythm).
   Re-run governance -> expect 115/0 (G19 active).
2. Click-through (one pass): autocomplete suggests the league's own values + accepts new
   ones; J/K + Space + Enter + shift-range; retry a failed upload; a duplicate shows
   "· DUPLICATE" + Show original, and the "Duplicates only" filter; Expunge an item (a
   throwaway) - confirm the bytes are gone, the room no longer shows it, the "Expunged
   (tombstones)" filter shows the tombstone with its reason, and a re-upload of expunged
   content reports "duplicate of an expunged item".

## Engine-side follow-up (NOT this repo; next engine session, doc-only)

Flip the media-expungement candidate from PARKED to ADMITTED: engine memo `6dce2f6` +
`docs/STATE.md` Deferred line. D-W1-E1 ruled (a) 2026-06-11; ruling memo of record is the
frontend `ff1b74b`. (The parked record lives engine-side - a frontend git-grep for
"expung" was empty; the fresh-record call was founder-confirmed correct.)

## Bright lines (held)

No AI tagging/face-detection/AI-search; no gamification/streaks/nudges; no relevance
ranking - filters/matches stay deterministic.
