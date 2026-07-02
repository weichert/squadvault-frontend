#!/usr/bin/env tsx
// scripts/proof_coach_office_viewer_context.ts
// Determinism proof for the Coach Office Phase 3 viewer-relationship classifier.
// Run: npx tsx scripts/proof_coach_office_viewer_context.ts
//
// The classifier is a PURE function of its inputs (no DB, no clock, no randomness),
// so this proof is self-contained: it needs no Supabase env and no Next context. It
// asserts the full relationship truth table, the precedence rules, the conservative
// anonymous default, and the advisory capability booleans - and, because the function
// is pure, it also asserts that identical inputs yield identical outputs.
import {
  classifyCoachOfficeViewerContext,
  type CoachOfficeRelationship,
  type CoachOfficeViewerFacts,
} from "../src/lib/coach-office/viewer-context";

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail = ""): void {
  if (cond) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// Platform-neutral synthetic ids only. No real league / coach / user values appear
// here (charter section 2: no hard-coded league-specific content).
const OFFICE = "office-coach";
const OWN = "office-coach"; // viewer's own franchise == the office
const OTHER = "other-coach"; // viewer's own franchise != the office
const USER = "viewer-user";

type Case = {
  label: string;
  facts: CoachOfficeViewerFacts;
  expected: CoachOfficeRelationship;
};

const cases: Case[] = [
  {
    label: "anonymous (no user) -> PUBLIC_OR_UNKNOWN",
    facts: { viewerUserId: null, viewerCoachId: null, officeCoachId: OFFICE, isCommissioner: false },
    expected: "PUBLIC_OR_UNKNOWN",
  },
  {
    label: "anonymous is never elevated by a stray commissioner flag",
    facts: { viewerUserId: null, viewerCoachId: null, officeCoachId: OFFICE, isCommissioner: true },
    expected: "PUBLIC_OR_UNKNOWN",
  },
  {
    label: "viewer's franchise IS the office -> OWNER",
    facts: { viewerUserId: USER, viewerCoachId: OWN, officeCoachId: OFFICE, isCommissioner: false },
    expected: "OWNER",
  },
  {
    label: "owner who is ALSO commissioner, viewing own office -> OWNER (precedence)",
    facts: { viewerUserId: USER, viewerCoachId: OWN, officeCoachId: OFFICE, isCommissioner: true },
    expected: "OWNER",
  },
  {
    label: "commissioner viewing someone else's office -> COMMISSIONER",
    facts: { viewerUserId: USER, viewerCoachId: OTHER, officeCoachId: OFFICE, isCommissioner: true },
    expected: "COMMISSIONER",
  },
  {
    label: "commissioner with no franchise of their own -> COMMISSIONER",
    facts: { viewerUserId: USER, viewerCoachId: null, officeCoachId: OFFICE, isCommissioner: true },
    expected: "COMMISSIONER",
  },
  {
    label: "authenticated franchise owner, different office, not commissioner -> LEAGUE_MATE",
    facts: { viewerUserId: USER, viewerCoachId: OTHER, officeCoachId: OFFICE, isCommissioner: false },
    expected: "LEAGUE_MATE",
  },
  {
    label: "authenticated but unaffiliated (no franchise here) -> PUBLIC_OR_UNKNOWN",
    facts: { viewerUserId: USER, viewerCoachId: null, officeCoachId: OFFICE, isCommissioner: false },
    expected: "PUBLIC_OR_UNKNOWN",
  },
];

console.log("\nCoach Office Phase 3 - viewer relationship classifier\n");

for (const c of cases) {
  const ctx = classifyCoachOfficeViewerContext(c.facts);
  check(c.label, ctx.relationship === c.expected, `got ${ctx.relationship}, expected ${c.expected}`);

  // Determinism: the same inputs must yield an identical result object.
  const again = classifyCoachOfficeViewerContext(c.facts);
  check(`${c.label} [deterministic]`, JSON.stringify(again) === JSON.stringify(ctx));

  // Conservative capability booleans derive strictly from the relationship.
  check(
    `${c.label} [canViewPublicOffice always true]`,
    ctx.canViewPublicOffice === true,
  );
  check(
    `${c.label} [canViewOwnerOnlySurface iff OWNER]`,
    ctx.canViewOwnerOnlySurface === (ctx.relationship === "OWNER"),
  );
  check(
    `${c.label} [canViewRelationshipSurface iff not PUBLIC_OR_UNKNOWN]`,
    ctx.canViewRelationshipSurface === (ctx.relationship !== "PUBLIC_OR_UNKNOWN"),
  );
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  console.error("PROOF FAILURE - the viewer-context classifier is wrong.\n");
  process.exit(1);
}
console.log("All viewer-context proofs passed.\n");
process.exit(0);
