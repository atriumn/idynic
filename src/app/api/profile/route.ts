import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all profile data in parallel
  const [
    { data: profile },
    { data: workHistory },
    { data: ventures },
    { data: skills },
    { data: certifications },
    { data: education },
  ] = await Promise.all([
    // Contact info from profiles
    supabase
      .from("profiles")
      .select("name, email, phone, location, linkedin, github, website, logo_url")
      .eq("id", user.id)
      .single(),

    // Work history (excluding ventures)
    supabase
      .from("work_history")
      .select("id, company, title, start_date, end_date, location, summary, company_domain, order_index")
      .eq("user_id", user.id)
      .or("entry_type.is.null,entry_type.in.(work,additional)")
      .order("order_index", { ascending: true }),

    // Ventures
    supabase
      .from("work_history")
      .select("id, company, title, start_date, end_date, location, summary, company_domain, order_index")
      .eq("user_id", user.id)
      .eq("entry_type", "venture")
      .order("order_index", { ascending: true }),

    // Skills from identity_claims
    supabase
      .from("identity_claims")
      .select("id, label, description, confidence, source")
      .eq("user_id", user.id)
      .eq("type", "skill")
      .order("confidence", { ascending: false }),

    // Certifications from evidence
    supabase
      .from("evidence")
      .select("id, text, context")
      .eq("user_id", user.id)
      .eq("evidence_type", "certification")
      .order("created_at", { ascending: false }),

    // Education from evidence
    supabase
      .from("evidence")
      .select("id, text, context")
      .eq("user_id", user.id)
      .eq("evidence_type", "education")
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    contact: profile || {},
    workHistory: workHistory || [],
    ventures: ventures || [],
    skills: skills || [],
    certifications: certifications || [],
    education: education || [],
  });
}
