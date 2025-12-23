import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";

interface CertificationCreateBody {
  name: string;
  issuer?: string | null;
  date?: string | null;
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
    const body: CertificationCreateBody = await request.json();

    if (!body.name || body.name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const context: Json = {
      issuer: body.issuer || null,
      date: body.date || null,
      source: "manual",
    };

    const { data, error } = await supabase
      .from("evidence")
      .insert({
        user_id: user.id,
        evidence_type: "certification",
        text: body.name.trim(),
        context,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create certification:", error);
      return NextResponse.json({ error: "Failed to create certification" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Certification create error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
