# Session Brief — CO.3 / Phase 3: Coach Office Viewer Context

Date authored: 2026-07-04 (DECIDE session)
Session type: EXECUTE (Claude Code), two founder gates (⛔ Gate 1: branch reconciliation + plan; ⛔ Gate 2: diff review + merge)
Repo: frontend (weichert/squadvault-frontend), canonical clone /Users/steve/projects/squadvault-frontend
Plan reference: Coach Office sequence CO.1→CO.2→CO.2b landed on main (squash hashes per git log; ROADMAP rows may cite pre-squash branch hashes — verify at Step 1); PR #48 parked OPEN against main; RS.1 landed (2c91f8b)
Scope in one line: relationship-aware rendering of the Coach Office — what a visitor sees depends on who they are (owner, fellow member, commissioner, anonymous), reusing the existing getViewer() pattern.

## Kickoff

You are an EXECUTE session for SquadVault CO.3 (Coach Office Phase 3, viewer context). Read _observations/session_brief_2026_07_04_co3_viewer_context.md in full. Two-lane discipline: you execute; the founder adjudicates at the two ⛔ gates. Hard rules: frontend only; no schema/RLS/Supabase config changes; no new deps; no analytics (constitutional); canonical id "70985" in URLs, never a UUID; consent gates are law — nothing a member has not toggled ON may be shown to anyone else, and relationship-aware rendering may only ever narrow what is shown, never widen it; do NOT push or merge before the designated gate approvals.

## 1. Objective

Ship viewer-context rendering for the Coach Office surface. The landed CO.1–CO.2b office renders one view regardless of who is looking; CO.3 makes the surface relationship-aware across four viewer classes — owner (the coach whose office it is), fellow member (authenticated, different franchise), commissioner (authenticated, commissioner flag), and anonymous — such that: the owner sees their full office including any owner-only affordances the landed phases provide; members and the commissioner see a visiting view in which every personal element (image, voice, attributed words, and any consent-scoped content) appears only if the office's owner has the corresponding consent toggle ON; anonymous viewers see at most the public ceremonial shell with no personal content. Viewer resolution reuses getViewer(); consent state is read from the existing consent record — this unit adds no consent categories and no new data. The deliverable is the rendering logic plus its per-class code traces; the constitutional invariant is that context only ever narrows what renders relative to the owner's own view.

## 2. Inherited state + destack prerequisite

PR #48 (head feat/coach-office-phase3-viewer-context, base already retargeted to main) predates the Coach Office landing and still carries the phase1/phase2/phase2b original commits. Before any evaluation of its content: destack with git rebase --onto origin/main 72acad4 (the recorded original phase2b tip = 72acad451bb876fec15f5b3f7d29183b15fce64e — verify this hash exists and is phase2b's pre-rebase tip before using it; if it cannot be verified, STOP). Resolve nothing — if the rebase conflicts, STOP and report. After a clean destack: local test merge vs main; the staged list must contain only Phase-3-scoped files. Force-push only after the destack verifies clean (pre-authorized for this branch). #48's Files-changed view is unreliable until then; the local test merge is the only honest diff.

## 3. Stacked-squash hazard block (inherited verbatim from the 2026-07-02 landing)

Never gh pr merge --delete-branch mid-stack — it closes child PRs instead of retargeting them.
Reopening a closed child requires resurrecting its exact base branch name at its recorded tip.
After retargeting, the PR Files-changed view lies (merge-base artifact) — verify by local git merge --squash --no-commit test merge only.
Children carrying already-squashed originals genuinely conflict — destack with rebase --onto <main> <original-parent-tip> before merging.
Retarget children to main before deleting their base branch.

## 4. Procedure

Step 0 — Ritual. Pre-flight per landing instruction; HEAD recorded.
Step 1 — Destack + inventory (no new code). Execute §2. Then inventory what the destacked branch actually contains: files, components, the viewer-relationship model it implements (which viewer classes it distinguishes; how it resolves them; what it shows/hides per class), and its tsc state. Compare against the §1 objective and the Coach Office spec sequence in the repo's design docs — read them, cite them. [ADDED] Also verify the ROADMAP Coach Office rows against git: if CO.1/CO.2/CO.2b rows cite pre-squash branch hashes rather than the main squash hashes, record the discrepancy — the correction lands in this unit's Gate 2 ROADMAP commit, not a separate PR. Classify the branch: (i) current — implements §1 as specced, needs only completion/polish; (ii) partial — sound foundation, enumerated gaps; (iii) stale — superseded by the landed CO.1–2b surface such that restarting from main is cheaper. Present the classification with evidence, the consent-gate audit (does every rendered field respect the owner's consent toggles for non-owner viewers?), and the implementation plan for the chosen path.
⛔ Gate 1 — Founder adjudicates the fork and ratifies the plan. Nothing beyond the destack is committed before this gate.
Step 2 — Implement per the ratified path (on the existing branch if (i)/(ii); on a fresh branch off main if (iii), with #48 closed by founder decision in that case).
Step 3 — Prove. tsc clean; next build clean; code-traced behavior for all four viewer classes (owner / fellow member / commissioner / anonymous), each trace stating what is visible and citing the consent gate that permits it.
⛔ Gate 2 — Founder reviews diff; merge (feature commit(s) with founder-written messages via /tmp/msg.txt, no Co-Authored-By; ROADMAP.md row for CO.3 — plus the Step-1 hash corrections if found — in the same commit series; PR, CI green, gh pr merge --squash, NO --delete-branch; verify fresh main + deploy workflow; then branch cleanup last).

## 5. Verification honesty

No frontend test harness exists (open D-Q). Verification is tsc, build, per-viewer-class code traces at the gates, and founder prod verification post-deploy (at minimum: own office as owner, another member's office as commissioner, and an incognito visit).

## 6. Acceptance criteria

Destack verified by local test merge (Phase-3 files only) before any content work.
All four viewer classes traced; consent toggles strictly honored for every non-owner class; rendering only ever narrows.
ROADMAP row (and any hash corrections) included in the commit series; tsc/build/CI/deploy green; canonical id everywhere; no new deps.

## 7. Out of scope

Consent-page changes · members/office/nav surfaces beyond the coach-office components · D-Q · the /auth/login prerender env finding (registered, separate) · new consent categories · any engine-repo changes.
