# Trophy Hall - Asset Manifest

**Landed:** 2026-07-05 (Trophy Hall room v1; G2 cleared, Step 3 build).
**Provenance (all shipped assets below):** AI-generated for SquadVault (ChatGPT renders,
Trophy Hall asset pack + the staged award plates); no third-party IP in shipped assets.

The repo carries ONLY the web-optimized webp derivatives; the pristine PNG originals live
in the founder's asset folder (gitignored / `~/Downloads`), never in the web root - mirrors
the W.2 Clubhouse + Coach Office asset pattern.

Conversion tool: sharp 0.33.5. Master: `.flatten({background:'#000'}).webp({quality:88,
effort:6})` -> opaque RGB (the room background, no alpha), same as the W.2 / CO masters.
Plates: `.webp({quality:90, effort:6, alphaQuality:100})` -> TRUE ALPHA preserved (CO-R4
knockouts from Trophy Images/staged/, verified true-alpha in staged/MANIFEST.md).

## Shipped web derivatives (repo: public/trophy-hall/)

| shipped webp | source PNG (asset folder) | source md5 | alpha | dims | size |
|---|---|---|---|---|---|
| th_master_web.webp | ChatGPT Image Jul 5, 2026, 06_40_35 PM.png | ff4113361f6928d736e787b04f25e273 | no (RGB) | 1672x941 | 0.29 MB |
| award_the_hammer.webp | Trophy Images/staged/award_the_hammer.png | 42ec907db9de58fd4b56c1d6244aca26 | yes | 1254x1254 | 0.23 MB |
| award_the_benchwarmer.webp | Trophy Images/staged/award_the_benchwarmer.png | 2a2c6898ccd08da4071ab75b6585e692 | yes | 1254x1254 | 0.23 MB |
| award_the_clairvoyant.webp | Trophy Images/staged/award_the_clairvoyant.png | 42f002a1df77468f8f2c0b1fa740cf7a | yes | 1254x1254 | 0.20 MB |

Derivative md5s: th_master_web 082ae34c239ce9b6b4aec46b22f05117 ; award_the_hammer
fd1e269c6566f3483595cfd415149e19 ; award_the_benchwarmer 161ed6558a73f62f9e740d82a5f7347c ;
award_the_clairvoyant 8be28199ed4c393253c70b200f322477.

## CO-R4 clean verification (2026-07-05, visual + staged provenance)

Master: the Tahoe hall carries NO baked legible text, brand marks, logos, or league facts -
the glass cases, the central marble plinth, and the window are all blank surfaces. All
trophy titles / winners / years overlay at RUNTIME from data (the gallery + overlay
manifest), never baked. Passes CO-R4.

Plates: the three award plates are text-free knockouts (staged/MANIFEST.md: nameplate BLANK,
runtime title overlay). The Oracle (award_id 9) has generated facts but PENDING sundial art;
the Hall renders it as a graceful text card until its plate lands (zero-API-change drop-in).

## Pending / follow-on art (not shipped here)

- Oracle sundial plate (award_the_oracle.webp) - text fallback until it lands.
- The broader 31-award illustrated set (parent display brief) - most awards render as text
  cards this cycle; illustrated plates drop in per-slug with zero API change as art lands.
- Clairvoyant crystal-ball imagery ruling + Oracle/Cavallini sundial re-check remain open
  founder rulings (carried from the generated-awards amendment section 7).

## Trophy Room "Living Room" pivot assets (landed 2026-07-07)

Two founder-LOCKED renders (source PNGs in ~/Downloads / asset folder, gitignored; only the
webp derivatives ship). Conversion: sharp 0.33.5 `.flatten({background:'#000'}).webp({quality:92,
effort:6})` -> opaque RGB (both are opaque interiors, no alpha), the established master pattern.

Rebuilt 2026-07-07 from the SAME founder-LOCKED source PNGs at quality 92 (was 88): a crisper
hero, and the fresh bytes force a clean CDN deploy (the prior q88 derivative was pixel-faithful to
the locked source -- meanAbsDiff 2.6/255 -- so this is a fidelity + cache-bust refresh, not a new
render). Prior webp md5s: tr_master 150fd37756e4dbd20d5e9352bea51e81 ; tr_case_frontal
9ae6dd3fee53aee8e4212b8448553501.

| shipped webp | source PNG | source md5 | dims | webp md5 | size |
|---|---|---|---|---|---|
| tr_master_web.webp | TR_master_LOCKED_candidate.png | 1bc92ab7d0cec63e0e86849052b1ddf6 | 1672x941 | 0bb7e7565f9b57f2dc00e1f39e13cb68 | 0.51 MB |
| tr_case_frontal_web.webp | TR_case_frontal_LOCKED_candidate.png | b7ce52f66be7f5ec62ea4f1f5bcf22a5 | 1122x1402 | fa088de10436c74970519ef0df7081e5 | 0.20 MB |

- **tr_master_web** — the ambient TROPHY ROOM (navigational scene). Six angled cases baked FULL of
  ambient league-register trophies; whiskey corner (ambient, no hotspot); empty central pedestal
  (the plinth); blank header plaque atop each case (the case-label home); blank lower panels; window
  focal point. CO-R4: verified clean (founder zoom-check + session visual re-check — plaques/panels
  blank, trophies carry no legible text/marks).
- **tr_case_frontal_web** — the frontal CASE VIEW. Straight-on; blank header plaque (category name);
  four lit glass shelves, each with a blank brass placard on its front edge; a base counter (the
  fifth display band); blank lower panel; wood-grain interior matching the master (green felt
  superseded — master consistency rules). CO-R4: verified clean (every plaque/placard blank).
- The prior empty-case master (th_master_web.webp) + the per-shelf `cases` geometry it drove are
  SUPERSEDED by this pivot (room = ambient scene, real trophies live in the Case View).
