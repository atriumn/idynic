import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface ContactUpdateBody {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  logo_url?: string;
}

const ALLOWED_FIELDS = ["name", "email", "phone", "location", "linkedin", "github", "website", "logo_url"];

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: ContactUpdateBody = await request.json();

    // Filter to only allowed fields
    const updates: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.includes(key)) {
        updates[key] = value ?? null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Validate URL fields
    const urlFields = ["linkedin", "github", "website", "logo_url"];
    for (const field of urlFields) {
      if (updates[field]) {
        try {
          new URL(updates[field]!);
        } catch {
          return NextResponse.json({ error: `Invalid URL for ${field}` }, { status: 400 });
        }
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update contact:", error);
      return NextResponse.json({ error: "Failed to update contact info" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Contact update error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
