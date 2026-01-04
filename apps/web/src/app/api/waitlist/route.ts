import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type WaitlistSource = "homepage" | "students" | "recruiters" | "mobile";
type WaitlistInterest = "job_seeking" | "recruiting";

interface WaitlistRequest {
  email: string;
  source: WaitlistSource;
  interests?: WaitlistInterest[];
}

const VALID_SOURCES: WaitlistSource[] = [
  "homepage",
  "students",
  "recruiters",
  "mobile",
];

const SOURCE_DEFAULT_INTERESTS: Record<WaitlistSource, WaitlistInterest[]> = {
  homepage: ["job_seeking"],
  students: ["job_seeking"],
  recruiters: ["recruiting"],
  mobile: ["job_seeking"],
};

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body: WaitlistRequest = await request.json();
    const { email, source, interests } = body;

    // Validate email
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 },
      );
    }

    // Validate source
    if (!source || !VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        { error: "Valid source is required" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const resolvedInterests = interests ?? SOURCE_DEFAULT_INTERESTS[source];

    // Use the upsert function to insert or merge interests
    const { error } = await supabase.rpc("upsert_waitlist", {
      p_email: normalizedEmail,
      p_source: source,
      p_interests: resolvedInterests,
    });

    if (error) {
      console.error("Failed to add to waitlist:", error);
      return NextResponse.json(
        { error: "Failed to join waitlist" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Waitlist error:", err);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
