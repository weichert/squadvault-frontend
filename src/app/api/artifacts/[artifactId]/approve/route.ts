// src/app/api/artifacts/[artifactId]/approve/route.ts
import { createAdminClient } from "@/lib/supabase/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient as createUntypedAdmin } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  const { artifactId } = await params;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const _adminTyped = createAdminClient();
  const admin = createUntypedAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verify commissioner owns the league this artifact belongs to
  const { data: artifact } = await admin
    .from("artifacts")
    .select("id, league_id, is_demo, approval_state, season")
    .eq("id", artifactId)
    .maybeSingle() as {
      data: { id: string; league_id: string; is_demo: boolean; approval_state: string; season: number | null } | null
    };

  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["DRAFT", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(artifact.approval_state)) {
    return NextResponse.json({ error: "Cannot approve in current state" }, { status: 400 });
  }

  const { data: league } = await admin
    .from("leagues")
    .select("id, canonical_id, first_approval_completed")
    .eq("id", artifact.league_id)
    .maybeSingle() as {
      data: { id: string; canonical_id: string; first_approval_completed: boolean } | null
    };

  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  // Verify commissioner
  const { data: leagueCheck } = await admin
    .from("leagues")
    .select("commissioner_user_id")
    .eq("id", artifact.league_id)
    .maybeSingle() as { data: { commissioner_user_id: string | null } | null };

  if (leagueCheck?.commissioner_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate docket ID.
  // F4-A3: league short code is hardcoded to "PFL". PFL Buddies
  // (canonical_id 70985) is currently the only real production league, and
  // canonical_id is the numeric MFL id, so it cannot be sliced into a short
  // code (that would read SV-2024-70985-001, a regression). The previously
  // computed-but-unused leagueCode slice has been removed because it invited
  // exactly that naive substitution. FOLLOW-ON: when a second real league
  // onboards, add a governed leagues.docket_code column (a presentation
  // field, not an immutable fact) and read it here in place of this constant.
  const year = artifact.season ?? new Date().getFullYear();
  const LEAGUE_DOCKET_CODE = "PFL";
  const { count } = await admin
    .from("artifacts")
    .select("id", { count: "exact", head: true })
    .eq("league_id", artifact.league_id)
    .eq("approval_state", "APPROVED") as { count: number | null };

  const seq = String((count ?? 0) + 1).padStart(3, "0");
  const docketId = artifact.is_demo
    ? `DEMO-${year}-${seq}`
    : `SV-${year}-${LEAGUE_DOCKET_CODE}-${seq}`;

  // Approve: DRAFT → UNDER_REVIEW → APPROVED (trigger enforces each step)
  if (artifact.approval_state === "DRAFT") {
    await admin
      .from("artifacts")
      .update({ approval_state: "UNDER_REVIEW" })
      .eq("id", artifactId);
  }
  await admin
    .from("artifacts")
    .update({
      approval_state: "APPROVED",
      approved_by_user_id: user.id,
      approved_at: new Date().toISOString(),
      docket_id: docketId,
      trust_bar_text: "Entered into the Record · Source Facts Verified · SquadVault",
    })
    .eq("id", artifactId);

  // Log approval event
  await admin
    .from("approval_events")
    .insert({
      artifact_id: artifactId,
      from_state: artifact.approval_state,
      to_state: "APPROVED",
      actor_user_id: user.id,
    });

  // Mark first approval if needed
  const isFirstApproval = !league.first_approval_completed;
  if (isFirstApproval) {
    await admin
      .from("leagues")
      .update({ first_approval_completed: true })
      .eq("id", league.id);
  }

  return NextResponse.json({ docket_id: docketId, first_approval: isFirstApproval });
}
