import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// PATCH - Update expiration or revoke
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, expiresInDays } = body;

    const { data: link } = await supabase
      .from("shared_links")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (action === "revoke") {
      const { error } = await supabase
        .from("shared_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: "Failed to revoke" }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: "revoked" });
    }

    if (action === "extend" && expiresInDays !== undefined) {
      const expiresAt = new Date();
      if (expiresInDays > 0) {
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      } else {
        expiresAt.setFullYear(expiresAt.getFullYear() + 10);
      }

      const { error } = await supabase
        .from("shared_links")
        .update({
          expires_at: expiresAt.toISOString(),
          revoked_at: null // Unrevoke if extending
        })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: "Failed to extend" }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: "extended", expiresAt });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Error updating shared link:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

// DELETE - Delete link entirely
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("shared_links")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to delete shared link:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
