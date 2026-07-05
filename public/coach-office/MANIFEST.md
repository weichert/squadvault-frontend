# Coach Office - Asset Manifest

**Clean CO-hero landed:** 2026-07-05 (Coach Office Room v1; G3 cleared, interim superseded).
**Provenance (all shipped assets below):** AI-generated for SquadVault (ChatGPT render,
Coach Office asset pack); no third-party IP in shipped assets.

The repo carries ONLY the web-optimized webp derivative; the pristine PNG original lives
in the founder's asset folder (`SquadVault Images/`, gitignored), never in the web root -
mirrors the W.2 Clubhouse asset pattern (`public/clubhouse/MANIFEST.md`).

## Hero lineage (founder rulings, DECIDE lane)

- v1 shipped INTERIM on the rustic render `08_45_06` (Jun 29) with master-drawn zones.
- 2026-07-05 (post-G3): swapped to the CLEAN CO-hero re-render `10_50_46` (text-free,
  CO-R4 clean, consistent textures, with a real illuminated glass trophy case + blank
  nameplate/board surfaces). ZERO API change: same `masterSrc` filename, zones retuned.

## Shipped web derivative (repo: public/coach-office/) - provenance

Conversion tool: sharp 0.33.5 (`.webp({ quality: 88, effort: 6 })`, RGB, no alpha).
The source PNG is opaque; the master ships opaque RGB (no alpha), same as the W.2 master.

| shipped webp | source PNG (asset folder) | source md5 | settings | dims | size |
|---|---|---|---|---|---|
| co_master_web.webp | ChatGPT Image Jul 5, 2026, 10_50_46 AM.png | 8df89858ba451c7ef6048b6c431a614d | q88 effort6 RGB | 1448x1086 | 0.21 MB |

Derivative md5 (co_master_web.webp): 348414b16ddacff1a21fa0e7bafa32a5

Superseded provenance (no longer shipped): interim hero `ChatGPT Image Jun 29, 2026,
08_45_06 PM.png` (md5 1b2dd743cbbe0128f555bb542a10488d), which had bookshelves + a loose
football in place of a proper trophy case and less consistent textures. Retained in the
asset folder as provenance.

## CO-R4 clean verification (2026-07-05, visual)

The clean CO-hero carries NO baked-in legible text, brand marks, logos, league facts, or
hard-coded jokes: the desk nameplate plaque, the top wall plaque, the whiteboard, and the
framed boards/photos are all BLANK; the crystal award reads blank; there is no "EST" year
and no signage. It passes CO-R4 and is in the shippable set (not quarantined). All text
(nameplate, board note) is a runtime data overlay - never baked.

## Room composition notes (clean CO-hero)

Includes: snowy Tahoe lake window (left), executive desk + tufted leather chair, an OPEN
ring box with a full ring set (desk, foreground-right), a blank desk NAMEPLATE plaque
(desk, front-left), a blank whiteboard + a blank wall plaque + a blank framed board
(center wall) as board surfaces, framed team photos + books + helmet + small football
figure on the credenza, and a real illuminated GLASS TROPHY CASE (right) holding footballs,
cups, a helmet, a crystal bowl, and a blank crystal award. No fireplace (that is the
Clubhouse great-room). Trophy-case-as-ambient-art ruling stands: the case is decor; the
coach's REAL trophies render in the trophy modal, not composited onto the shelves.

Hotspot-zone coordinates live in `hotspots.json` (retuned to this render; left->right
spatial walk = office_board, championship_ring_box, trophy_case) and remain subject to the
founder eyeball.

## Not shipped

- `SquadVault Images/` (founder asset folder, gitignored) - the pristine PNG originals
  (clean CO-hero + superseded interim + all non-chosen candidates). Provenance only; never
  shipped, never in the web root.
