# Observations - R4-D3 fix: hash backfill wrote via the authed client (silent RLS no-op)

Dated 2026-06-11. Session: Claude Code / Opus 4.8 (EXECUTE). Branch
`feat/w1-ingest-round4`, PR #16. Folds forward into
`_observations/OBSERVATIONS_2026_06_11_AV_ROOM_INGEST_ROUND_4_R4D3.md` (do not edit that
committed memo; this is the supersession-then-fold-in record).

## Symptom (founder click-through on PR #16)

"Backfill content hashes" reported "Hashed 9 items", but the DB showed `content_hash`
NULL for every pre-existing row - only the new finalize-time INSERT row (`aaa9514e`)
carried a hash. Duplicate detection therefore matched nothing and a duplicate uploaded.

## Root cause (constitutional, not incidental)

`POST /api/av-room/hash` ran `UPDATE media_entries` via the AUTHED client. `media_entries`
has NO UPDATE policy (migration 011, append-only, RLS default-deny). An RLS-denied UPDATE
does not error - it matches ZERO rows and returns a null error - so each call returned
`ok` and nothing persisted. A textbook silent no-op: the de-silence law (surface the
honest gap, never report success for a write that did nothing) had not been applied to
this path.

## Fix (adjudicated, Fable chat 2026-06-11)

1. **The hash write uses the ADMIN (service) client.** The reasoning is constitutional,
   not a workaround: `content_hash` is a derived, regenerable CONVENIENCE - migration
   013's own argument places it in the thumbnail/poster family, NOT the fact/provenance
   family. The append-only law protects the RECORD (facts and provenance events);
   writing this column is rendition maintenance, exactly like the `poster.jpg` /
   `thumb.jpg` upserts that already go through the admin client. The commissioner check
   above the write remains the authorization boundary.
   **No new UPDATE policy is added to `media_entries`** - a column-scoped UPDATE grant
   would widen the audited RLS surface for one maintenance path. The proven append-only
   posture stays exactly as it was; service-role rendition maintenance sits beside it,
   not inside it.
2. **De-silence.** The admin update now `.select('id')`s the affected row and returns a
   502 honest failure when zero rows are touched; a write that changed nothing never
   counts as done. (`finalize` already records the hash at INSERT time via the
   commissioner-authed INSERT policy, which is why the new row had its hash - only the
   UPDATE-based backfill was the broken path.)
3. **G18** (governance 113 -> 114): a non-service UPDATE on `media_entries` is denied
   (RLS filters the row; zero rows affected). Probed against a REAL row so it proves
   denial rather than not-found; skips if `media_entries` is empty/absent. Today's
   accident is now a permanent assertion of the append-only law.

Commit `a6e7e01`. type-check / build green; governance 114/0.

## Founder retest (after this lands on the branch, then merge #16)

1. Run "Backfill content hashes" - expect "Hashed 8 items" (or per-item honesty), then
   re-run the hash query: no NULLs.
2. Withdraw the accidental duplicate `aaa9514e`, then re-upload `IMG_6208.MOV`
   (byte-identical to stored, md5-proven) - it MUST refuse ("already in the record").
3. Renamed-HEIC test (`~/Desktop/sneaky.jpg`) - refused by content; then the "Upload
   anyway" override path. Then merge.

## Lesson (general)

Any write through the authed/RLS client must confirm it AFFECTED something - an
RLS-denied UPDATE/DELETE is silent (zero rows, null error), indistinguishable from
success unless checked. Where the target is a derived rendition (not a fact), the
correct client is admin with the commissioner check as the boundary; where it is a fact,
the append-only INSERT path is the only legitimate write.
