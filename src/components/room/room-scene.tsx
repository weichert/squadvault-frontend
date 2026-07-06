// src/components/room/room-scene.tsx
// Room-agnostic layered scene (W.2 Cluster 1 full build). Renders a master base
// layer, transparent object plates at their in-scene positions with input-driven
// parallax, an optional runtime banner text surface, and hotspots wired to routes,
// dignified pending modals, or inert character objects. Reduced-motion falls back
// to static. On mobile the stage becomes a horizontally pannable vertical crop.
//
// This component is deliberately room-agnostic (props: master asset, manifest,
// param map, banner text) so the Coach Office room reuses it without a fork. Only
// the Clubhouse instantiates it in this unit. No coordinate literal lives here -
// everything comes from the manifest.
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RoomBanner, RoomHotspot, RoomManifest, PlatePlacement } from "@/lib/room/types";
import { RoomModal } from "./room-modal";
import styles from "./room-scene.module.css";

// A few px of travel per depth band — subtle, per the brief ("<= a few px").
const PARALLAX_PX_PER_BAND = 4;

// v1 ships MASTER-ONLY (G3 remediation 2026-07-04). The layered plates were
// independent renders, not pixel-registered cutouts of the master's objects, so
// they misregistered / doubled / occluded. Plates are removed from the scene here
// (they stay in public/clubhouse/ to serve as modal detail views later). The
// parallax machinery below is intentionally KEPT but ships disabled - it turns on
// only when registered cutout plates (alpha mattes derived from master pixels)
// land in a follow-on unit. Flip this to re-enable.
const SCENE_PLATES_ENABLED: boolean = false;

interface Props {
  masterSrc: string;
  masterAlt: string;
  manifest: RoomManifest;
  // template values for hrefs, e.g. { id: leagueCanonicalId } -> replaces {id}.
  params: Record<string, string>;
  // supplied at render time from data; never baked into the art.
  bannerText?: string;
  // resolver-driven modal bodies keyed by a `detail` hotspot's contentKey. The room is
  // agnostic to what these nodes are - it just renders the one whose key was clicked.
  content?: Record<string, ReactNode>;
  // Optional foreground overlay layer composited over the master, room-agnostically (the
  // Trophy Hall passes its zone-anchored trophy-object gallery here; the Clubhouse and Coach
  // Office pass nothing, so their render is byte-identical). Additive, no fork.
  objects?: ReactNode;
}

function pct(value: number, extent: number): string {
  return `${(value / extent) * 100}%`;
}

function resolveHref(href: string, params: Record<string, string>): string {
  return href.replace(/\{(\w+)\}/g, (_m, key: string) => params[key] ?? `{${key}}`);
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true); // SSR-safe default: no motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function plateStyle(
  plate: PlatePlacement,
  manifest: RoomManifest,
  offset: { x: number; y: number },
  depthBand: number,
  reduced: boolean,
): React.CSSProperties {
  const travel = reduced ? 0 : PARALLAX_PX_PER_BAND * (depthBand + 1);
  return {
    left: pct(plate.x, manifest.image_width),
    top: pct(plate.y, manifest.image_height),
    width: pct(plate.width, manifest.image_width),
    height: "auto",
    zIndex: 10 + depthBand,
    ["--px" as string]: `${-offset.x * travel}px`,
    ["--py" as string]: `${-offset.y * travel}px`,
  };
}

function zoneStyle(hotspot: RoomHotspot, manifest: RoomManifest): React.CSSProperties {
  return {
    left: pct(hotspot.zone.x, manifest.image_width),
    top: pct(hotspot.zone.y, manifest.image_height),
    width: pct(hotspot.zone.width, manifest.image_width),
    height: pct(hotspot.zone.height, manifest.image_height),
  };
}

// The curved banner text is anchored along its path per `align`: center pins the
// midpoint of the string to the path midpoint; left/right pin the respective end.
function bannerAnchor(align: RoomBanner["align"]): { anchor: "start" | "middle" | "end"; offset: string } {
  if (align === "left") return { anchor: "start", offset: "0%" };
  if (align === "right") return { anchor: "end", offset: "100%" };
  return { anchor: "middle", offset: "50%" };
}

