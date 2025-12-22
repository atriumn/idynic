import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ExternalLink, ArrowLeft, MapPin, DollarSign, Briefcase, Users, Clock, Linkedin, Globe, TrendingUp, Newspaper, Lightbulb, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { computeOpportunityMatches } from "@/lib/ai/match-opportunity";
import { TailoredProfile } from "@/components/tailored-profile";
import { ShareLinkModal } from "@/components/share-link-modal";

function formatSalary(min: number | null, max: number | null, currency: string | null): string | null {
  if (!min && !max) return null;
  const curr = currency || "$";
  const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  if (min && max) {
    return `${curr}${formatter.format(min)} - ${curr}${formatter.format(max)}`;
  }
  if (min) return `${curr}${formatter.format(min)}+`;
  if (max) return `Up to ${curr}${formatter.format(max)}`;
  return null;
}

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
        viewCount: (sharedLink.shared_link_views as { id: string }[] | null)?.length || 0,
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
        <div className="flex gap-4">
          {opportunity.company_logo_url && (
            <div className="flex-shrink-0">
              <Image
                src={opportunity.company_logo_url}
                alt={`${opportunity.company} logo`}
                width={64}
                height={64}
                className="rounded-lg"
              />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold">{opportunity.title}</h1>
              {opportunity.source === "linkedin" && (
                <Linkedin className="h-5 w-5 text-[#0A66C2]" />
              )}
            </div>
            {opportunity.company && (
              <div className="flex items-center gap-1 text-muted-foreground mt-1">
                <Building2 className="h-4 w-4" />
                {opportunity.company}
              </div>
            )}
            {/* Job metadata */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              {opportunity.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {opportunity.location}
                </div>
              )}
              {opportunity.seniority_level && (
                <div className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {opportunity.seniority_level}
                </div>
              )}
              {opportunity.employment_type && (
                <span>{opportunity.employment_type}</span>
              )}
            </div>
            {/* Salary and applicants */}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {formatSalary(opportunity.salary_min, opportunity.salary_max, opportunity.salary_currency) && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {formatSalary(opportunity.salary_min, opportunity.salary_max, opportunity.salary_currency)}
                </Badge>
              )}
              {opportunity.applicant_count && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {opportunity.applicant_count} applicants
                </span>
              )}
              {opportunity.posted_date && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Posted {new Date(opportunity.posted_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
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

      {/* Company Insights */}
      {opportunity.company && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Insights
              </CardTitle>
              {opportunity.company_researched_at ? (
                <span className="text-xs text-muted-foreground">
                  Researched {new Date(opportunity.company_researched_at).toLocaleDateString()}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Researching...
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Company metadata row */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {opportunity.company_industry && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {opportunity.company_industry}
                </Badge>
              )}
              {opportunity.company_is_public && opportunity.company_stock_ticker && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {opportunity.company_stock_ticker}
                </Badge>
              )}
              {opportunity.company_url && (
                <a
                  href={opportunity.company_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {new URL(opportunity.company_url).hostname.replace('www.', '')}
                </a>
              )}
            </div>

            {/* Why This Role */}
            {opportunity.company_role_context && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Why This Role
                </h4>
                <p className="text-sm text-muted-foreground">
                  {opportunity.company_role_context}
                </p>
              </div>
            )}

            {/* Recent News */}
            {opportunity.company_recent_news && Array.isArray(opportunity.company_recent_news) && opportunity.company_recent_news.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                  <Newspaper className="h-4 w-4 text-blue-500" />
                  Recent News
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {(opportunity.company_recent_news as string[]).map((news, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground/50 mt-0.5">•</span>
                      <span>{news}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Likely Challenges */}
            {opportunity.company_challenges && Array.isArray(opportunity.company_challenges) && opportunity.company_challenges.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Likely Challenges
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {(opportunity.company_challenges as string[]).map((challenge, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground/50 mt-0.5">•</span>
                      <span>{challenge}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Empty state when research hasn't completed yet */}
            {!opportunity.company_researched_at && (
              <p className="text-sm text-muted-foreground italic">
                We&apos;re researching {opportunity.company} in the background. Refresh in a few seconds to see insights.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Job Description */}
      {(opportunity.description || opportunity.description_html) && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            {opportunity.description_html ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: opportunity.description_html }}
              />
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {opportunity.description}
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
