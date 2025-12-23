import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("recruiter_waitlist")
      .insert({ email: email.toLowerCase().trim() });

    if (error) {
      // Ignore duplicate errors silently (Postgres unique constraint violation code)
      if (error.code === "23505") {
        return NextResponse.json({ success: true });
      }
      console.error("Failed to add to waitlist:", error);
      return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Waitlist error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
