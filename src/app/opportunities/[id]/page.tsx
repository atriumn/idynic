import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ExternalLink, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { computeOpportunityMatches } from "@/lib/ai/match-opportunity";
import { TailoredProfile } from "@/components/tailored-profile";
import { ShareLinkModal } from "@/components/share-link-modal";

const STATUS_COLORS: Record<string, string> = {
  tracking: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  applied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  interviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  offer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  archived: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? "text-green-600" : score >= 50 ? "text-yellow-600" : "text-red-600";
  const bgColor = score >= 70 ? "bg-green-100" : score >= 50 ? "bg-yellow-100" : "bg-red-100";

  return (
    <div className="text-center">
      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${bgColor}`}>
        <span className={`text-2xl font-bold ${color}`}>{score}%</span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!opportunity) {
    notFound();
  }

  // Fetch user profile for name and contact info
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("name, phone, location, linkedin, github, website")
    .eq("id", user.id)
    .single();

  // Fetch existing shared link for this opportunity's tailored profile
  const { data: tailoredProfile } = await supabase
    .from("tailored_profiles")
    .select("id")
    .eq("opportunity_id", id)
    .eq("user_id", user.id)
    .single();

  let existingSharedLink = null;
  if (tailoredProfile) {
    const { data: sharedLink } = await supabase
      .from("shared_links")
      .select(`
        id,
        token,
        expires_at,
        revoked_at,
        shared_link_views (id)
      `)
      .eq("tailored_profile_id", tailoredProfile.id)
      .single();

    if (sharedLink) {
      existingSharedLink = {
        id: sharedLink.id,
        token: sharedLink.token,
        expiresAt: sharedLink.expires_at as string,
        revokedAt: sharedLink.revoked_at as string | null,
        viewCount: (sharedLink.shared_link_views as any[] | null)?.length || 0,
      };
    }
  }

  // Compute matches
  const matchResult = await computeOpportunityMatches(id, user.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link
        href="/opportunities"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to opportunities
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{opportunity.title}</h1>
          {opportunity.company && (
            <div className="flex items-center gap-1 text-muted-foreground mt-1">
              <Building2 className="h-4 w-4" />
              {opportunity.company}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={STATUS_COLORS[opportunity.status || "tracking"]} variant="secondary">
            {opportunity.status || "tracking"}
          </Badge>
          {opportunity.url && (
            <Button variant="outline" size="sm" asChild>
              <a href={opportunity.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                View posting
              </a>
            </Button>
          )}
          {tailoredProfile && (
            <ShareLinkModal
              tailoredProfileId={tailoredProfile.id}
              existingLink={existingSharedLink}
            />
          )}
        </div>
      </div>

      {/* Match Scores */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Profile Match</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-around">
            <ScoreRing score={matchResult.overallScore} label="Overall" />
            <ScoreRing score={matchResult.mustHaveScore} label="Required" />
            <ScoreRing score={matchResult.niceToHaveScore} label="Nice-to-Have" />
          </div>
        </CardContent>
      </Card>

      {/* Tailored Profile - includes requirements on Talking Points tab */}
      <TailoredProfile
        opportunityId={id}
        requirementMatches={matchResult.requirementMatches}
        userName={userProfile?.name || user.email?.split("@")[0] || "Your Name"}
        userEmail={user.email}
        userPhone={userProfile?.phone ?? undefined}
        userLocation={userProfile?.location ?? undefined}
        userLinkedin={userProfile?.linkedin ?? undefined}
        userGithub={userProfile?.github ?? undefined}
        userWebsite={userProfile?.website ?? undefined}
        opportunityCompany={opportunity.company ?? undefined}
      />
    </div>
  );
}
