import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";

interface EducationUpdateBody {
  school?: string;
  degree?: string | null;
  field?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
    const body: EducationUpdateBody = await request.json();

    // First get existing to merge context
    const { data: existing } = await supabase
      .from("evidence")
      .select("context")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("evidence_type", "education")
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Education entry not found" }, { status: 404 });
    }

    const existingContext = (existing.context as Record<string, unknown>) || {};

    const newContext: Record<string, unknown> = {
      ...existingContext,
      ...(body.school !== undefined && { school: body.school }),
      ...(body.degree !== undefined && { degree: body.degree }),
      ...(body.field !== undefined && { field: body.field }),
      ...(body.start_date !== undefined && { start_date: body.start_date }),
      ...(body.end_date !== undefined && { end_date: body.end_date }),
    };

    // Rebuild display text
    const school = (newContext.school as string) || "";
    const parts = [school];
    if (newContext.degree) parts.push(newContext.degree as string);
    if (newContext.field) parts.push(`in ${newContext.field}`);
    const text = parts.join(", ");

    const { data, error } = await supabase
      .from("evidence")
      .update({ text, context: newContext as Json })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("evidence_type", "education")
      .select()
      .single();

    if (error) {
      console.error("Failed to update education:", error);
      return NextResponse.json({ error: "Failed to update education entry" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Education update error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
    .eq("evidence_type", "education");

  if (error) {
    console.error("Failed to delete education:", error);
    return NextResponse.json({ error: "Failed to delete education entry" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
