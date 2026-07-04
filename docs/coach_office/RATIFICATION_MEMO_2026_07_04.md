# Coach Office Spec v1 - Ratification Memo (2026-07-04)

Status: RATIFIED. Founder-approved 2026-07-04.
Scope: formal adoption of the Coach Office Final Spec Package v1 and the
rulings CO-R1..CO-R4 that govern it. Documentation only; no code or asset
change lands with this memo.

## 1. Package provenance

The spec package lives at `docs/coach_office/final_spec_package_v1/` (eight
files: README, Claude_Code_Master_Implementation_Prompt_v1.md,
Claude_Design_Master_Production_Brief_v1.md, Coach_Office_Data_Schemas_v1.json,
Coach_Office_Hotspot_Map_Template_v1.json, Coach_Office_QA_Checklist_v1.md,
Artwork_Asset_Manifest_Template_v1.csv, and the primary
SquadVault_Coach_Office_Final_Spec_and_Production_Plan_v1.docx).

- Authored OUTSIDE the two-lane record (not produced by a Fable-decide /
  Opus-execute session; it predates this charter's routing for this surface).
- Already PRESENT in-repo since `fab143b` (CO.1, Phase 1 static shell) - it was
  committed as reference material, never formally adopted.
- FORMALLY ADOPTED by founder ratification on 2026-07-04. This memo is that
  ratification of record. The existing in-repo location
  (`docs/coach_office/final_spec_package_v1/`, underscore) is canonical; an
  earlier instruction to re-land under a hyphen path was a founder error and is
  withdrawn - the repo's existing location governs. No re-copy, no rename.

## 2. Rulings

### CO-R1 - Consent supremacy
The landed consent toggles gate ALL rendering of likeness, voice, and
attributed words. Consent is the outer gate and it wins. The spec's own
visibility flags are ADDITIONAL NARROWING ONLY - they can further restrict what
a consent-cleared viewer sees, but they can never widen exposure beyond what
consent already permits. Consent-denied content never renders regardless of any
spec flag.

### CO-R2 - Narrowing law
Relationship-aware rendering SELECTS SUBSETS of the owner-approved,
consent-cleared set. It only ever narrows; it never adds or invents. The
resolver shipped in CO.3 (relationship-aware viewer context) is the FOUNDATION
of spec item 6 (Relationship-Aware Office Surface v1) and is CONVERGENT with it
- CO.3 answers "who is viewing and what is their relationship," and spec item 6
  builds the content-selection layer on top of that same taxonomy. No divergence
  to reconcile.

### CO-R3 - Member speech vs AI content
Member-authored board notes and photo captions are MEMBER SPEECH.
`commissioner_review_required: false` is acceptable for that member-authored
content. By contrast, ANY AI-GENERATED content inherits the platform's
unconditional human-approval rule - it may never render without human approval,
and no spec flag can waive that.

### CO-R4 - No baked text in base art
Base art carries NO baked-in legible text, brand marks, logos, league facts, or
hard-coded jokes. Text and photos are dynamically overlaid at render time. Any
render that bakes such content in is QUARANTINED and NEVER SHIPPED - it is set
aside as provenance, not deleted, and not renamed into the shippable set.

## 3. Corrected facts

- The league was FOUNDED IN 1984 (NOT 2013). Any asset or copy asserting "2013"
  or "EST 2013" is factually wrong (this includes the quarantined hero render
  `07_04_10`, an independent reason it is CO-R4-quarantined).
- Championship years and all award facts come from the CANONICAL RECORD ONLY;
  they are never invented, hard-coded, or inferred from art.

## 4. Asset ruling - clean ambient decor

The five checklist-clean decor pieces surfaced in the Coach Office asset review
- leather sofa, leather armchair, coffee table, whiskey glass, and
  old-fashioned cocktail - classify as `co_decor_*` AMBIENT assets, UNASSIGNED.
They are clean under the Design Brief and CO-R4 (no legible text, no logos), may
serve EITHER room, and are:

- NOT quarantined (they carry no baked text), and
- NOT forced into a spec production-variant slot (they are ambient, not a named
  hero/detail variant or a listed modular asset).

They remain available for compositing into any room at the owner's/designer's
discretion.

## 5. What this memo does NOT do

- Does not re-copy or rename the spec package (existing path canonical).
- Does not land any artwork, rename any asset file, or resolve the open Coach
  Office asset gate (see `~/Desktop/sv_co_assets.txt` - that remains at its own
  founder gate).
- Does not change code, schemas, or the shipped CO.1..CO.3 surfaces.
