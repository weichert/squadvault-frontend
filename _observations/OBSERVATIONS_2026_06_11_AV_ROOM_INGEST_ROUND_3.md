# Observations - W.1 A/V Room ingest ROUND 3: performance at scale

Dated 2026-06-11. Session: Claude Code / Opus 4.8 (EXECUTE). Branch
`feat/w1-ingest-round3` off `feat/w1-ingest-ergonomics-r2` at `6c3599c`. In-spec
(D-G photo-first tooling + spec 5.1 derived renditions) - no DECIDE gate.

## Branch base: stacked on round 2 (flagged, charter 3.3)

Round 3 depends on round-2 code that is not yet on `main`: the r2-D1 `thumbUrl` field
and the r2-D3 filters. PR #13 (round 2) is open/mergeable but HELD on founder
click-through, so round 3 stacks on the r2 branch rather than `main`. The round-3 PR is a STACKED
PR whose base is `feat/w1-ingest-ergonomics-r2`, so it shows only the round-3 diff;
GitHub auto-retargets it to `main` when #13 merges. Merge order: #13 (round 2) then
the round-3 PR. Verified at session start: HEAD `6c3599c`, tree clean, PR #13
OPEN + MERGEABLE.

## The bright lines (recorded per brief)

No AI tagging, face detection, or AI-assisted search (W.8's chain proposes, humans
ratify - later, there). No gamification, streaks, or nudges. No relevance ranking
anywhere; filters and matches stay deterministic. Room presentation / era-ordering is
W.2 input, not built here. Whole-corpus export is the Legacy Guarantee (Track L), parked.

## R3-D1 thumbnail renditions (`6794744`) - and the method decision

Every list surface served the full original behind a signed URL; a 300-item corpus
shipped gigabytes to render one page. Lists (ingest + room) now serve a small derived
rendition - photo `thumb.jpg` (~400px long edge), video `poster.jpg` (r2-D1) - and
NEVER the original. The original is reserved for quick-look (R4) and downloads.

**Decision (the brief asked to pick after diagnosis and record why): client-side canvas
at upload, NOT server-side resize.** Diagnosis of the upload path showed the original
goes client-DIRECT to Storage under a grant precisely BECAUSE it cannot pass a function
body (4.5 MB Vercel edge). A server-side resize would have to (a) pull the multi-MB
original back into the function from Storage and (b) add a heavy native image lib
(sharp) that is fragile on serverless. The client, by contrast, already holds the file
at upload and already proves the canvas-downscale technique for video posters
(`extractPosterBlob`). So the photo thumb is generated there (`fileToThumbBlob`) and
arrives small - exactly symmetric with `poster.jpg`: a derived, regenerable rendition,
upsert-allowed, original untouched (6.9).

- New `POST/GET /api/av-room/thumb`: POST upserts a photo's `thumb.jpg` (mirrors the
  poster route's auth + league-from-entry derivation); GET lists backfill targets
  (photos with no thumb yet) with signed originals - a one-off maintenance path, never a
  render path.
- Backfill control in the panel regenerates the missing thumbs for the existing corpus,
  client-side canvas, idempotent (photos that already have a thumb are skipped).
- Fallback: a missing rendition fails to load and the card/room falls back to a
  placeholder (`onError` / the new `RoomImage` client island), NEVER the multi-MB
  original.

## R3-D2 batch signing (`8e5db41`)

The read-models signed one URL per item in a serial loop. Both ingest and room now
collect every sibling path and sign them in ONE `createSignedUrls()` call - O(1) sign
round-trips per rendered page, not N. Videos are still listed per-folder for the honest
"no still yet" poster hint (existence, not signing; bounded by video count in a
photo-first corpus); the bulk photo path does zero list calls.

## R3-D3 list virtualization (`dc06f11`)

The corpus list virtualizes against the document scroll
(`@tanstack/react-virtual` `useWindowVirtualizer`), rendering only the visible window +
overscan, so DOM and image-byte fetches stay O(visible) and memory stays flat. Rows are
variable height (compact, or tall when expanded) so each rendered row is measured
(`measureElement`). Filters (r2-D3) still operate on the FULL set upstream;
virtualization only windows the already-filtered result.

Dependency added: `@tanstack/react-virtual` (headless, zero runtime deps). A dev-only
`?synthetic=N` harness (max 2,000, never in production, never written to the DB) lets
the 1,000-item scroll be exercised locally without seeding prod data. The 60fps /
flat-memory acceptance is a local founder click-through via `?synthetic=1000`.

## R3-D4 mobile function-at-width (`295844c`)

The ingest tool + room made usable at 390px (load-bearing for Draft Weekend capture ->
upload from the lake). Function-at-width only; polish stays W.2's.

- Explicit mobile viewport (`width=device-width, initial-scale=1`) stated in the root
  layout rather than left to a framework default.
- The upload label is a tap target on phones; its `<input multiple>` already lets iOS
  Safari pick several from the library. Copy now says "tap to choose".
- The per-item tag form collapses to one column on a phone via intrinsic sizing
  (`auto-fit minmax`), two columns where it fits.
- Audit finding: filter bar, batch-tag bar (flex-wrap), room grid (auto-fill minmax
  240), and compact rows (min-width 0) were already fluid - left as-is.

## Gates

- `npm run type-check` clean (each of D1-D4). `npm run build` compiled (a stale `.next`
  webpack-chunk error after adding files cleared with `rm -rf .next`; not a code fault).
- `npm run test:governance`: **113 passed, 0 failed**. Round 3 adds NO new table, so no
  new G-test (R4-D3's migration 013 is where the next G-test lands).

## Held for founder (production click-through, then round 3 discharges)

1. Backfill the two existing prod photos' thumbnails (the "Generate missing thumbnails"
   control), confirm thumbs render on ingest + room.
2. 1,000-item scroll is smooth via `?synthetic=1000` on the ingest page locally.
3. iPhone end-to-end on production: upload + tag a photo from the phone.

## Out of scope (untouched)

Round 4 (the curator's bench) entirely; Increment 2 / member anything (E2.3); video
playback + voice-attestation (DECIDE); raising the 50 MB cap.
