import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { rewriteContent, type ContentType } from "@/lib/ai/rewrite-content";
import type { Json } from "@/lib/supabase/types";

// Helper to get/set nested value in object using dot notation path
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current, key) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj as unknown);
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split(".");
  const lastKey = keys.pop()!;

  let current: Record<string, unknown> = obj;
  for (const key of keys) {
    if (!current || typeof current !== "object" || !(key in current)) {
      throw new Error(`Cannot set nested value: path "${path}" does not exist`);
    }
    current = current[key] as Record<string, unknown>;
  }

  if (!current || typeof current !== "object") {
    throw new Error(`Cannot set nested value: invalid target at "${path}"`);
  }

  current[lastKey] = value;
}

function inferContentType(field: string): ContentType {
  if (field === "narrative") return "narrative";
  if (field === "summary") return "summary";
  if (field.includes("bullets")) return "bullet";
  return "bullet"; // default
}

interface PatchBody {
  field: string;
  value?: string;
  instruction?: string;
  selection?: { start: number; end: number };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ opportunityId: string }> },
) {
  const supabase = await createClient();
  const { opportunityId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: PatchBody = await request.json();
    const { field, value, instruction, selection } = body;

    if (!field) {
      return NextResponse.json({ error: "field is required" }, { status: 400 });
    }

    if (!value && !instruction) {
      return NextResponse.json(
        { error: "Either value or instruction is required" },
        { status: 400 },
      );
    }

    // Fetch current profile
    const { data: profile, error: fetchError } = await supabase
      .from("tailored_profiles")
      .select("*")
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunityId)
      .single();

    if (fetchError) {
      console.error("Database error fetching profile:", fetchError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    let newValue: string;
    let wasAiGenerated = false;

    if (value !== undefined) {
      // Direct edit
      newValue = value;
    } else {
      // AI-assisted edit
      let currentContent: string;

      if (field === "narrative") {
        currentContent = profile.narrative || "";
      } else {
        // Field is in resume_data (e.g., "summary", "experience.0.bullets.2")
        const resumeData = profile.resume_data as Record<string, unknown>;
        currentContent = String(getNestedValue(resumeData, field) || "");
      }

      newValue = await rewriteContent({
        content: currentContent,
        contentType: inferContentType(field),
        instruction: instruction!,
        selection,
      });
      wasAiGenerated = true;
    }

    // Build update payload
    const editedFields = [...(profile.edited_fields || [])];
    if (!editedFields.includes(field)) {
      editedFields.push(field);
    }

    const updatePayload: Record<string, unknown> = {
      edited_fields: editedFields,
    };

    if (field === "narrative") {
      updatePayload.narrative = newValue;
    } else {
      // Update nested field in resume_data
      const resumeData = JSON.parse(JSON.stringify(profile.resume_data));
      setNestedValue(resumeData, field, newValue);
      updatePayload.resume_data = resumeData as Json;
    }

    const { error: updateError } = await supabase
      .from("tailored_profiles")
      .update(updatePayload)
      .eq("id", profile.id);

    if (updateError) {
      console.error("Failed to update profile:", updateError);
      return NextResponse.json(
        { error: "Failed to save edit" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      field,
      value: newValue,
      wasAiGenerated,
    });
  } catch (err) {
    console.error("Edit error:", err);
    return NextResponse.json(
      { error: "Failed to process edit" },
      { status: 500 },
    );
  }
}

interface RevertBody {
  field: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ opportunityId: string }> },
) {
  const supabase = await createClient();
  const { opportunityId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: RevertBody = await request.json();
    const { field } = body;

    if (!field) {
      return NextResponse.json({ error: "field is required" }, { status: 400 });
    }

    // Fetch current profile with originals
    const { data: profile, error: fetchError } = await supabase
      .from("tailored_profiles")
      .select("*")
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunityId)
      .single();

    if (fetchError) {
      console.error("Database error fetching profile:", fetchError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    let originalValue: string;
    let updatePayload: Record<string, unknown>;

    if (field === "narrative") {
      originalValue = profile.narrative_original || "";
      updatePayload = { narrative: originalValue };
    } else {
      // Get from resume_data_original
      const originalData = profile.resume_data_original as Record<
        string,
        unknown
      >;
      originalValue = String(getNestedValue(originalData, field) || "");

      // Update resume_data with original value
      const resumeData = JSON.parse(JSON.stringify(profile.resume_data));
      setNestedValue(resumeData, field, originalValue);
      updatePayload = { resume_data: resumeData as Json };
    }

    // Remove field from edited_fields
    const editedFields = (profile.edited_fields || []).filter(
      (f: string) => f !== field,
    );
    updatePayload.edited_fields = editedFields;

    const { error: updateError } = await supabase
      .from("tailored_profiles")
      .update(updatePayload)
      .eq("id", profile.id);

    if (updateError) {
      console.error("Failed to revert:", updateError);
      return NextResponse.json({ error: "Failed to revert" }, { status: 500 });
    }

    return NextResponse.json({
      field,
      value: originalValue,
    });
  } catch (err) {
    console.error("Revert error:", err);
    return NextResponse.json({ error: "Failed to revert" }, { status: 500 });
  }
}
