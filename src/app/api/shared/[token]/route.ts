import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient();
  const { token } = await params;

  // Fetch the shared link with all necessary data
  // Using type assertion since database types haven't been regenerated yet
  const { data: link, error } = await (supabase as any)
    .from("shared_links")
    .select(`
      id,
      expires_at,
      revoked_at,
      tailored_profiles!inner (
        id,
        narrative,
        resume_data,
        opportunities!inner (
          id,
          title,
          company
        )
      ),
      profiles!inner (
        id,
        name,
        email,
        phone,
        location,
        linkedin,
        github,
        website,
        logo_url
      )
    `)
    .eq("token", token)
    .single();

  if (error || !link) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Check if expired or revoked
  const now = new Date();
  const expiresAt = new Date(link.expires_at);

  if (link.revoked_at || expiresAt < now) {
    return NextResponse.json({
      error: "expired",
      candidateName: link.profiles.name,
    }, { status: 410 });
  }

  // Log the view
  // Using type assertion since database types haven't been regenerated yet
  await (supabase as any).from("shared_link_views").insert({
    shared_link_id: link.id,
  });

  // Return the profile data
  return NextResponse.json({
    candidate: {
      name: link.profiles.name,
      email: link.profiles.email,
      phone: link.profiles.phone,
      location: link.profiles.location,
      linkedin: link.profiles.linkedin,
      github: link.profiles.github,
      website: link.profiles.website,
      logoUrl: link.profiles.logo_url,
    },
    opportunity: {
      title: link.tailored_profiles.opportunities.title,
      company: link.tailored_profiles.opportunities.company,
    },
    narrative: link.tailored_profiles.narrative,
    resumeData: link.tailored_profiles.resume_data,
  });
}
