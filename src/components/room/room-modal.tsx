// src/components/room/room-modal.tsx
// Room-agnostic pending-state modal. Reuses the Coach Office accessible-dialog
// pattern verbatim (role="dialog"/aria-modal, focus moves to Close on open, Escape
// and backdrop close, Tab trapped within the dialog, focus restored to the trigger
// on close). Presents a title + a dignified body line - never a dead end.
"use client";

import { useEffect, useRef } from "react";

export function RoomModal({
  title,
  body,
  onClose,
}: {
  title: string;
  body: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab") {
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
        aria-label={title}
        className="vault-card w-full"
        style={{ maxWidth: 420, background: "var(--vault-s1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            className="font-ceremonial font-light text-vault-text"
            style={{ fontSize: "1.4rem", letterSpacing: "0.02em" }}
          >
            {title}
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
        <p className="font-ui text-sm text-vault-text2 mt-4 leading-relaxed">
          {body}
        </p>
      </div>
    </div>
  );
}
