import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface WorkHistoryCreateBody {
  company: string;
  title: string;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  summary?: string | null;
  company_domain?: string | null;
  entry_type?: "work" | "venture" | "additional";
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
    const body: WorkHistoryCreateBody = await request.json();

    if (!body.company || !body.title || !body.start_date) {
      return NextResponse.json(
        { error: "company, title, and start_date are required" },
        { status: 400 }
      );
    }

    // Get max order_index for this user
    const { data: maxOrder } = await supabase
      .from("work_history")
      .select("order_index")
      .eq("user_id", user.id)
      .order("order_index", { ascending: false })
      .limit(1)
      .single();

    const nextOrderIndex = (maxOrder?.order_index ?? -1) + 1;

    // Need document_id - use the most recent resume document
    const { data: document } = await supabase
      .from("documents")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "resume")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!document) {
      return NextResponse.json(
        { error: "No resume document found. Upload a resume first." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("work_history")
      .insert({
        user_id: user.id,
        document_id: document.id,
        company: body.company,
        title: body.title,
        start_date: body.start_date,
        end_date: body.end_date || null,
        location: body.location || null,
        summary: body.summary || null,
        company_domain: body.company_domain || null,
        entry_type: body.entry_type || "work",
        order_index: nextOrderIndex,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create work history:", error);
      return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Work history create error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
