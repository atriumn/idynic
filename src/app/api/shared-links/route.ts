import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

function generateToken(): string {
  return randomBytes(16).toString("hex");
}

// GET - List user's shared links with view counts
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Type assertion needed since shared_links table types haven't been generated yet
  const { data: links, error } = await (supabase as any)
    .from("shared_links")
    .select(`
      id,
      token,
      expires_at,
      revoked_at,
      created_at,
      tailored_profile_id,
      tailored_profiles!inner (
        id,
        opportunity_id,
        opportunities!inner (
          id,
          title,
          company
        )
      ),
      shared_link_views (
        id,
        viewed_at
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch shared links:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Transform to include view count and opportunity info
  const transformed = links?.map((link: any) => ({
    id: link.id,
    token: link.token,
    expiresAt: link.expires_at,
    revokedAt: link.revoked_at,
    createdAt: link.created_at,
    tailoredProfileId: link.tailored_profile_id,
    opportunity: {
      id: (link.tailored_profiles as any).opportunities.id,
      title: (link.tailored_profiles as any).opportunities.title,
      company: (link.tailored_profiles as any).opportunities.company,
    },
    viewCount: (link.shared_link_views as any[])?.length || 0,
    views: (link.shared_link_views as any[])?.map((v: any) => ({
      id: v.id,
      viewedAt: v.viewed_at,
    })) || [],
  }));

  return NextResponse.json({ links: transformed });
}

// POST - Create a new shared link
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tailoredProfileId, expiresInDays = 30 } = body;

    if (!tailoredProfileId) {
      return NextResponse.json(
        { error: "tailoredProfileId is required" },
        { status: 400 }
      );
    }

    // Verify the tailored profile belongs to user
    const { data: profile } = await supabase
      .from("tailored_profiles")
      .select("id")
      .eq("id", tailoredProfileId)
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Tailored profile not found" },
        { status: 404 }
      );
    }

    // Check if link already exists (type assertion needed - shared_links types not generated yet)
    const { data: existingLink } = await (supabase as any)
      .from("shared_links")
      .select("id")
      .eq("tailored_profile_id", tailoredProfileId)
      .single();

    if (existingLink) {
      return NextResponse.json(
        { error: "Link already exists for this profile" },
        { status: 409 }
      );
    }

    // Calculate expiration
    const expiresAt = new Date();
    if (expiresInDays > 0) {
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    } else {
      // "No expiration" = 10 years
      expiresAt.setFullYear(expiresAt.getFullYear() + 10);
    }

    // Create the link (type assertion needed - shared_links types not generated yet)
    const token = generateToken();
    const { data: newLink, error } = await (supabase as any)
      .from("shared_links")
      .insert({
        tailored_profile_id: tailoredProfileId,
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create shared link:", error);
      return NextResponse.json({ error: "Failed to create link" }, { status: 500 });
    }

    return NextResponse.json({
      id: newLink.id,
      token: newLink.token,
      expiresAt: newLink.expires_at,
      url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/shared/${token}`,
    });
  } catch (err) {
    console.error("Error creating shared link:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
