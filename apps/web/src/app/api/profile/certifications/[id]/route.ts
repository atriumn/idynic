import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";

interface CertificationUpdateBody {
  name?: string;
  issuer?: string | null;
  date?: string | null;
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
    const body: CertificationUpdateBody = await request.json();

    // First get existing to merge context
    const { data: existing } = await supabase
      .from("evidence")
      .select("text, context")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("evidence_type", "certification")
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Certification not found" },
        { status: 404 },
      );
    }

    const existingContext = (existing.context as Record<string, unknown>) || {};
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updates.text = body.name.trim();
    }

    const newContext: Json = {
      ...existingContext,
      ...(body.issuer !== undefined && { issuer: body.issuer }),
      ...(body.date !== undefined && { date: body.date }),
    };
    updates.context = newContext;

    const { data, error } = await supabase
      .from("evidence")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("evidence_type", "certification")
      .select()
      .single();

    if (error) {
      console.error("Failed to update certification:", error);
      return NextResponse.json(
        { error: "Failed to update certification" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Certification update error:", err);
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

  const { error } = await supabase
    .from("evidence")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("evidence_type", "certification");

  if (error) {
    console.error("Failed to delete certification:", error);
    return NextResponse.json(
      { error: "Failed to delete certification" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
