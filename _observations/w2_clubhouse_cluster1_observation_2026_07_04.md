# Observation - W.2 Clubhouse Cluster 1 (the room): shipped

Date: 2026-07-04. Unit: W.2 Clubhouse Cluster 1. Squash-merged as `b63e8da` (PR #62).
ROADMAP W.2 row set to `b63e8da` in the follow-on docs PR.

## What shipped

A navigable illustrated Clubhouse at `/league/[id]/clubhouse`: the locked Tahoe
master (webp) as a full-bleed room, seven manifest-driven hotspots, and a runtime
banner. Room-agnostic `RoomScene` / `RoomModal` (the Coach Office room reuses them,
no fork). Additive CLUBHOUSE nav (first public tab). Keyboard + aria; reduced-motion
honored. tsc / vitest 47/47 / build green (Node 24, NODE_ENV=production); CI green.

Commit series on the branch (squashed into `b63e8da`):
- `4f5a72d` brief; `6f327f5` assets; `ec3172d` components + route + nav; `9dbb46c` roadmap row.
- `763e3a6` G3 remediation (master-only v1); `1208119` brief amendment (R4).
- `cd3fed7` curved SVG banner (textPath + room-light gradient + fabric integration).
- `ae6878b` hotspot trim (drop 4 inert) + laptop -> league home.
- `ff7a668` mobile banner reads at rest (B4).

## Deltas from the DECIDE brief (what changed during execution)

1. **Master-only v1, not layered parallax.** G3 failed: the plate layers were
   independent renders, not pixel-registered cutouts of the master, so they
   misregistered / doubled / occluded. Remediated to master-only; the parallax
   machinery is KEPT behind `SCENE_PLATES_ENABLED=false`. See the brief Amendment Log.
2. **Seven hotspots, not ten.** The four inert hover-only character objects
   (phone, guitar, boombox, hearth) were dropped (founder-adjudicated) so every
   hotspot has a destination or a dignified pending. The coffee-table laptop was
   added as a route to the league home (`/league/[id]`).
3. **Banner is a curved SVG textPath, not a flat CSS tilt.** It sits on the cloth
   (a "smile" baseline + a right-side-up rotation measured against the master),
   with a top-lit gradient fill and fabric integration (the cloth's own luminance,
   sampled from the master and masked to the glyph shapes, blended soft-light) so
   the letters take on the banner's folds/shadow rather than reading as typed on
   top. Geometry + effects live in the manifest (`hotspots.json` banner); text is
   still data-driven from getLeague, never baked. Reads at rest on mobile (the
   at-rest crop centers on the focal point; mobile font trimmed a few px).

## Known hazards / carried forward

- **Silhouette glow + lift is a follow-on unit ("Active Objects").** The object-
  outline glow + hover lift needs registered alpha cutouts, which need AI matting
  (local color/edge matting fails on this dim art - verified, ~19% coverage). The
  seven zones ship with rectangular glow until then. Prove one object before all.
- The excluded checkerboard-defect plates (trophy/phone/answering) and the kept-but-
  disabled plates still live in `public/clubhouse/` with MANIFEST provenance; they
  are NOT scene layers today. Any future parallax must derive cutouts from master
  pixels (alpha mattes), not independent renders (the G3 lesson).
- Vercel preview has Deployment Protection (anon 302 -> SSO); the live room render
  was founder-verified on-device, not scraped.

## Next

Active Objects unit (see the founder-adjudicated decisions): silhouette glow + lift
via AI-matted registered cutouts, opened with a one-object proof. Off this branch.
