// src/components/ui/artifact-review.tsx
// Client component: artifact reading view, scroll-to-unlock, action buttons,
// identity-check prompts, trust bar. No toast notifications anywhere.
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface ArtifactReviewProps {
  artifactId: string;
  leagueId: string;
  content: string;
  artifactType: string;
  season: number | null;
  weekIndex: number | null;
  isDemo: boolean;
  version: number;
  trustBarText: string;
}

const IDENTITY_PROMPTS = [
  "Could this recap be about any league?",
  "Does it read like it knows this league?",
  "Are the facts right?",
  "Is the tone right?",
  "Would you be comfortable if a league member questioned this?",
];

export function ArtifactReview({
  artifactId,
  leagueId,
  content,
  artifactType,
  season,
  weekIndex,
  isDemo,
  version,
  trustBarText,
}: ArtifactReviewProps) {
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [action, setAction] = useState<"idle" | "approving" | "approved" | "withholding" | "withheld" | "requesting">("idle");
  const [showChangesNote, setShowChangesNote] = useState(false);
  const [changesNote, setChangesNote] = useState("");
  const [stamped, setStamped] = useState(false);
  const [firstApproval, setFirstApproval] = useState(false);
  const [showRecordOpen, setShowRecordOpen] = useState(false);
  const [pageFlash, setPageFlash] = useState(false);
  const [trustBarCertified, setTrustBarCertified] = useState(false);
  const [docketId, setDocketId] = useState<string | null>(null);
  const articleRef = useRef<HTMLDivElement>(null);

  // Auto-unlock if content fits without scrolling
  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 8) {
      setScrolled(true);
      setScrollProgress(100);
    }
  }, []);

  // Scroll tracking
  const handleScroll = useCallback(() => {
    const el = articleRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const progress = scrollHeight <= clientHeight
      ? 100
      : Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100));
    setScrollProgress(progress);
    if (progress >= 95) setScrolled(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (action !== "idle") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "a" && scrolled) handleApprove();
      if (e.key === "w" && scrolled) handleWithhold();
      if (e.key === "r" && scrolled) setShowChangesNote(true);
      if (e.key === "Escape") setShowChangesNote(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [action, scrolled]);

  async function handleApprove() {
    if (!scrolled || action !== "idle") return;
    setAction("approving");

    const res = await fetch(`/api/artifacts/${artifactId}/approve`, { method: "POST" });
    const data = await res.json();

    if (res.ok) {
      const isFirst = data.first_approval === true;
      setFirstApproval(isFirst);
      setStamped(true);
      if (navigator.vibrate) navigator.vibrate([80]);
      const delay = isFirst ? 700 : 500;
      setTimeout(() => {
        setTrustBarCertified(true);
        if (data.docket_id) setDocketId(data.docket_id);
        if (navigator.vibrate) navigator.vibrate([30]);
      }, delay);
      if (isFirst) {
        setPageFlash(true);
        setTimeout(() => setPageFlash(false), 400);
        setTimeout(() => setShowRecordOpen(true), delay + 200);
      }
      setAction("approved");
    } else {
      setAction("idle");
    }
  }

  async function handleWithhold() {
    if (!scrolled || action !== "idle") return;
    setAction("withholding");
    const res = await fetch(`/api/artifacts/${artifactId}/withhold`, { method: "POST" });
    if (res.ok) {
      setAction("withheld");
    } else {
      setAction("idle");
    }
  }

  async function handleRequestChanges() {
    if (!changesNote.trim()) return;
    setAction("requesting");
    const res = await fetch(`/api/artifacts/${artifactId}/request-changes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: changesNote }),
    });
    if (res.ok) {
      window.location.href = `/league/${leagueId}/office`;
    } else {
      setAction("idle");
    }
  }

  const label = artifactType === "WEEKLY_RECAP" && season && weekIndex
    ? `Season ${season} · Week ${weekIndex}`
    : artifactType.replace(/_/g, " ");

  return (
    <div className="max-w-6xl mx-auto px-8 py-14">
      {/* Breadcrumb */}
      <div className="mb-8">
        <a
          href={`/league/${leagueId}/office`}
          className="font-mono text-[9px] tracking-[0.12em] text-vault-text3 hover:text-vault-text2 transition-colors"
        >
          ← Commissioner Office
        </a>
      </div>

      <div className="flex gap-8 items-start">
        {/* Main article column */}
        <div className="flex-1 min-w-0">
          {/* Article header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span
                className="font-mono text-[9px] tracking-[0.12em] px-2 py-0.5 rounded-sm"
                style={{
                  background: isDemo ? "rgba(139,110,42,0.1)" : "rgba(74,124,89,0.1)",
                  color: isDemo ? "#8B6E2A" : "#4A7C59",
                  border: `1px solid ${isDemo ? "rgba(139,110,42,0.6)" : "rgba(74,124,89,0.6)"}`,
                }}
              >
                {isDemo ? "DEMO" : "DRAFT"}
              </span>
              <span className="font-mono text-[9px] tracking-[0.1em] text-vault-text3">
                Version {version}
              </span>
            </div>
            <h1 className="font-ceremonial font-light text-vault-text" style={{ fontSize: "2rem", letterSpacing: "0.02em" }}>
              {label}
            </h1>
          </div>

          {/* Article reading surface */}
          <div
            ref={articleRef}
            onScroll={handleScroll}
            className="relative overflow-y-auto rounded-sm"
            style={{
              background: "#1D1D23",
              border: "1px solid var(--vault-border)",
              maxHeight: "72vh",
              padding: "2.5rem",
              opacity: stamped ? 0.4 : 1,
              transition: "opacity 0.4s ease",
            }}
          >
            {/* Stamp overlay */}
            {stamped && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ zIndex: 10 }}
              >
                <div style={{ animation: `stampIn ${firstApproval ? "0.7s" : "0.5s"} cubic-bezier(.34,1.56,.64,1) forwards` }}>
                  <StampSVG />
                  {firstApproval && <ParticlesBurst />}
                </div>
              </div>
            )}

            <div className="prose-artifact">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </div>

          {/* Scroll progress indicator */}
          {!scrolled && (
            <div className="mt-2 flex items-center gap-3">
              <div
                className="flex-1 rounded-full overflow-hidden"
                style={{ height: 2, background: "var(--vault-border)" }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${scrollProgress}%`,
                    background: "var(--vault-gold-dim)",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>
              <span className="font-mono text-[9px] tracking-[0.1em] text-vault-text3 shrink-0">
                {scrollProgress}%
              </span>
            </div>
          )}

          {/* Trust bar */}
          <div className="mt-4">
            <div
              className="px-4 py-2.5 rounded-sm flex items-center justify-between"
              style={{
                border: trustBarCertified
                  ? "1px solid rgba(74,124,89,0.6)"
                  : "1px dashed rgba(138,132,120,0.4)",
                background: trustBarCertified ? "rgba(74,124,89,0.05)" : "transparent",
                transition: "all 0.4s ease",
              }}
            >
              <span
                className="font-mono text-[9px]"
                style={{
                  color: trustBarCertified ? "var(--vault-gold)" : "var(--vault-text3)",
                  letterSpacing: trustBarCertified ? "0.15em" : "0.4em",
                  transition: "all 0.4s ease",
                }}
              >
                {trustBarCertified
                  ? "Entered into the Record · Source Facts Verified · SquadVault"
                  : trustBarText}
              </span>
            </div>

            {/* Docket ID */}
            {docketId && (
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-[0.08em]" style={{ color: "var(--vault-gold)" }}>
                  {docketId}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar — identity prompts */}
        <div className="w-72 shrink-0">
          <div
            className="rounded-sm p-5"
            style={{ background: "#1D1D23", border: "1px solid var(--vault-border)" }}
          >
            <p className="font-mono text-[9px] tracking-[0.15em] text-vault-text2 mb-5">
              BEFORE YOU APPROVE
            </p>
            <ol className="space-y-4">
              {IDENTITY_PROMPTS.map((prompt, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="font-mono text-[9px] shrink-0 mt-0.5"
                    style={{ color: "var(--vault-gold-dim)" }}
                  >
                    {i + 1}.
                  </span>
                  <p className="font-ui text-sm text-vault-text leading-relaxed">{prompt}</p>
                </li>
              ))}
            </ol>

            {!scrolled && (
              <p className="font-mono text-[9px] tracking-[0.1em] text-vault-text3 mt-6 leading-relaxed">
                READ THE FULL ARTIFACT TO UNLOCK APPROVAL
              </p>
            )}
          </div>

          {/* Keyboard shortcuts hint */}
          {scrolled && action === "idle" && (
            <div className="mt-3 px-1">
              <p className="font-mono text-[8px] tracking-[0.08em] text-vault-text3">
                a · approve &nbsp; w · withhold &nbsp; r · request changes
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action zone — fixed to bottom, appears after full scroll */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "linear-gradient(to top, var(--vault-bg) 70%, transparent)",
          padding: "2rem 1.5rem 1.5rem",
          transform: scrolled && action === "idle" ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s ease",
          zIndex: 50,
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center gap-4 justify-end">
          <button
            onClick={() => setShowChangesNote(true)}
            className="vault-btn-secondary px-6 py-2.5"
            style={{ borderColor: "var(--vault-gold-dim)", color: "var(--vault-gold-dim)" }}
          >
            Request Changes
          </button>
          <button
            onClick={handleWithhold}
            className="vault-btn-secondary px-6 py-2.5"
            style={{ borderColor: "#8B3535", color: "#8B3535" }}
          >
            Withhold
          </button>
          <button
            onClick={handleApprove}
            className="vault-btn-approve px-8 py-2.5"
          >
            Approve
          </button>
        </div>
      </div>

      {/* Post-approval state */}
      {action === "approved" && showRecordOpen && (
        <div className="fixed bottom-8 left-0 right-0 flex justify-center pointer-events-none" style={{ zIndex: 50 }}>
          <p
            className="font-ceremonial font-light italic text-vault-text2"
            style={{ fontSize: "1.3rem", letterSpacing: "0.04em", animation: "fadeIn 0.6s ease forwards" }}
          >
            The record is open.
          </p>
        </div>
      )}

      {/* Page flash for first approval */}
      {pageFlash && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: "#1A1A1F", animation: "pageFlash 0.4s ease forwards", zIndex: 200 }}
        />
      )}

      {/* Withheld state */}
      {action === "withheld" && (
        <div className="fixed bottom-8 left-0 right-0 flex justify-center" style={{ zIndex: 50 }}>
          <div className="vault-card px-8 py-4 text-center">
            <p className="font-mono text-[9px] tracking-[0.15em] text-vault-text3 mb-2">WITHHELD</p>
            <p className="font-ui text-sm text-vault-text2">This artifact has been removed from the record.</p>
            <a
              href={`/league/${leagueId}/office`}
              className="font-mono text-[9px] tracking-[0.1em] text-vault-text3 hover:text-vault-text2 mt-3 block transition-colors"
            >
              ← Return to office
            </a>
          </div>
        </div>
      )}

      {/* Request changes modal */}
      {showChangesNote && (
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{ background: "rgba(11,11,14,0.85)", zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setShowChangesNote(false); }}
        >
          <div className="vault-card w-full max-w-md">
            <p className="font-mono text-[9px] tracking-[0.15em] text-vault-text3 mb-4">
              REQUEST CHANGES
            </p>
            <p className="font-ui text-sm text-vault-text2 mb-4 leading-relaxed">
              Describe what needs to change. This note is required and will be recorded.
            </p>
            <textarea
              value={changesNote}
              onChange={e => setChangesNote(e.target.value)}
              placeholder="What needs to change before this can be approved?"
              rows={4}
              className="w-full bg-vault-s2 border border-vault-border rounded-sm px-3 py-2.5 font-ui text-sm text-vault-text placeholder-vault-text3 focus:outline-none focus:border-vault-gold-dim transition-colors resize-none"
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => setShowChangesNote(false)}
                className="vault-btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestChanges}
                disabled={!changesNote.trim() || action === "requesting"}
                className="vault-btn-secondary px-4 py-2 text-sm"
                style={{ borderColor: "var(--vault-gold-dim)", color: "var(--vault-gold-dim)" }}
              >
                {action === "requesting" ? "Sending..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes stampIn {
          from { transform: scale(1.5) rotate(-12deg); opacity: 0; }
          to   { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .prose-artifact { color: var(--vault-text); font-family: var(--font-outfit); font-size: 17px; line-height: 1.85; }
        .prose-artifact h1 { color: var(--vault-text); font-family: var(--font-cormorant); font-size: 2rem; font-weight: 300; margin-bottom: 1.2rem; letter-spacing: 0.02em; }
        .prose-artifact h2 { color: var(--vault-text); font-family: var(--font-cormorant); font-size: 1.4rem; font-weight: 400; margin: 1.5rem 0 0.75rem; }
        .prose-artifact strong { color: var(--vault-text); font-weight: 600; }
        .prose-artifact p { margin-bottom: 1.1rem; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pageFlash { 0% { opacity: 0.6; } 100% { opacity: 0; } }
        @keyframes particle { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(var(--dx),var(--dy)) scale(0); opacity: 0; } }
      `}</style>
    </div>
  );
}

function ParticlesBurst() {
  const particles = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * 360;
    const dist = 60 + Math.random() * 40;
    const dx = Math.round(Math.cos((angle * Math.PI) / 180) * dist);
    const dy = Math.round(Math.sin((angle * Math.PI) / 180) * dist);
    return { dx, dy, delay: Math.random() * 0.15 };
  });
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#C9A84C",
            ["--dx" as string]: `${p.dx}px`,
            ["--dy" as string]: `${p.dy}px`,
            animation: `particle 0.8s ease-out ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

function StampSVG() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="80" cy="80" r="76" stroke="#C9A84C" strokeWidth="2.5" opacity="0.9" />
      <circle cx="80" cy="80" r="68" stroke="#C9A84C" strokeWidth="1" opacity="0.5" />
      <path
        d="M80 4 a76 76 0 0 1 0 152 a76 76 0 0 1 0 -152"
        fill="none"
        id="stamp-circle-path"
      />
      <text fill="#C9A84C" fontSize="9.5" letterSpacing="3.2" fontFamily="DM Mono, monospace" opacity="0.9">
        <textPath href="#stamp-circle-path" startOffset="8%">
          ENTERED INTO THE RECORD · SQUADVAULT ·
        </textPath>
      </text>
      {/* SV mark */}
      <text
        x="80" y="88"
        textAnchor="middle"
        fill="#C9A84C"
        fontSize="28"
        fontFamily="Cormorant Garamond, serif"
        fontWeight="300"
        opacity="0.9"
      >
        SV
      </text>
    </svg>
  );
}
