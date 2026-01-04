import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, MapPin, Linkedin, Github, Building2 } from "lucide-react";
import Image from "next/image";
import { SharedProfileResume } from "@/components/shared-profile-resume";
import { RecruiterWaitlistCTA } from "@/components/recruiter-waitlist-cta";
import { CompanyLogo } from "@/components/company-logo";

interface SkillCategory {
  category: string;
  skills: string[];
}

interface ResumeData {
  summary?: string;
  skills?: SkillCategory[] | string[];
  experience?: Array<{
    company: string;
    companyDomain?: string | null;
    title: string;
    dates: string;
    location?: string | null;
    bullets: string[];
  }>;
  additionalExperience?: Array<{
    company: string;
    companyDomain?: string | null;
    title: string;
    dates: string;
    location?: string | null;
    bullets: string[];
  }>;
  ventures?: Array<{
    name: string;
    role: string;
    status?: string | null;
    description?: string | null;
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    year?: string | null;
  }>;
}

interface SharedProfileData {
  candidate: {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
    logoUrl: string | null;
  };
  opportunity: {
    title: string;
    company: string | null;
  };
  narrative: string | null;
  resumeData: ResumeData;
}

async function getSharedProfile(token: string): Promise<{
  data?: SharedProfileData;
  error?: "not_found" | "expired";
  candidateName?: string;
}> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/shared/${token}`,
    { cache: "no-store" },
  );

  if (res.status === 404) {
    return { error: "not_found" };
  }

  if (res.status === 410) {
    const data = await res.json();
    return { error: "expired", candidateName: data.candidateName };
  }

  if (!res.ok) {
    return { error: "not_found" };
  }

  return { data: await res.json() };
}

export default async function SharedProfilePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getSharedProfile(token);

  if (result.error === "not_found") {
    notFound();
  }

  if (result.error === "expired") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-semibold mb-2">Link Expired</h1>
            <p className="text-muted-foreground mb-4">
              This link has expired. Please reach out to{" "}
              <strong>{result.candidateName || "the candidate"}</strong> for a
              fresh link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { candidate, opportunity, narrative, resumeData } = result.data!;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {candidate.logoUrl && (
                <Image
                  src={candidate.logoUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="rounded-full"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">
                  {candidate.name || "Candidate"}
                </h1>
                <p className="text-muted-foreground flex items-center gap-1">
                  {opportunity.title}
                  {opportunity.company && (
                    <>
                      <span className="mx-1">at</span>
                      <Building2 className="h-4 w-4" />
                      {opportunity.company}
                    </>
                  )}
                </p>
              </div>
            </div>
            <SharedProfileResume
              resumeData={resumeData as Record<string, unknown>}
              candidateName={candidate.name}
              candidateContact={{
                email: candidate.email,
                phone: candidate.phone,
                location: candidate.location,
                linkedin: candidate.linkedin,
                github: candidate.github,
                website: candidate.website,
              }}
            />
          </div>

          {/* Contact info */}
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
            {candidate.email && (
              <a
                href={`mailto:${candidate.email}`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Mail className="h-4 w-4" />
                {candidate.email}
              </a>
            )}
            {candidate.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {candidate.phone}
              </span>
            )}
            {candidate.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {candidate.location}
              </span>
            )}
            {candidate.linkedin && (
              <a
                href={
                  candidate.linkedin.startsWith("http")
                    ? candidate.linkedin
                    : `https://${candidate.linkedin}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </a>
            )}
            {candidate.github && (
              <a
                href={
                  candidate.github.startsWith("http")
                    ? candidate.github
                    : `https://${candidate.github}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Content with Tabs */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="narrative">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="narrative">Narrative</TabsTrigger>
            <TabsTrigger value="resume">Resume</TabsTrigger>
          </TabsList>

          <TabsContent value="narrative" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Cover Letter Narrative
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {narrative || "No narrative available."}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resume" className="mt-4 space-y-4">
            {/* Summary */}
            {resumeData.summary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Professional Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{resumeData.summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Experience */}
            {resumeData.experience && resumeData.experience.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Experience</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {resumeData.experience.map((job, i) => (
                    <div key={i}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-3">
                          <CompanyLogo
                            domain={job.companyDomain}
                            companyName={job.company}
                            size={32}
                            className="mt-0.5 shrink-0"
                          />
                          <div>
                            <p className="font-semibold">{job.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {job.company}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{job.dates}</p>
                          {job.location && <p>{job.location}</p>}
                        </div>
                      </div>
                      {job.bullets && job.bullets.length > 0 && (
                        <ul className="list-disc list-inside space-y-1 ml-11">
                          {job.bullets.map((bullet, j) => (
                            <li
                              key={j}
                              className="text-sm"
                              dangerouslySetInnerHTML={{
                                __html: bullet.replace(
                                  /\*\*(.*?)\*\*/g,
                                  "<strong>$1</strong>",
                                ),
                              }}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Additional Experience */}
            {resumeData.additionalExperience &&
              resumeData.additionalExperience.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      Additional Experience
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {resumeData.additionalExperience.map((job, i) => (
                      <div key={i}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <CompanyLogo
                              domain={job.companyDomain}
                              companyName={job.company}
                              size={28}
                              className="mt-0.5 shrink-0"
                            />
                            <div>
                              <p className="font-medium">{job.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {job.company}
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <p>{job.dates}</p>
                            {job.location && <p>{job.location}</p>}
                          </div>
                        </div>
                        {job.bullets && job.bullets.length > 0 && (
                          <ul className="list-disc list-inside space-y-1 mt-1 ml-10">
                            {job.bullets.map((bullet, j) => (
                              <li
                                key={j}
                                className="text-sm"
                                dangerouslySetInnerHTML={{
                                  __html: bullet.replace(
                                    /\*\*(.*?)\*\*/g,
                                    "<strong>$1</strong>",
                                  ),
                                }}
                              />
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

            {/* Ventures */}
            {resumeData.ventures && resumeData.ventures.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Ventures & Projects
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {resumeData.ventures.map((venture, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{venture.name}</p>
                        {venture.status && (
                          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {venture.status}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {venture.role}
                      </p>
                      {venture.description && (
                        <p className="text-sm mt-1">{venture.description}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Skills */}
            {resumeData.skills && resumeData.skills.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  {typeof resumeData.skills[0] === "string" ? (
                    // Old format: flat array of strings
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {(resumeData.skills as string[]).map((skill, i) => (
                        <div
                          key={i}
                          className={`px-3 py-1.5 rounded-md text-sm ${
                            i < 5
                              ? "bg-primary/10 text-primary font-medium"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {skill}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // New format: categorized
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {(resumeData.skills as SkillCategory[]).map(
                        (category, catIndex) => (
                          <div
                            key={catIndex}
                            className={`p-3 rounded-lg border ${
                              catIndex === 0
                                ? "bg-primary/5 border-primary/20"
                                : "bg-muted/30 border-border"
                            }`}
                          >
                            <h4
                              className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                                catIndex === 0
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {category.category}
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                              {category.skills.map((skill, i) => (
                                <span
                                  key={i}
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    catIndex === 0 && i < 3
                                      ? "bg-primary/15 text-primary font-medium"
                                      : "bg-background text-foreground/70"
                                  }`}
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Education */}
            {resumeData.education && resumeData.education.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Education</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {resumeData.education.map((edu, i) => (
                    <div key={i} className="flex justify-between">
                      <div>
                        <p className="font-medium">{edu.degree}</p>
                        <p className="text-sm text-muted-foreground">
                          {edu.institution}
                        </p>
                      </div>
                      {edu.year && (
                        <p className="text-sm text-muted-foreground">
                          {edu.year}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background py-6 mt-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Image src="/logo.svg" alt="Idynic" width={20} height={20} />
              Powered by Idynic
            </div>
            <RecruiterWaitlistCTA />
          </div>
        </div>
      </footer>
    </div>
  );
}
