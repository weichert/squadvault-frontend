// src/app/api/artifacts/[artifactId]/withhold/route.ts
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

  const { data: artifact } = await admin
    .from("artifacts")
    .select("id, league_id, approval_state")
    .eq("id", artifactId)
    .maybeSingle() as {
      data: { id: string; league_id: string; approval_state: string } | null
    };

  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: leagueCheck } = await admin
    .from("leagues")
    .select("commissioner_user_id")
    .eq("id", artifact.league_id)
    .maybeSingle() as { data: { commissioner_user_id: string | null } | null };

  if (leagueCheck?.commissioner_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (artifact.approval_state === "DRAFT") {
    await admin
      .from("artifacts")
      .update({ approval_state: "UNDER_REVIEW" })
      .eq("id", artifactId);
  }
  await admin
    .from("artifacts")
    .update({ approval_state: "WITHHELD" })
    .eq("id", artifactId);

  await admin
    .from("approval_events")
    .insert({
      artifact_id: artifactId,
      from_state: artifact.approval_state,
      to_state: "WITHHELD",
      actor_user_id: user.id,
    });

  return NextResponse.json({ ok: true });
}
