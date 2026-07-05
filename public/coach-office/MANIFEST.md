# Coach Office - Asset Manifest

**Interim hero landed:** 2026-07-05 (Coach Office Room v1: Shell + Resolvers, Step 0).
**Provenance (all shipped assets below):** AI-generated for SquadVault (ChatGPT render,
Coach Office asset pack, 2026-06-29); no third-party IP in shipped assets.

The repo carries ONLY the web-optimized webp derivative; the pristine PNG original
lives in the founder's asset folder (`SquadVault Images/`, untracked), never in the
web root - mirrors the W.2 Clubhouse asset pattern (`public/clubhouse/MANIFEST.md`).

## Interim hero (founder ruling, DECIDE lane)

Ship v1 on the INTERIM rustic-office render with master-drawn hotspot zones. The
clean CO-hero render upgrades this later with ZERO API change (same `masterSrc`
filename swap + zone re-tune in the manifest). Do NOT block the build on art.

## Shipped web derivative (repo: public/coach-office/) - provenance

Conversion tool: sharp 0.33.5 (`.webp({ quality: 88, effort: 6 })`, RGB, no alpha).
The source PNG is opaque; the master ships opaque RGB (no alpha channel), same as the
W.2 master.

| shipped webp | source PNG (asset folder) | source md5 | settings | dims | size |
|---|---|---|---|---|---|
| co_master_web.webp | ChatGPT Image Jun 29, 2026, 08_45_06 PM.png | 1b2dd743cbbe0128f555bb542a10488d | q88 effort6 RGB | 1447x1087 | 0.35 MB |

Derivative md5 (co_master_web.webp): 2282efa56f20975a2cc53524465eacb3

## CO-R4 clean verification (2026-07-05, visual)

The interim hero carries NO baked-in legible text, brand marks, logos, league facts,
or hard-coded jokes: the bulletin-board notes are BLANK, the framed photos are
blank/aged, there is no "EST" year and no signage. It passes CO-R4 and is in the
shippable set (not quarantined). All text (nameplate, board note, founding year 1984)
is a runtime data overlay - never baked.

## Room composition notes (interim art)

The interim render includes: snowy Tahoe window, executive desk, an OPEN ring box on
the desk, a bulletin/cork board (blank notes), blank framed photos, bookshelves (with
a small gold football on the upper-left shelf), fireplace, leather seating, whiskey
glass. It has NO dedicated glass trophy CASE - the trophy-case hotspot zone is
master-drawn over the bookshelf/football cluster for the interim; the clean CO-hero
upgrade adds a proper case. Final hotspot-zone coordinates live in the office room
manifest and are subject to the G3 founder eyeball.

## Not shipped

- `SquadVault Images/` (founder asset folder, untracked) - the pristine PNG originals
  and all non-chosen Coach Office / ring-box / trophy candidate renders. Provenance
  only; never shipped, never in the web root.
