import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface SkillUpdateBody {
  label?: string;
  description?: string | null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: SkillUpdateBody = await request.json();

    if (body.label !== undefined && body.label.trim() === "") {
      return NextResponse.json(
        { error: "label cannot be empty" },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.label) updates.label = body.label.trim();
    if (body.description !== undefined) updates.description = body.description;

    const { data, error } = await supabase
      .from("identity_claims")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("type", "skill")
      .select()
      .single();

    if (error) {
      console.error("Failed to update skill:", error);
      return NextResponse.json(
        { error: "Failed to update skill" },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Skill update error:", err);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // First delete any claim_evidence links
  await supabase.from("claim_evidence").delete().eq("claim_id", id);

  const { error } = await supabase
    .from("identity_claims")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("type", "skill");

  if (error) {
    console.error("Failed to delete skill:", error);
    return NextResponse.json(
      { error: "Failed to delete skill" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