// Room-light gradient FILL for the glyphs: a warm highlight along the letter tops
// fading to a bronze shadow at the bottoms, so the overhead light reads on whatever
// text a league supplies. `light` (0-100) scales the highlight/shadow spread.
const BANNER_GOLD = "#e8d8a8"; // base gold (midtone)
function bannerGradient(light: number): { hi: string; lo: string } {
  const base: [number, number, number] = [232, 216, 168];
  const white: [number, number, number] = [255, 255, 255];
  const bronze: [number, number, number] = [107, 83, 38];
  const f = Math.max(0, Math.min(1, light / 100));
  const mix = (a: [number, number, number], b: [number, number, number], t: number): string => {
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  };
  return { hi: mix(base, white, 0.15 + f * 0.35), lo: mix(base, bronze, 0.15 + f * 0.5) };
}

export function RoomScene({ masterSrc, masterAlt, manifest, params, bannerText, content, objects }: Props) {
  const reduced = usePrefersReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // A pending modal carries a `body` line; a detail modal carries a `content` node.
  const [modal, setModal] = useState<
    { title: string; body?: string; content?: ReactNode } | null
  >(null);

  // Mobile: the stage overflows the viewport; open centered on the room's focal
  // point (the banner/fireplace, which sits right of the image middle) so the full
  // banner reads in the initial crop with no pan. Desktop has no overflow -> no-op.
  const focusX = manifest.banner
    ? manifest.banner.rotate_origin.x / manifest.image_width
    : 0.5;
  useEffect(() => {
    function center() {
      const vp = viewportRef.current;
      if (!vp) return;
      const overflow = vp.scrollWidth - vp.clientWidth;
      if (overflow <= 0) return;
      const focusPx = focusX * vp.scrollWidth;
      vp.scrollLeft = Math.max(0, Math.min(overflow, focusPx - vp.clientWidth / 2));
    }
    center();
    window.addEventListener("resize", center);
    return () => window.removeEventListener("resize", center);
  }, [focusX]);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!SCENE_PLATES_ENABLED || reduced) return; // no plates -> nothing to parallax
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1..1
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setOffset({ x: nx, y: ny });
  }

  function handlePointerLeave() {
    setOffset({ x: 0, y: 0 });
  }

  const plateHotspots = manifest.hotspots.filter((h) => h.plate);

  return (
    <main style={{ background: "#14100c", minHeight: "100vh" }}>
      <div className={styles.roomFrame}>
        <div className={styles.viewport} ref={viewportRef}>
          <div
            ref={stageRef}
            className={styles.stage}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          >
            {/* Base layer: the locked master (web-optimized derivative). */}
            <img
              className={styles.master}
              src={masterSrc}
              alt={masterAlt}
              draggable={false}
            />

            {/* Plates: DISABLED in v1 (master-only). Kept behind the flag until
                registered cutout plates land; parallaxed by depth band when on. */}
            {SCENE_PLATES_ENABLED &&
              plateHotspots.map((h) => (
                <img
                  key={h.id}
                  className={styles.plate}
                  style={plateStyle(h.plate as PlatePlacement, manifest, offset, h.depth_band, reduced)}
                  src={(h.plate as PlatePlacement).src}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
              ))}

            {/* Banner: runtime text on a curved baseline that follows the painted
                cloth (from data, never baked). SVG textPath in the master's coord
                space, so it scales with the stage; the smile path + right-side-up
                rotation are tuned in the manifest against the art. */}
            {bannerText &&
              manifest.banner &&
              (() => {
                const b = manifest.banner;
                const { anchor, offset } = bannerAnchor(b.align);
                const grad = bannerGradient(b.light);
                const rotate = `rotate(${b.rotate_deg} ${b.rotate_origin.x} ${b.rotate_origin.y})`;
                const glyphFont = { fontFamily: "var(--font-ceremonial)", fontWeight: 500 } as const;
                const showFabric = b.fabric_blend !== "none" && b.fabric > 0;
                const pathId = "clubhouse-banner-path";
                const shadowId = "clubhouse-banner-shadow";
                const lightId = "clubhouse-banner-light";
                const maskId = "clubhouse-banner-mask";
                return (
                  <svg
                    className={styles.bannerSvg}
                    viewBox={`0 0 ${manifest.image_width} ${manifest.image_height}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{
                      ["--banner-fs" as string]: `${b.font_size}px`,
                      ["--banner-fs-mobile" as string]: `${b.font_size_mobile}px`,
                    }}
                    role="img"
                    aria-label={bannerText}
                  >
                    <defs>
                      <path id={pathId} d={b.text_path} fill="none" />
                      {/* overhead room light on the glyphs: top highlight -> bronze shadow */}
                      <linearGradient id={lightId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={grad.hi} />
                        <stop offset="42%" stopColor={BANNER_GOLD} />
                        <stop offset="100%" stopColor={grad.lo} />
                      </linearGradient>
                      <filter id={shadowId} x="-10%" y="-40%" width="120%" height="180%">
                        <feDropShadow
                          dx="0"
                          dy="1.5"
                          stdDeviation="2"
                          floodColor="#000"
                          floodOpacity="0.4"
                        />
                      </filter>
                      {/* the glyph shapes as a mask, so the cloth's own light/shadow
                          only paints ONTO the letters (fabric integration). */}
                      {showFabric && (
                        <mask
                          id={maskId}
                          maskUnits="userSpaceOnUse"
                          x="0"
                          y="0"
                          width={manifest.image_width}
                          height={manifest.image_height}
                        >
                          <g transform={rotate}>
                            <text
                              className={styles.bannerGlyph}
                              textAnchor={anchor}
                              letterSpacing={b.letter_spacing}
                              fill="#fff"
                              style={glyphFont}
                            >
                              <textPath href={`#${pathId}`} startOffset={offset}>
                                {bannerText}
                              </textPath>
                            </text>
                          </g>
                        </mask>
                      )}
                    </defs>
                    {/* isolate so the fabric overlay blends only with the text below
                        it, not the room behind the svg. */}
                    <g style={{ isolation: "isolate" }}>
                      <g transform={rotate}>
                        <text
                          className={styles.bannerGlyph}
                          textAnchor={anchor}
                          letterSpacing={b.letter_spacing}
                          fill={`url(#${lightId})`}
                          filter={`url(#${shadowId})`}
                          style={glyphFont}
                        >
                          <textPath href={`#${pathId}`} startOffset={offset}>
                            {bannerText}
                          </textPath>
                        </text>
                      </g>
                      {showFabric && (
                        <image
                          href={masterSrc}
                          x="0"
                          y="0"
                          width={manifest.image_width}
                          height={manifest.image_height}
                          mask={`url(#${maskId})`}
                          opacity={b.fabric / 100}
                          // narrowed: showFabric guarantees blend !== "none" (which
                          // is our disable sentinel, not a CSS mix-blend-mode value).
                          style={{ mixBlendMode: b.fabric_blend as "soft-light" | "overlay" | "multiply" }}
                        />
                      )}
                    </g>
                  </svg>
                );
              })()}

            {/* Hotspots: routes, dignified pending modals, or inert fixtures. */}
            {manifest.hotspots.map((h) => {
              if (h.wiring.type === "route") {
                return (
                  <Link
                    key={h.id}
                    className={styles.hotspot}
                    style={zoneStyle(h, manifest)}
                    href={resolveHref(h.wiring.href, params)}
                    aria-label={h.aria_label}
                  />
                );
              }
              if (h.wiring.type === "pending") {
                const { title, body } = h.wiring;
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={styles.hotspot}
                    style={zoneStyle(h, manifest)}
                    aria-label={h.aria_label}
                    onClick={() => setModal({ title, body })}
                  />
                );
              }
              if (h.wiring.type === "detail") {
                // resolver-driven content modal: the body is the node the room was
                // handed for this hotspot's contentKey (never baked into the art).
                const { title, contentKey } = h.wiring;
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={styles.hotspot}
                    style={zoneStyle(h, manifest)}
                    aria-label={h.aria_label}
                    onClick={() => setModal({ title, content: content?.[contentKey] })}
                  />
                );
              }
              // inert: hover acknowledgment only, not a tab stop, decorative.
              return (
                <div
                  key={h.id}
                  className={styles.inert}
                  style={zoneStyle(h, manifest)}
                  aria-hidden="true"
                />
              );
            })}

            {/* Optional foreground object layer (Trophy Hall gallery). The wrapper is
                pointer-transparent so the nav hotspots underneath stay clickable; the
                gallery re-enables pointer events on its own interactive objects. Absent
                for the Clubhouse / Coach Office (byte-identical render). */}
            {objects && (
              <div style={{ position: "absolute", inset: 0, zIndex: 15, pointerEvents: "none" }}>
                {objects}
              </div>
            )}
          </div>
        </div>
        <div className={`${styles.edgeHint} ${styles.edgeHintLeft}`} aria-hidden="true" />
        <div className={`${styles.edgeHint} ${styles.edgeHintRight}`} aria-hidden="true" />
      </div>

      {modal && (
        <RoomModal title={modal.title} body={modal.body} onClose={() => setModal(null)}>
          {modal.content}
        </RoomModal>
      )}
    </main>
  );
}
