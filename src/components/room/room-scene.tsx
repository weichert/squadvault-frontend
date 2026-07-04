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
import { useEffect, useRef, useState } from "react";
import type { RoomBanner, RoomHotspot, RoomManifest, PlatePlacement } from "@/lib/room/types";
import { RoomModal } from "./room-modal";
import styles from "./room-scene.module.css";

// A few px of travel per depth band — subtle, per the brief ("<= a few px").
const PARALLAX_PX_PER_BAND = 4;

interface Props {
  masterSrc: string;
  masterAlt: string;
  manifest: RoomManifest;
  // template values for hrefs, e.g. { id: leagueCanonicalId } -> replaces {id}.
  params: Record<string, string>;
  // supplied at render time from data; never baked into the art.
  bannerText?: string;
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

function bannerStyle(banner: RoomBanner, manifest: RoomManifest): React.CSSProperties {
  return {
    left: pct(banner.zone.x, manifest.image_width),
    top: pct(banner.zone.y, manifest.image_height),
    width: pct(banner.zone.width, manifest.image_width),
    height: pct(banner.zone.height, manifest.image_height),
    justifyContent:
      banner.align === "left" ? "flex-start" : banner.align === "right" ? "flex-end" : "center",
  };
}

export function RoomScene({ masterSrc, masterAlt, manifest, params, bannerText }: Props) {
  const reduced = usePrefersReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null);

  // Mobile: the stage overflows the viewport; open centered on the fireplace.
  useEffect(() => {
    function center() {
      const vp = viewportRef.current;
      if (!vp) return;
      const overflow = vp.scrollWidth - vp.clientWidth;
      if (overflow > 0) vp.scrollLeft = overflow / 2;
    }
    center();
    window.addEventListener("resize", center);
    return () => window.removeEventListener("resize", center);
  }, []);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduced) return;
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

            {/* Plates: transparent objects at their in-scene positions, parallaxed
                by depth band (static under reduced-motion). */}
            {plateHotspots.map((h) => (
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

            {/* Banner: runtime text surface (from data, never baked). */}
            {bannerText && manifest.banner && (
              <div className={styles.banner} style={bannerStyle(manifest.banner, manifest)}>
                <span
                  className={`${styles.bannerText} font-ceremonial`}
                  style={{ textAlign: manifest.banner.align }}
                >
                  {bannerText}
                </span>
              </div>
            )}

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
          </div>
        </div>
        <div className={`${styles.edgeHint} ${styles.edgeHintLeft}`} aria-hidden="true" />
        <div className={`${styles.edgeHint} ${styles.edgeHintRight}`} aria-hidden="true" />
      </div>

      {modal && (
        <RoomModal title={modal.title} body={modal.body} onClose={() => setModal(null)} />
      )}
    </main>
  );
}
