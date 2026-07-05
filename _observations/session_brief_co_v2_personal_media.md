Session Brief — CO v2: Personal Media (Framed Photos + Gallery)

Date: 2026-07-05 (DECIDE-authored). Foundation: Coach Office Room v1 shipped 936a8ee. Gates: ⛔ G1 architecture + consent design · ⛔ G2 tests · ⛔ G3 diff + eyeball. Repo: frontend.

## Kickoff

> You are the EXECUTE session for CO v2 Personal Media. Read this brief, then: _observations/session_brief_coach_office_room_v1.md (the shipped v1 it extends), docs/coach_office/RATIFICATION_MEMO_2026_07_04.md (CO-R1..R4), docs/coach_office/final_spec_package_v1/ (item 7 = personal media), the A/V Room consent code (src/lib/av-room.ts — the fail-closed media_appearance/likeness_derived pattern you MIRROR), the shipped CO Room v1 (RoomScene detail wiring, the office manifest, src/lib/coach-office/consent.ts memberHoldsGrant helper), and the landed consent model (member-consent-panel, MemberConsentCategory union). Two-lane discipline; three ⛔ gates. Hard rules: personal media is the HIGHEST-consent-sensitivity surface in the product — a member's photo may show only with that member's current GRANT, fail-closed (absent/REVOKE/error → not shown); CO-R2 narrowing applies per viewer; no invention; no baked text; no engine changes; no new consent categories (reuse the landed media categories); tests founder-ratified before implementation; halt-don't-guess. Nothing pushed before G3.

## 1. Objective

The framed-photo hotspot in the Coach Office becomes live: a framed_photos hotspot (added to the office manifest as a detail wiring) opens a photo gallery modal showing the owner's league-media photos, each gated fail-closed by the depicted members' consent. Empty state ("The frames wait for their first photo.") when the owner has no consented photos. Reuses the shipped RoomScene detail + RoomModal content pattern; the empty-frame asset (rendered, CO-R4 clean) is the visual stub.

## 2. What exists

The A/V Room (W.1) is the shipped media system — media_entries schema (migrations 011–024), consent-gated, expungement, content-hash dedup. This unit does not rebuild it; it READS from it where the owner's photos live, or specifies the minimal read path.
CO Room v1's detail wiring, office manifest, memberHoldsGrant fail-closed helper, CO.3 viewer context — all consumed.
The rendered empty-frame asset (CO-R4 clean, white bg → knockout to alpha at build).

## 3. The photo resolver + consent gate

resolveCoachOfficePhotos(admin, league, ownerUserId, viewerContext): reads the owner's photo media from the canonical media source; for EACH photo, requires every DEPICTED member to hold a current media_appearance (identity) grant AND, if the photo is a made/derived artifact, likeness_derived — fail-closed per depicted member, so a photo showing a non-consenting member is either withheld or (if the source supports it) shown only with consenting members. G1 determines the exact depicted-member model from the A/V Room schema; if the schema lacks per-photo depiction data, the resolver falls back to owner-only photos (the owner consents to their own frames) and the fuller model is a v3 note — halt-and-surface at G1, do not invent a depiction join.
Deterministic, no invention: no photo the source doesn't contain; no fabricated captions.

## 4. Constitutional constraints

CO-R1 fail-closed consent supremacy (per depicted member, mirroring A/V Room) · CO-R2 narrowing (viewer sees ⊆ owner-approved-and-consented) · CO-R3 (captions are member speech if present; none invented) · CO-R4 (no baked text; empty-frame stub) · no new consent categories · no engine changes · reuse the media schema, never fork it.

## 5. Procedure

Step 0 — Ritual + reading (identity, HEAD, tsc; read v1, A/V Room schema + consent, the media source). Step 1 — Architecture + consent design (no build): the resolver contract, the depicted-member consent model (or the owner-only fallback with the halt-surface if depiction data is absent), the gallery modal, the empty state. ⛔ G1. Step 2 — Tests first: per-depicted-member fail-closed (absent/REVOKE/error → withheld), CO-R2 narrowing, empty state, no-invention, no-baked-text, knockout-alpha verification on the frame asset. ⛔ G2. Step 3 — Build + prove: resolver + gallery + manifest hotspot; tsc/build/vitest green; clubhouse + CO v1 regressions intact; zero engine changes. ⛔ G3: diff + founder eyeball on prod preview (owner sees their photos; a non-consenting-member photo is correctly withheld).

## 6. Successor gate notes

G1's load-bearing question: does the A/V Room media schema carry per-photo depiction (which members appear in each photo)? If yes, gate per depicted member. If no, fall back to owner-only photos and surface the gap — do NOT invent a depiction model. G2: the fail-closed test per depicted member is the one that matters most; a photo must never leak a non-consenting member's likeness. G3 eyeball: confirm a deliberately-non-consenting member's photo is withheld live.

## 7. Acceptance

Gallery live; per-depicted-member fail-closed consent proven; CO-R2 narrowing proven; empty state correct; no invention; no baked text; frame asset alpha-clean; A/V Room schema read not forked; zero engine changes; tsc/build/vitest/CI green.

## 8. Out of scope

Building/altering the A/V Room · new consent categories · captions authoring UI · the team logo (separate brief) · ambient window light (separate brief) · engine changes — no engine changes.
