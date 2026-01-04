import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface SkillCreateBody {
  label: string;
  description?: string | null;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: SkillCreateBody = await request.json();

    if (!body.label || body.label.trim() === "") {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }

    const normalizedLabel = body.label.trim();

    // Check for duplicate
    const { data: existing } = await supabase
      .from("identity_claims")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "skill")
      .ilike("label", normalizedLabel)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Skill already exists" },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("identity_claims")
      .insert({
        user_id: user.id,
        type: "skill",
        label: normalizedLabel,
        description: body.description || null,
        confidence: 1.0, // User-added = high confidence
        source: "manual",
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create skill:", error);
      return NextResponse.json(
        { error: "Failed to create skill" },
        { status: 500 },
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Skill create error:", err);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
