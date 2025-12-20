import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Link2 } from "lucide-react";
import Link from "next/link";
import { SharedLinksTable } from "@/components/shared-links-table";

interface SharedLinkView {
  id: string;
  viewed_at: string;
}

interface SharedLinkWithRelations {
  id: string;
  token: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  tailored_profile_id: string;
  tailored_profiles: {
    id: string;
    opportunity_id: string;
    opportunities: {
      id: string;
      title: string;
      company: string | null;
    };
  };
  shared_link_views: SharedLinkView[] | null;
}

export default async function SharedLinksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: links } = await supabase
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

  // Transform the data for the table component
  const transformedLinks = (links as SharedLinkWithRelations[] | null)?.map((link) => ({
    id: link.id,
    token: link.token,
    expiresAt: link.expires_at,
    revokedAt: link.revoked_at,
    createdAt: link.created_at,
    tailoredProfileId: link.tailored_profile_id,
    opportunityId: link.tailored_profiles.opportunities.id,
    opportunityTitle: link.tailored_profiles.opportunities.title,
    company: link.tailored_profiles.opportunities.company,
    viewCount: link.shared_link_views?.length || 0,
    views: link.shared_link_views?.map((v) => v.viewed_at).sort().reverse() || [],
  })) || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Shared Links</h1>
          <p className="text-muted-foreground mt-1">
            Manage links you&apos;ve shared with recruiters and hiring managers
          </p>
        </div>
      </div>

      {transformedLinks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No shared links yet</h3>
            <p className="text-muted-foreground mb-4">
              Share your tailored profiles from the opportunities page to track views here.
            </p>
            <Link
              href="/opportunities"
              className="text-primary hover:underline"
            >
              Go to Opportunities
            </Link>
          </CardContent>
        </Card>
      ) : (
        <SharedLinksTable links={transformedLinks} />
      )}
    </div>
  );
}
