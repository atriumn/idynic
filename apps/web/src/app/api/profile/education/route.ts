import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";

interface EducationCreateBody {
  school: string;
  degree?: string | null;
  field?: string | null;
  start_date?: string | null;
  end_date?: string | null;
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
    const body: EducationCreateBody = await request.json();

    if (!body.school || body.school.trim() === "") {
      return NextResponse.json({ error: "school is required" }, { status: 400 });
    }

    // Build display text
    const parts = [body.school.trim()];
    if (body.degree) parts.push(body.degree);
    if (body.field) parts.push(`in ${body.field}`);
    const text = parts.join(", ");

    const context: Json = {
      school: body.school.trim(),
      degree: body.degree || null,
      field: body.field || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      source: "manual",
    };

    const { data, error } = await supabase
      .from("evidence")
      .insert({
        user_id: user.id,
        evidence_type: "education",
        text,
        context,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create education:", error);
      return NextResponse.json({ error: "Failed to create education entry" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Education create error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
