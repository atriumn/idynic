import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient();
  const { token } = await params;

  // Use SECURITY DEFINER function for controlled RLS bypass
  const { data, error } = await supabase.rpc("get_shared_profile", {
    p_token: token,
  });

  if (error) {
    console.error("Failed to fetch shared profile:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // Function returns JSON with either error or profile data
  const result = data as {
    error?: string;
    candidate_name?: string;
    candidate?: Record<string, unknown>;
    opportunity?: Record<string, unknown>;
    narrative?: string;
    resumeData?: Record<string, unknown>;
  };

  if (result.error === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (result.error === "expired" || result.error === "revoked") {
    return NextResponse.json(
      {
        error: result.error,
        candidateName: result.candidate_name,
      },
      { status: 410 }
    );
  }

  return NextResponse.json(result);
}
