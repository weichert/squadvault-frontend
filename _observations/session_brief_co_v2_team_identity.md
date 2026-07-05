Session Brief — CO v2: Team Identity (Logo)

Date: 2026-07-05 (DECIDE-authored). Foundation: Coach Office Room v1 shipped 936a8ee. Gates: ⛔ G1 architecture + capture design · ⛔ G2 tests · ⛔ G3 diff + eyeball. Repo: frontend.

## Kickoff

> You are the EXECUTE session for CO v2 Team Identity. Read this brief, then: _observations/session_brief_coach_office_room_v1.md (shipped v1), docs/coach_office/RATIFICATION_MEMO_2026_07_04.md (CO-R1..R4), the onboarding/consent flow (member-consent-panel and the onboarding route), the shipped CO Room v1 (office manifest, RoomScene detail wiring, nameplate overlay pattern in the office page), and the franchises data model (resolveCoachOfficeProfile, owner_display_name). Two-lane discipline; three ⛔ gates. Hard rules: a team logo is member-supplied league-public content (low sensitivity — it's shown league-wide like the team name), so it gets a consent CONSIDERATION not a fail-closed gate, but it is still member content and must be honestly attributed; a team without a logo shows the DEFAULT logo, never a broken/empty surface; no baked text (the logo is a runtime image overlay on a blank surface); no invention (no auto-generated per-team logos — a team either uploaded one or gets the shared default); no engine changes; halt-don't-guess on the storage/upload path — if it requires a new storage bucket or schema, surface it at G1. Nothing pushed before G3.

## 1. Objective
Team logo becomes a real, personal element: (a) an onboarding step where a member uploads or selects their team logo; (b) a shared default-logo asset for teams without one; (c) a logo render surface in the Coach Office (the blank framed-crest surface added to the hero re-render — see §3); (d) the logo rendered on that surface at runtime from the team's data, default when absent. This is the "team identity" layer of the living office.

## 2. What exists

CO Room v1's blank-surface + runtime-overlay pattern (nameplate) — the logo follows the same shape.
The franchises data model (owner_display_name, franchise identity) — the logo is a new field/asset associated with the franchise.
The onboarding + consent flow — the capture step extends it.
The hero re-render with a logo surface and the default-logo asset — both on the render queue (CO-R4 clean prompts already authored); this brief's Step 0 lands them when available, or specifies master-drawn placement on the current hero if the logo-surface re-render hasn't shipped.

## 3. The four pieces

Storage + data: where a team logo lives (a franchise-associated image asset). G1 determines the minimal path — a Supabase storage bucket + a franchise logo reference. If this requires schema/bucket creation, that is a founder-gated infrastructure step (like a migration), surfaced at G1, applied by the founder — NOT invented by the session.
Onboarding capture: a step in the member onboarding flow to upload an image (with the Prohibited-actions discipline — the session builds the UI; the actual upload is a user action; no credential handling). Includes format/size validation and the consent consideration (the member is told the logo is shown league-wide).
Default logo: the shared CO-R4-clean default asset (rendered), shown for any team without an uploaded logo. Never a broken image, never blank.
Office render surface: the logo overlaid on the office's blank logo surface at runtime (the crest surface in the re-rendered hero, or a master-drawn zone on the current hero), following the nameplate overlay pattern. Also usable on other surfaces (member cards, etc.) as a v3 note — this unit ships the office surface.

## 4. Constitutional constraints
No baked text/logo in base art (runtime overlay on blank surface, CO-R4) · no invention (uploaded-or-default, never auto-generated per team) · logo is member content, consent-considered and honestly shown · default never a broken surface · no new consent category (a consideration, not a gate) · storage/schema changes are founder-gated infrastructure, surfaced not invented · no engine changes.

## 5. Procedure
Step 0 — Ritual + reading + assets (identity, HEAD, tsc; read v1, onboarding, franchises model; land the default-logo asset and — if shipped — the logo-surface hero, else note master-drawn placement). Step 1 — Architecture (no build): the storage/data path (surfacing any founder-gated infra), the onboarding capture step, the default-logo fallback logic, the office overlay. ⛔ G1. Step 2 — Tests first: logo-present renders the team logo; logo-absent renders the default (never broken/blank); overlay is runtime data not baked; upload validation; no-invention (no auto-generated logos). ⛔ G2. Step 3 — Build + prove: capture step + default + office overlay; tsc/build/vitest green; v1 + clubhouse regressions intact; zero engine changes; any storage/schema infra applied by the founder, not the session. ⛔ G3: diff + founder eyeball (a team with a logo shows it; a team without shows the default; both feel intentional).

## 6. Successor gate notes
G1's load-bearing question: does logo storage require new infrastructure (bucket/schema)? If yes, that is a founder-applied step surfaced at G1, never session-invented (mirrors the prod-DB-is-a-founder-act discipline). G2: the default-fallback test matters most — no team ever shows a broken or blank logo surface. G3 eyeball: default and custom both read as intentional, not placeholder.

## 7. Acceptance
Onboarding logo capture works; default logo shown for logo-less teams (never broken); office overlay renders logo-or-default from data; no baked art; no invention; consent-considered; any infra founder-applied; zero engine changes; tsc/build/vitest/CI green.

## 8. Out of scope
Auto-generating team logos · logo on non-office surfaces beyond the office (v3) · personal media photos (separate brief) · ambient window light (separate brief) · new consent categories · engine changes — no engine changes.
