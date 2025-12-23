import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface WorkHistoryUpdateBody {
  company?: string;
  title?: string;
  start_date?: string;
  end_date?: string | null;
  location?: string | null;
  summary?: string | null;
  company_domain?: string | null;
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
    const body: WorkHistoryUpdateBody = await request.json();

    const { data, error } = await supabase
      .from("work_history")
      .update(body)
      .eq("id", id)
      .eq("user_id", user.id) // Security: only update own records
      .select()
      .single();

    if (error) {
      console.error("Failed to update work history:", error);
      return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Work history update error:", err);
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

  // Note: We do NOT cascade delete evidence - it's still valid career data
  const { error } = await supabase
    .from("work_history")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to delete work history:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
