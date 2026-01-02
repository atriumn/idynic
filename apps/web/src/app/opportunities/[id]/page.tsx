import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Buildings,
  ArrowSquareOut,
  ArrowLeft,
  MapPin,
  CurrencyDollar,
  LinkedinLogo,
  Globe,
  TrendUp,
  Newspaper,
  Lightbulb,
  Info,
  Check,
  X,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import Image from "next/image";
import { computeOpportunityMatches } from "@/lib/ai/match-opportunity";
import { TailoredProfile } from "@/components/tailored-profile";
import { ShareLinkModal } from "@/components/share-link-modal";
import { ReresearchCompanyButton } from "@/components/reresearch-company-button";
import { OpportunityNotes } from "@/components/opportunity-notes";
import { MatchScoreVisualizer } from "@/components/match-score-visualizer";

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
  tracking: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700",
  applied: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  interviewing: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  offer: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  rejected: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  archived: "bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

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
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link
        href="/opportunities"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 mr-1.5 transition-transform group-hover:-translate-x-1" />
        Back to Dashboard
      </Link>

      {/* Modern Integrated Header */}
      <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-12">
        <div className="flex flex-col md:flex-row gap-6 items-start flex-1 min-w-0">
          <div className="h-24 w-24 rounded-2xl border-2 border-muted bg-background p-2 shadow-sm flex items-center justify-center shrink-0">
            {opportunity.company_logo_url ? (
              <div className="relative h-20 w-20">
                <Image
                  src={opportunity.company_logo_url}
                  alt={`${opportunity.company} logo`}
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <Buildings className="h-10 w-10 text-muted-foreground/30" />
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <Badge variant="outline" className={`font-semibold px-2.5 py-0.5 ${STATUS_COLORS[opportunity.status || "tracking"]}`}>
                  {opportunity.status?.toUpperCase() || "TRACKING"}
                </Badge>
                {opportunity.source === "linkedin" && (
                  <Badge variant="outline" className="bg-[#0A66C2]/5 text-[#0A66C2] border-[#0A66C2]/20 font-medium">
                    <LinkedinLogo className="h-3.5 w-3.5 mr-1.5" weight="fill" />
                    LINKEDIN
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground leading-tight">
                {opportunity.title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-lg font-medium text-muted-foreground">
              {opportunity.company && (
                <div className="flex items-center gap-2.5 text-foreground">
                  <span className="bg-muted px-2 py-0.5 rounded text-base font-bold">{opportunity.company}</span>
                  {opportunity.company_url && (
                    <a
                      href={opportunity.company_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground/40 hover:text-primary transition-colors"
                    >
                      <Globe className="h-5 w-5" />
                    </a>
                  )}
                </div>
              )}
              {opportunity.location && (
                <div className="flex items-center gap-2 text-base">
                  <MapPin weight="bold" className="h-4 w-4" />
                  {opportunity.location}
                </div>
              )}
              {formatSalary(opportunity.salary_min, opportunity.salary_max, opportunity.salary_currency) && (
                <div className="flex items-center gap-1.5 text-base text-green-600 dark:text-green-400">
                  <CurrencyDollar weight="bold" className="h-4 w-4" />
                  {formatSalary(opportunity.salary_min, opportunity.salary_max, opportunity.salary_currency)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto shrink-0">
          {opportunity.url && (
            <Button size="lg" asChild className="font-bold shadow-lg shadow-primary/20">
              <a href={opportunity.url} target="_blank" rel="noopener noreferrer">
                <ArrowSquareOut className="h-5 w-5 mr-2" weight="bold" />
                View Posting
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Sidebar: Analysis */}
        <div className="lg:col-span-4 space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Alignment Analysis</h2>
              <div className="h-px flex-1 bg-muted" />
            </div>
            <Card className="border-none shadow-none bg-muted/30">
              <CardContent className="pt-8">
                <MatchScoreVisualizer
                  overallScore={matchResult.overallScore}
                  mustHaveScore={matchResult.mustHaveScore}
                  niceToHaveScore={matchResult.niceToHaveScore}
                  matchDetails={{
                    mustHave: {
                      matched: matchResult.requirementMatches.filter(m => m.requirement.category === 'mustHave' && m.bestMatch !== null).length,
                      total: matchResult.requirementMatches.filter(m => m.requirement.category === 'mustHave').length
                    },
                    niceToHave: {
                      matched: matchResult.requirementMatches.filter(m => m.requirement.category === 'niceToHave' && m.bestMatch !== null).length,
                      total: matchResult.requirementMatches.filter(m => m.requirement.category === 'niceToHave').length
                    }
                  }}
                />
              </CardContent>
            </Card>
          </section>

          {/* Requirement Matches */}
          {matchResult.requirementMatches.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Requirements</h2>
                <div className="h-px flex-1 bg-muted" />
              </div>
              <Card className="border-none shadow-none bg-muted/30">
                <CardContent className="pt-4 space-y-4">
                  {/* Must Have */}
                  {matchResult.requirementMatches.filter(m => m.requirement.category === 'mustHave').length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Required</h3>
                      <ul className="space-y-2">
                        {matchResult.requirementMatches
                          .filter(m => m.requirement.category === 'mustHave')
                          .map((rm, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              {rm.bestMatch ? (
                                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" weight="bold" />
                              ) : (
                                <X className="h-4 w-4 text-red-500 mt-0.5 shrink-0" weight="bold" />
                              )}
                              <div className="flex-1 min-w-0">
                                <span className={rm.bestMatch ? "text-foreground" : "text-muted-foreground"}>
                                  {rm.requirement.text}
                                </span>
                                {rm.bestMatch && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    ↳ {rm.bestMatch.label}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {/* Nice to Have */}
                  {matchResult.requirementMatches.filter(m => m.requirement.category === 'niceToHave').length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Nice to Have</h3>
                      <ul className="space-y-2">
                        {matchResult.requirementMatches
                          .filter(m => m.requirement.category === 'niceToHave')
                          .map((rm, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              {rm.bestMatch ? (
                                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" weight="bold" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" weight="bold" />
                              )}
                              <div className="flex-1 min-w-0">
                                <span className={rm.bestMatch ? "text-foreground" : "text-muted-foreground"}>
                                  {rm.requirement.text}
                                </span>
                                {rm.bestMatch && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    ↳ {rm.bestMatch.label}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Notes</h2>
              <div className="h-px flex-1 bg-muted" />
            </div>
            <OpportunityNotes opportunityId={id} />
          </section>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-8">
          <Tabs defaultValue="research" className="w-full">
            <TabsList className="w-full grid grid-cols-2 mb-8 bg-muted/30 p-1.5 h-12 rounded-xl">
              <TabsTrigger value="tailoring" className="h-full text-xs font-bold uppercase tracking-wider rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Tailored Application
              </TabsTrigger>
              <TabsTrigger value="research" className="h-full text-xs font-bold uppercase tracking-wider rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Research & Context
              </TabsTrigger>
            </TabsList>

            <TabsContent value="research" className="space-y-12 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
              {/* Company Context */}
              {opportunity.company && (
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Buildings className="h-6 w-6 text-primary" weight="bold" />
                      </div>
                      <h2 className="text-2xl font-black tracking-tight">Company Context</h2>
                    </div>
                    {opportunity.company_researched_at && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">
                          SYNTHESIZED {new Date(opportunity.company_researched_at).toLocaleDateString()}
                        </span>
                        <ReresearchCompanyButton opportunityId={id} />
                      </div>
                    )}
                  </div>

                  <Card className="border-2 border-muted overflow-hidden">
                    <CardContent className="p-0">
                      <div className="grid grid-cols-1 md:grid-cols-2">
                        {/* Role Why */}
                        <div className="md:col-span-2 p-6 border-b-2 border-muted bg-muted/10">
                          <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="h-5 w-5 text-amber-500" weight="fill" />
                            <h3 className="font-bold text-sm uppercase tracking-wider">Strategic Role Intent</h3>
                          </div>
                          <p className="text-base leading-relaxed font-medium italic text-muted-foreground">
                            &ldquo;{opportunity.company_role_context}&rdquo;
                          </p>
                        </div>

                        {/* News */}
                        <div className="p-6 border-r-0 md:border-r-2 border-muted">
                          <div className="flex items-center gap-2 mb-4">
                            <Newspaper className="h-5 w-5 text-blue-500" weight="fill" />
                            <h3 className="font-bold text-sm uppercase tracking-wider">Market Intelligence</h3>
                          </div>
                          <ul className="space-y-3">
                            {Array.isArray(opportunity.company_recent_news) && (opportunity.company_recent_news as string[]).map((news, i) => (
                              <li key={i} className="flex gap-3 text-sm leading-snug">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                {news}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Challenges */}
                        <div className="p-6 bg-muted/5">
                          <div className="flex items-center gap-2 mb-4">
                            <TrendUp className="h-5 w-5 text-green-500" weight="fill" />
                            <h3 className="font-bold text-sm uppercase tracking-wider">Likely Challenges</h3>
                          </div>
                          <ul className="space-y-3">
                            {Array.isArray(opportunity.company_challenges) && (opportunity.company_challenges as string[]).map((challenge, i) => (
                              <li key={i} className="flex gap-3 text-sm leading-snug">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                                {challenge}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* Job Description */}
              <section className="space-y-6 pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-500/10 rounded-lg">
                    <Info className="h-6 w-6 text-slate-600" weight="bold" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">Job Posting</h2>
                </div>
                <Card className="border-2 border-muted shadow-none">
                  <CardContent className="pt-6">
                    {opportunity.description_html ? (
                      <div
                        className="prose prose-slate dark:prose-invert max-w-none prose-sm md:prose-base"
                        dangerouslySetInnerHTML={{ __html: opportunity.description_html }}
                      />
                    ) : (
                      <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {opportunity.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </section>
            </TabsContent>

            <TabsContent value="tailoring" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
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
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}