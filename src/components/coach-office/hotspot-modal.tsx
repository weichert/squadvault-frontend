// src/components/coach-office/hotspot-modal.tsx
// Coach Office modal. Opened when a hotspot is activated; shows the hotspot's manifest
// label and either a provided content body (Phase 2 personalized hotspots) or a
// "coming soon" placeholder (hotspots without content yet). Accessible dialog:
// role="dialog"/aria-modal, focus moves to Close on open, Escape and backdrop close it,
// Tab is trapped within the dialog, and focus is restored to the trigger on close.
//
// Phase 3: an optional `viewerContext` is threaded in for future relationship-aware
// surfaces. It does NOT change what is rendered - the only use here is a neutral,
// debug-safe `data-viewer-relationship` attribute on the dialog root. No content is
// gated, shown, or hidden by it.
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Hotspot } from "@/lib/coach-office/types";
import type { CoachOfficeViewerContext } from "@/lib/coach-office/viewer-context";

export function HotspotModal({
  hotspot,
  content,
  viewerContext,
  onClose,
}: {
  hotspot: Hotspot;
  content?: ReactNode;
  viewerContext?: CoachOfficeViewerContext;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Remember the element that had focus so it can be restored on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        // Minimal focus trap: keep Tab / Shift+Tab within the dialog.
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{ background: "rgba(0, 0, 0, 0.6)", zIndex: 60 }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={hotspot.label}
        data-viewer-relationship={viewerContext?.relationship}
        className="vault-card w-full"
        style={{ maxWidth: 420, background: "var(--vault-s1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: "1.4rem", letterSpacing: "0.02em" }}
          >
            {hotspot.label}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="font-mono text-vault-text3 hover:text-vault-text2 transition-colors"
            style={{
              fontSize: "10px",
              letterSpacing: "0.12em",
              minWidth: 44,
              minHeight: 44,
            }}
          >
            CLOSE
          </button>
        </div>
        {content ?? (
          <p className="font-ui text-sm text-vault-text2 mt-4 leading-relaxed">
            This feature is coming soon.
          </p>
        )}
      </div>
    </div>
  );
}
