# Observations - A/V Room round-4 continuation queue (post-#16)

Dated 2026-06-11. Session: Claude Code / Opus 4.8 (EXECUTE). Records the round-4
continuation brief after PR #16 (R4-D3) merged to `main` (`339b73a`). The continuation
runs off clean `main`, opening with D1 quick-look. Nothing here is built yet.

## #16 click-through result (founder, on the branch, migration 013 applied to prod)

ALL PASSED. Migration 013 verified (content_hash present, nullable). Backfill fix verified
live ("Hashed 9 items" honest - 10 entries, 1 already hashed at insert; post-run 10 total /
0 NULLs). Duplicate refusal on a byte-identical re-upload (md5-proven IMG_6208.MOV) with
override offered + declined; cross-kind and against-withdrawn matching confirmed.
HEIC-by-content refused the renamed-.jpg forensic file (7048e1a0) with NO override - the
correct asymmetry (a duplicate is overridable; a HEIC the canvas can't decode is not).
Override path landed the duplicate (warns, doesn't wall), then withdrawn (aaa9514e).
Control: a genuinely new photo uploaded friction-free and appeared at the TOP.

## Queue (in addition to D1, D2, D4-D8)

### 1. Derived duplicate indicator (adjudicated, Fable chat 2026-06-11)

NOT a provenance tag - tags are human-asserted and ratified_by-attributed; byte-equality
is a system-derivable fact. Shape: the read-model derives duplicate state from content_hash
equality WITHIN the league (same pattern as withdrawn-state derivation). All but the
EARLIEST entry per hash render "DUPLICATE of <item>", linking to the original (reuses the
jump-to-item mechanics D1 owes). Retroactive by construction, self-maintaining. Add
"duplicates" to the deterministic filter dropdowns. NO migration, NO new tag kind, NO
stored state - purely derived from content_hash already on the row.

### 2. Override-path prepend fix + D4 ordering assertion (narrowed finding, non-blocking)

Normal uploads prepend correctly (newest-first, founder-verified). The "Upload anyway"
override path inserted its item MID-LIST until refresh - server order is correct; this is
a transient CLIENT insertion bug in the override flow only. Fix: make the override path use
the same prepend as the normal path. Add the D4 ordering assertion at that point so it
cannot regress silently.

### 3. Carry-forwards restated (so nothing drops)

- **D1 quick-look MUST attempt originals the canvas could not thumbnail** - the 7048e1a0
  case: an unreadable item still has to be viewable/identifiable in quick-look (the list
  thumbnail is an honest placeholder, but the original must be openable).
- HEIC content-sniff - DONE (PR #16). Backfill-names-unreadables - DONE (PR #14 / `609398e`).
- Jump-to-item link - D1 owes it; the derived duplicate indicator reuses it.

### 4. Poster silent-failure note - CLOSED, no action

"Set poster" confirms state explicitly ("Poster still set" + Replace control); the earlier
6/10 missing poster was a never-completed set, not a silent save failure.

## Standing state (verified)

- Both video posters set; the Lake poster re-set and verified ("Poster still set - the room
  shows it for this video"; renders as the row thumbnail).
- Withdrawn duplicate `aaa9514e` and unreadable `7048e1a0` stay as-is (correct disposition).
- Corpus: 10 entries, all hashed, thumbnails generated (one honest unreadable), both video
  posters set.

## Production follow-up

Dev and prod share the database, so backfill/thumbnail regeneration is already done - no
button press needed on the deployed site. A 30-second iPhone glance at the ingest page
post-deploy is still worth doing (R3-D4 mobile).
