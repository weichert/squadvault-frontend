# Observations - A/V Room round-4 continuation, batch 1

Dated 2026-06-11. Session: Claude Code / Opus 4.8 (EXECUTE). Branch
`feat/w1-ingest-round4-cont` off `main` at `4a3bf2f`. In-spec (D-G photo-first tooling +
spec 5.1 derived renditions); no DECIDE gate. PR #18. Discharge held pending founder
click-through.

## Shipped

- **R4-D1 quick-look** (`a6aef39`): tap a row's thumbnail (or Enter/Space when focused) ->
  full-size lightbox over the FILTERED corpus; arrow keys walk the filtered order, Esc
  closes, the tag panel sits alongside (you cannot tag what you cannot see). The image is
  the full original signed on demand; a video shows its poster + the attestation
  placeholder (NO player - the image-only line holds; `/sign` only ever signs a video's
  poster). Carry-forward honored: an original the browser can't render (the HEIC the canvas
  could not thumbnail, 7048e1a0) falls back to an honest "open the original" link, so an
  unreadable item stays viewable/identifiable. Refactor: the editable detail is extracted
  to a shared `EntryDetailPanel`, used by both the row expand and quick-look - ONE tag
  panel, not two.
- **R4-D2 download original** (`7d01097`): a "Download original" affordance in the shared
  panel (so it appears in quick-look AND the row expand). `/sign` gains a download mode -
  a signed URL of the ORIGINAL (any kind) with a download disposition + friendly filename.
  Retrieval, not display, so it signs the original video file too (the no-playback line
  governs display in the room, not the commissioner pulling back the league's own asset);
  commissioner-only in Inc 1. Available for withdrawn items too (withdrawal governs
  display, not the right to retrieve the record).
- **R4-D5 untagged work queue** (`f2cf807`): a "needs" filter - "needs any tag" plus a
  per-kind variant - and a quiet "N UNTAGGED" count in the header (only when > 0) that
  doubles as a one-click jump to the queue. Plain muted text; no badge, no progress bar,
  no streaks. Commissioner tool-state, never member-facing.
- **R4-D8 select-all-in-filter** (`6393b2a`): one control selects exactly the filtered set
  (selectable/non-withdrawn only), toggling to deselect. Closes the loop with the batch-tag
  bar: filter season=2023 + needs-any -> Select all -> one batch-tag stroke. Selection
  stays scoped to visible (D3).
- **Override-prepend fix** (`2ef04bb`): the #16 narrowed finding. The "Upload anyway"
  override reused the failed queue row in place and landed mid-list; both paths now funnel
  through one `enqueue()` (fresh appended item -> same pool -> same router.refresh() ->
  server newest-first sort), so the override prepends identically to a normal upload.

## Gates

`npm run type-check` clean; `npm run build` compiled; `npm run test:governance` 114/0.
No new table or migration in this batch.

## Held for founder (click-through, then discharge)

Open quick-look from a row; walk with arrows; Esc closes; tag from inside the lightbox.
Download an original (photo + video). Filter "needs any tag" + the "N UNTAGGED" jump.
Select-all-in-filter -> one batch-tag stroke. "Upload anyway" a duplicate -> the new copy
lands at the TOP (the prepend fix).

## Pending (batch 2, same branch or next)

R4-D4 tag autocomplete (own ratified values only) + the D4 ordering assertion; R4-D6
keyboard-first flow; R4-D7 retry-failed; the jump-to-item link (D1 owes it); the derived
duplicate indicator. Bright lines unchanged: no AI tagging/ranking, no gamification.
