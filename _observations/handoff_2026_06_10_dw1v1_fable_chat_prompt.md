# Handoff record - Fable chat prompt to rule D-W1-V1

Authored: 2026-06-10. Type: handoff record (the verbatim chat prompt that starts the
Fable DECIDE session for decision-gate D-W1-V1). Companion to the decision-readiness
brief `_observations/session_brief_2026_06_10_dw1v1_large_file_ingest_decision.md`.

This file is the durable record of the handoff; the prompt below is pasted into the
claude.ai Fable project to start the session. Per charter section 4, the chat prompt
points AT the brief + ledgers and does not duplicate them; the HEAD hashes here are the
authority (chat artifacts are write-only to git).

Verified HEADs at authoring: frontend `weichert/squadvault-frontend` main = `65f30db`
(PR #7); engine `weichert/squadvault` main = `ced7884`. VERIFY before pasting; if git
disagrees, git wins (stale-brief hazard).

Usage notes:
- Assumes the brief is reachable in the chat project's knowledge corpus. If the repo is
  not indexed there, paste the brief body alongside the prompt - but keep the HEAD
  hashes above as the authority.
- M1 is the gating empirical unknown and chat cannot run it. To get an UNCONDITIONAL
  ruling, run M1 first (a short Opus/Claude Code diagnostic session) and bring the
  result into chat; otherwise Fable rules a decision-tree conditional on M1.

---

```
SESSION: DECIDE — rule decision-gate D-W1-V1 (A/V Room large-file video ingest)
Model/tool: Fable, this chat project. This is constitutional/spec work, NOT an
execution session — it produces a ruling memo that later Opus/Claude Code sessions
obey, and no code.

VERIFIED GROUND TRUTH (do not trust memory or a prior chat message over this):
- Frontend (weichert/squadvault-frontend) main = 65f30db (PR #7).
- Engine   (weichert/squadvault)          main = ced7884 (STATE.md current).
- Both ledgers agree: W.1 video-ingest hardening (D1/D2/D3) is MERGED — it made the
  Supabase 50 MB per-file cap HONEST, it did NOT raise it. Large-file ingest is
  blocked on THIS gate.

START PROTOCOL: read the charter + STATE.md/ROADMAP from project knowledge, then read
the decision-readiness brief
  _observations/session_brief_2026_06_10_dw1v1_large_file_ingest_decision.md
Verify its claims against the HEADs above; if anything conflicts, git wins — flag it
before ruling (stale-brief hazard, 7+ recurrences).

THE DECISION: real video above 50 MB cannot ingest today. Pick ONE remedy:
- A — raise the Supabase per-file cap (founder dashboard; keeps spec 5.1, no code).
  Caveat: the server passthrough buffers the whole file in memory inside the
  serverless function, so it has ceilings the cap-raise does NOT remove (platform
  request-body limit, function memory + duration). Whether A clears the real corpus
  is EMPIRICAL — measurement M1 in the brief.
- B — client-direct-to-storage upload (bytes bypass the function; the only remedy
  that truly scales). DEVIATES from spec 5.1 ("passes THROUGH this server route"),
  so it needs a founder-approved spec 5.1 amendment + an insert-after-upload reorder
  + a storage-policy review.

EMPIRICAL INPUT THE RULING NEEDS (chat cannot run this):
- M1: with the cap temporarily raised on the live deployment, attempt the real .MOV
  (and a deliberately larger file); record whether/where it fails. One result can
  eliminate A outright.
- M2: capture the exact original 400 (D2 now surfaces a distinguishable reason).
These are founder/Claude-Code diagnostic steps. If M1 has not been run, the session's
first move is to specify it precisely and either request it before ruling, or rule a
decision-tree CONDITIONAL on its outcome.

THIS SESSION MUST OUTPUT (the ruling memo):
1. A binary pick — A or B — or an explicit decision tree keyed to M1
   (e.g. "A if the real corpus + headroom clears M1; else B").
2. The constitutional call: is amending spec 5.1 acceptable in principle for B's
   scaling benefit, or is the passthrough invariant load-bearing enough to prefer A's
   capped honesty? Name the reasoning.
3. If A: the new honest ceiling MAX_UPLOAD_BYTES should become.
4. If B: the dated, append-only spec 5.1 amendment text, plus a one-paragraph
   execution scope (insert/upload reorder, orphan reaping, storage-policy review vs
   league_media_commissioner_insert, D3 poster survives) to hand to a later
   Opus/Claude Code execution brief per charter section 5.

GUARDRAILS:
- Do not invent options beyond A/B as framed; do not re-litigate the gate.
- Silence over speculation: if M1 is unknown, gate on it — do not assume A works.
- No engagement/optimization framing.
- Write the output as law: dated, carrying the gate ID D-W1-V1.
```
