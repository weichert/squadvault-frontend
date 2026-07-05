# W.2 Clubhouse - Asset Manifest

**Master locked:** 2026-06-20. **Organized/adjudicated:** 2026-07-04 (founder gate W-1..W-8).
**Provenance (all shipped assets below):** AI-generated for SquadVault, W.2 render
pack v3 Tahoe, master locked 2026-06-20; no third-party IP in shipped assets.

Canonical assets are named `w2_master.png` / `w2_plate_NN_*.png` and live at this
folder root. Non-shipped material is under `unused/` (never deleted - provenance).
No git operations performed; the build brief's Step 0 lands these into
`public/clubhouse/`.

## Shipped canonical assets

| File | Dimensions | Notes |
|---|---|---|
| `w2_master.png` | 3344x1882 | The locked master (Tahoe great-room). Blank banner (runtime text layer). See ruling R1 (laptop-dark). |
| `w2_plate_01_trophy_case.png` | 1622x2624 | Tall 2-door case (family B, master-left-case shape). **Background knockout PENDING pre-ship** (rendered on gray); flag halos rather than ship. |
| `w2_plate_01_trophy_case_empty.png` | 551x746 | Empty-state variant. **NOT truly transparent - RGB with a BAKED checkerboard** (no alpha channel); needs a real transparent knockout/re-render before use. |
| `w2_plate_02_mantel.png` | 2499x806 | Mantel beam + empty frames/polaroids (transparent). |
| `w2_plate_03_corkboard.png` | 2187x1428 | Corkboard, blank notes, aged-brass pins (transparent). 2 dup copies -> unused/. |
| `w2_plate_04_boombox.png` | 2094x1357 | Vintage twin-cassette boombox (transparent). |
| `w2_plate_05_safe.png` | 1721x1384 | Aged safe, brass dial (ticks, no numerals - passes CO-R4 spirit). Background **KNOCKED OUT to transparent 2026-07-04** (corner flood-fill + 1px erode/feather; verified clean: corners/edges alpha=0, 0 leftover white islands, ~0.004% fringe, no holes). Pristine white-bg original at `unused/W2_plate_05_safe_chosen_pre_knockout.png`. |
| `w2_plate_08_phone.png` | 1024x1536 | Black cordless phone. **CROSS-USE** (see R3): copied from the Coach Office folder; shared asset, still in CO manifest. **TRANSPARENCY DEFECT: source is RGB with a BAKED checkerboard** (no alpha) - needs a real transparent knockout/re-render before layering. |
| `w2_plate_09_answering_machine.png` | 1448x1086 | Black answering machine (pending/unlit intent). **CROSS-USE** (see R3): copied from the Coach Office folder; shared asset, still in CO manifest. Small red indicator accepted under R3. **TRANSPARENCY DEFECT: source is RGB with a BAKED checkerboard** (no alpha) - needs a real transparent knockout/re-render before layering. |
| `w2_plate_10_hearth.png` | 1185x1312 | Stone hearth, faint embers (still state). See ruling R2 (embers). Ambient-fire is a later animated layer built on top. |

## Pending render (ChatGPT queue - not yet produced)

- `w2_plate_06_guitar.png` - **RE-RENDER required.** Both prior candidates failed
  the checklist twice (amp added vs the master's no-amp corner guitar + legible
  amp-panel text/maker logo). Both moved to `unused/`. Render a no-amp sunburst
  guitar matching the master, transparent background, no text/logos.
- `w2_plate_07_desk_lamp.png` - **MISSING everywhere** (desk + green banker's lamp
  combined). No isolated plate exists in any folder; render fresh to match the
  master's foreground-left desk.

## Transparency audit (2026-07-04, programmatic)

`hasAlpha=yes` only means an alpha channel exists; below is the true transparent-
pixel fraction. Baked-checkerboard files render "transparent" in previews but are
opaque RGB and would layer a checkerboard into the room.

- REAL transparent: mantel 45%, boombox 22%, safe 19.8% (knockout), corkboard
  3.2% (margin), hearth 5.6% (corners).
- **NEEDS TRUE KNOCKOUT/RE-RENDER** (no real alpha): `w2_plate_01_trophy_case`
  (RGBA but 0% - gray bg opaque), `w2_plate_01_trophy_case_empty` (RGB baked),
  `w2_plate_08_phone` (RGB baked), `w2_plate_09_answering_machine` (RGB baked).
- master is intentionally opaque RGB.

## Deliberate rulings recorded (founder-ratified 2026-07-04)

