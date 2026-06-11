# Observations - W.1 A/V Room ingest ergonomics, ROUND 2

Dated 2026-06-11. Session: Claude Code / Opus 4.8 (EXECUTE). Branch
`feat/w1-ingest-ergonomics-r2` off `main` at `b5f5bf6` (the round-1 merge). In-spec
ergonomics unit (spec 5.7 / D-G "photo-first tooling") - no DECIDE gate.

## Session finding: crash mid-round; reconstructed from git, not memory (charter 3.3-3.4)

The prior session ended on a host crash with round-2 D2 finished but UNCOMMITTED in the
working tree, and no brief filed. The round-2 D-list had been issued in Fable chat and
never written to `_observations/`. Recovery was done git-first per charter: HEAD, branch
divergence (`main..HEAD`), the D2 working diff, and the round-1 memo were the only
authorities consulted. The uncommitted D2 change was re-gated (type-check/build/
governance all green) BEFORE any further work, confirming it was a complete unit rather
than a half-edit. This memo files the reconstructed D-list as the round close - the
missing-brief gap is itself the finding (a brief issued in chat but never filed is
UNVERIFIED by charter 5; git is what survived the crash).

Governance count moved 112 -> 113 between round 1 and this session: **G17 now
self-activates**, which means migration 012 (`media_display_reinstatements`) has been
applied to production - one of the round-1 founder apply-steps is discharged.

## Round-2 D-list (reconstructed; this is the record of record)

- **D1 ingest thumbnails use the set poster** (`ea63a51`): ingest cards read the same
  `{folder}/poster.jpg` the room reads (signed server-side); photos sign their original.
  Drops the per-card client sign fetch and the inline `<video controls>` preview - the
  ingest thumbnail is image-only, consistent with the room; a video with no poster falls
  back to the placeholder. New `thumbUrl` on `IngestEntry`.
- **D2 compact rows, detail behind per-item expand** (`8ffe2c1`): `EntryCard` collapses
  to a compact default row (52x52 thumbnail, KIND - date - N tags, ellipsized note,
  Withdraw/Reinstate + a new Details toggle). All provenance and the tag/poster/
  correction form move behind the per-item expand, replacing round-1 D3's "Tag / edit"
  toggle. Withdrawn items expand too (tags stay viewable; Correct hidden). Honest gaps
  preserved ("No tags yet.", the missing-poster hint).
- **D3 deterministic find-without-scrolling filters** (`b2acded`): a filter bar narrows
  the corpus before render - media kind, season tag, event tag, withdrawn-state, and a
  plain case-insensitive substring over note + tag values. Selectors compose by AND;
  season/event options derive from the values the corpus actually carries. No ranking,
  no relevance ordering - filtering preserves corpus order untouched (constitutional
  line). Header shows "X OF N" when active; empty result offers Clear filters. Batch
  selection scoped to the visible set, so an off-screen item is never silently tagged.
  Acceptance met: a 300-item corpus narrows to one item in two interactions (e.g. season
  + text) without scrolling.

## D2 review fixes (founder-reviewed before commit, folded into `8ffe2c1`)

The compact-row redesign was reviewed against the in-tree state, not the diff, and three
issues were corrected before the commit landed:

1. **Note readability regression** - the compact row ellipsizes the upload note with
   `whiteSpace: nowrap`. Fixed by keeping a `title` tooltip AND restoring the note in
   full inside the expand, so a long note is never unreadable.
2. **Indentation hygiene** - the `!entry.withdrawn` edit fragment was re-indented (it had
   been wrapped without shifting the inner block in one level).
3. **Accessibility** - the Details toggle carries `aria-expanded`.

## Gates

- `npm run type-check` clean (each of D2, D3).
- `npm run build` compiled, no warnings; `/league/[id]/av-room/ingest` route present.
- `npm run test:governance`: **113 passed, 0 failed** (G17 self-activating on prod 012).

## Out of scope (untouched)

- Voice-attestation class + playback (own DECIDE session); Increment 2 / member anything
  (E2.3); W.2 aesthetics; AI tagging or AI-assisted search of any kind (D3 is
  deterministic by constitutional line); raising the 50 MB cap (D-W1-V1).

## Next session

- Founder click-through on the merged branch: poster thumbnails on ingest, expand/
  collapse density, filter to a single item two ways. Then this round discharges fully
  in ROADMAP.
