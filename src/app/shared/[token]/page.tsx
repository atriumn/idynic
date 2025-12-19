import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, MapPin, Linkedin, Github, Building2 } from "lucide-react";
import Image from "next/image";
import { SharedProfileResume } from "@/components/shared-profile-resume";
import { RecruiterWaitlistCTA } from "@/components/recruiter-waitlist-cta";

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
  resumeData: Record<string, unknown>;
}

async function getSharedProfile(token: string): Promise<{
  data?: SharedProfileData;
  error?: "not_found" | "expired";
  candidateName?: string;
}> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/shared/${token}`,
    { cache: "no-store" }
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
              <strong>{result.candidateName || "the candidate"}</strong> for a fresh link.
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
                <h1 className="text-2xl font-bold">{candidate.name || "Candidate"}</h1>
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
              resumeData={resumeData}
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
              <a href={`mailto:${candidate.email}`} className="flex items-center gap-1 hover:text-foreground">
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
                href={candidate.linkedin.startsWith("http") ? candidate.linkedin : `https://${candidate.linkedin}`}
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
                href={candidate.github.startsWith("http") ? candidate.github : `https://${candidate.github}`}
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

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Narrative */}
        {narrative && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">About</h2>
            <Card>
              <CardContent className="pt-4">
                <p className="whitespace-pre-wrap">{narrative}</p>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Resume */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Resume</h2>
          <SharedProfileResumeInline resumeData={resumeData} />
        </section>
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

// Inline resume component (simplified view)
function SharedProfileResumeInline({ resumeData }: { resumeData: Record<string, unknown> }) {
  const data = resumeData as {
    summary?: string;
    skills?: Array<{ category: string; skills: string[] }>;
    experience?: Array<{
      company: string;
      title: string;
      dates: string;
      location?: string;
      bullets: string[];
    }>;
    education?: Array<{
      institution: string;
      degree: string;
      year?: string;
    }>;
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-6">
        {/* Summary */}
        {data.summary && (
          <div>
            <h3 className="font-semibold mb-2">Summary</h3>
            <p className="text-muted-foreground">{data.summary}</p>
          </div>
        )}

        {/* Skills */}
        {data.skills && data.skills.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Skills</h3>
            <div className="space-y-2">
              {data.skills.map((cat, i) => (
                <div key={i}>
                  <span className="text-sm font-medium">{cat.category}: </span>
                  <span className="text-sm text-muted-foreground">{cat.skills.join(", ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Experience */}
        {data.experience && data.experience.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Experience</h3>
            <div className="space-y-4">
              {data.experience.map((exp, i) => (
                <div key={i}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{exp.title}</div>
                      <div className="text-sm text-muted-foreground">{exp.company}</div>
                    </div>
                    <div className="text-sm text-muted-foreground text-right">
                      {exp.dates}
                      {exp.location && <div>{exp.location}</div>}
                    </div>
                  </div>
                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {exp.bullets.map((bullet, j) => (
                        <li key={j} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-muted-foreground/50">•</span>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {data.education && data.education.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Education</h3>
            <div className="space-y-2">
              {data.education.map((edu, i) => (
                <div key={i} className="flex justify-between">
                  <div>
                    <div className="font-medium">{edu.degree}</div>
                    <div className="text-sm text-muted-foreground">{edu.institution}</div>
                  </div>
                  {edu.year && <div className="text-sm text-muted-foreground">{edu.year}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