- **R1 - laptop-dark:** the master's laptop renders open with a dark/off screen.
  The lock's governance log records "laptop rendered closed/dark"; a dark screen
  satisfies the intent (no screen content, no IP). Do NOT re-render over the master.
- **R2 - embers:** `w2_plate_10_hearth` keeps a faint ember glow. A great-room
  hearth reads dead when fully cold; faint embers are the accepted still state and
  the ratified ambient-fire layer builds on them naturally. Deliberate deviation
  from the brief's "still" wording, founder-ratified.
- **R3 - cross-use:** `w2_plate_08_phone` and `w2_plate_09_answering_machine` are
  the isolated black plates from the Coach Office folder. They match the master's
  foreground objects and pass the checklist. One file serves two rooms; they remain
  listed in the CO manifest as shared assets.

## Open founder eyeball

- **Owl motif (master, center-frame side table):** provisional ruling = lodge decor
  (stays, charming). If on eyeball it reads as an AI watermark artifact, flag it and
  the region gets patched later.

## Not shipped

- `unused/` - non-chosen candidates & alternates (master twin `Main Room2.png`;
  trophy family A + B alternates; safe alt; both guitar candidates; corkboard dups;
  `W2_plate_05_safe_chosen_pre_knockout.png` - the safe's pristine white-bg original).
- `unused/reference_ip/` - `ot02.webp`, `ot07.webp`: **third-party reference
  photography (c)VanceFox.com. NEVER ship. Never train/prompt verbatim from.**
- `unused/iterations/` - 49 pre-lock master/room iterations (photoreal + painterly),
  including drafts with baked "Est. 1985"/"Est. 1905" banner text. Provenance only,
  never shipped. Canonical league founding year is **1984** (CO-SPEC ratification
  2026-07-04); the shipped master's banner is blank (runtime text).

## Spec / provenance docs (folder root, retained)

`W2_Next_Session_Brief_Object_Plates.md`, `W2_Render_Prompt_Pack.md` /`(1)`/`_v3_Tahoe.md`,
`SquadVault_Completion_Plan_v1_2_2026_06_19.md`,
`SquadVault_Clubhouse_Design_Brief_v2_Addendum.docx`, `squadvault_w2_clubhouse_asset_pack.zip`.

## Shipped web derivatives (repo: public/clubhouse/) — provenance

The repo carries ONLY the web-optimized webp derivatives; the pristine PNG
originals live in the founder's asset folder (this MANIFEST's home), never in the
web root. Each derivative below records source file, source md5, and conversion
settings for reproducibility.

Conversion tool: Pillow 10.2 (WEBP, method=6). Master = lossy quality=88 (RGB, no
alpha). Plates = lossy quality=90 with the alpha channel preserved LOSSLESS.

Plate alpha verification (post-conversion, per G1 rider 2): alpha bit-exact
(mean |Δα| = 0.000 for every plate), transparent→opaque leak = 0 (no checkerboard
reintroduction), edge semi-alpha pixel counts identical to source; visually
indistinguishable.

| shipped webp | source PNG (asset folder) | source md5 | settings | size |
|---|---|---|---|---|
| w2_master_web.webp | w2_master.png | 907aeddfb90b3a54f44f529b4ef82c8c | q88 method6 RGB | 0.42 MB |
| w2_plate_02_mantel.webp | w2_plate_02_mantel.png | a59238744789df768ebfd84e7461dc06 | q90 method6 α-lossless | 0.17 MB |
| w2_plate_03_corkboard.webp | w2_plate_03_corkboard.png | 4ba83b5dc37bb8c7001da0ed27c6b1ed | q90 method6 α-lossless | 0.70 MB |
| w2_plate_04_boombox.webp | w2_plate_04_boombox.png | 922c9670412fd746cec30caad0a28f20 | q90 method6 α-lossless | 0.39 MB |
| w2_plate_05_safe.webp | w2_plate_05_safe.png (knockout) | 8165081347220c75f5e2ca1c6edee9fb | q90 method6 α-lossless | 0.33 MB |
| w2_plate_10_hearth.webp | w2_plate_10_hearth.png | 10169e18f48d646a5c75c018d9f2c624 | q90 method6 α-lossless | 0.10 MB |

Runtime web payload total: ~2.0 MB (was ~16.9 MB as PNG). Excluded from the repo
(checkerboard/opaque defect, awaiting re-render): trophy_case (01) + empty, phone
(08), answering_machine (09). Their hotspots draw on the master until clean plates land.
