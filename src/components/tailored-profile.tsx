"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Check, AlertCircle, Lightbulb, Copy, X, Eye } from "lucide-react";
import { ResumePDFViewer, ResumePDFDownload } from "@/components/resume-pdf";
import type { ResumeDocumentProps } from "@/components/resume-pdf";

interface TalkingPoints {
  strengths: Array<{
    requirement: string;
    requirement_type: string;
    claim_id: string;
    claim_label: string;
    evidence_summary: string;
    framing: string;
    confidence: number;
  }>;
  gaps: Array<{
    requirement: string;
    requirement_type: string;
    mitigation: string;
    related_claims: string[];
  }>;
  inferences: Array<{
    inferred_claim: string;
    derived_from: string[];
    reasoning: string;
  }>;
}

interface SkillCategory {
  category: string;
  skills: string[];
}

interface ResumeData {
  summary: string;
  skills: SkillCategory[];
  experience: Array<{
    company: string;
    title: string;
    dates: string;
    location: string | null;
    bullets: string[];
  }>;
  additionalExperience: Array<{
    company: string;
    title: string;
    dates: string;
    location: string | null;
    bullets: string[];
  }>;
  ventures: Array<{
    name: string;
    role: string;
    status: string | null;
    description: string | null;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    year: string | null;
  }>;
}

interface RequirementMatch {
  requirement: {
    text: string;
    type: string;
    category: "mustHave" | "niceToHave";
  };
  bestMatch: {
    id: string;
    type: string;
    label: string;
    description: string | null;
    confidence: number;
    similarity: number;
  } | null;
}

interface TailoredProfileProps {
  opportunityId: string;
  requirementMatches?: RequirementMatch[];
  userName?: string;
  userEmail?: string;
  opportunityCompany?: string;
}

export function TailoredProfile({
  opportunityId,
  requirementMatches = [],
  userName,
  userEmail,
  opportunityCompany,
}: TailoredProfileProps) {
  const [loading, setLoading] = useState(true); // Start true to show loading on mount
  const [regenerating, setRegenerating] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [profile, setProfile] = useState<{
    talking_points: TalkingPoints;
    narrative: string;
    resume_data: ResumeData;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Fetch existing profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/generate-profile?opportunityId=${opportunityId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.profile) {
            setProfile(data.profile);
          }
        }
      } catch {
        // Ignore fetch errors - will show generate button
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [opportunityId]);

  const generateProfile = async (regenerate = false) => {
    if (regenerate) {
      setRegenerating(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/generate-profile", {
        method: regenerate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate profile");
      }

      const data = await response.json();
      setProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Failed to copy to clipboard. Please check permissions.");
    }
  };

  if (!profile && !loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">
            Generate a tailored profile to see how your experience matches this role.
          </p>
          <Button onClick={() => generateProfile()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Tailored Profile"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Analyzing your profile...</p>
          <p className="text-sm text-muted-foreground mt-1">This may take 10-20 seconds</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => generateProfile()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!profile) return null;

  const { talking_points, narrative, resume_data } = profile;

  // Build PDF document data from resume
  const pdfData: ResumeDocumentProps | null = resume_data ? {
    name: userName || "Your Name",
    email: userEmail,
    phone: undefined,
    summary: resume_data.summary || "",
    skills: resume_data.skills || [],
    experience: resume_data.experience || [],
    additionalExperience: resume_data.additionalExperience || [],
    ventures: resume_data.ventures || [],
    education: resume_data.education || [],
  } : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tailored Profile</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateProfile(true)}
          disabled={regenerating}
        >
          {regenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Regenerate
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="talking-points">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="talking-points">Talking Points</TabsTrigger>
          <TabsTrigger value="narrative">Narrative</TabsTrigger>
          <TabsTrigger value="resume">Resume</TabsTrigger>
        </TabsList>

        <TabsContent value="talking-points" className="space-y-4 mt-4">
          {/* Empty state */}
          {talking_points.strengths.length === 0 &&
            talking_points.gaps.length === 0 &&
            talking_points.inferences.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No talking points generated. Try regenerating the profile.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Strengths */}
          {talking_points.strengths.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Strengths ({talking_points.strengths.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {talking_points.strengths.map((s, i) => (
                  <div key={i} className="border-l-2 border-green-500 pl-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{s.claim_label}</span>
                      <Badge variant="outline" className="text-xs">
                        {s.requirement_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      For: {s.requirement}
                    </p>
                    <p className="text-sm">{s.evidence_summary}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      💡 {s.framing}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Gaps */}
          {talking_points.gaps.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Gaps ({talking_points.gaps.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {talking_points.gaps.map((g, i) => (
                  <div key={i} className="border-l-2 border-amber-500 pl-3">
                    <p className="font-medium">{g.requirement}</p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      ✨ {g.mitigation}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Inferences */}
          {talking_points.inferences.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-purple-500" />
                  Inferences ({talking_points.inferences.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {talking_points.inferences.map((inf, i) => (
                  <div key={i} className="border-l-2 border-purple-500 pl-3">
                    <p className="font-medium">{inf.inferred_claim}</p>
                    <p className="text-sm text-muted-foreground">{inf.reasoning}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Required Qualifications */}
          {requirementMatches.filter((rm) => rm.requirement.category === "mustHave").length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Required Qualifications</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {requirementMatches
                    .filter((rm) => rm.requirement.category === "mustHave")
                    .map((rm, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        {rm.bestMatch ? (
                          <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1">
                          <span className={rm.bestMatch ? "" : "text-muted-foreground"}>
                            {rm.requirement.text}
                          </span>
                          {rm.bestMatch && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({rm.bestMatch.label})
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Nice to Have */}
          {requirementMatches.filter((rm) => rm.requirement.category === "niceToHave").length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Nice to Have</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {requirementMatches
                    .filter((rm) => rm.requirement.category === "niceToHave")
                    .map((rm, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        {rm.bestMatch ? (
                          <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1">
                          <span className={rm.bestMatch ? "" : "text-muted-foreground"}>
                            {rm.requirement.text}
                          </span>
                          {rm.bestMatch && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({rm.bestMatch.label})
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="narrative" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Cover Letter Narrative</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(narrative, "narrative")}
              >
                {copied === "narrative" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {narrative}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resume" className="mt-4 space-y-4">
          {/* PDF Controls */}
          {pdfData && (
            <div className="flex items-center gap-2 pb-2 border-b">
              <Button
                variant={showPDFPreview ? "default" : "outline"}
                size="sm"
                onClick={() => setShowPDFPreview(!showPDFPreview)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {showPDFPreview ? "HTML View" : "PDF Preview"}
              </Button>
              <ResumePDFDownload
                data={pdfData}
                filename={`resume-${opportunityCompany?.toLowerCase().replace(/\s+/g, "-") || "tailored"}.pdf`}
              />
            </div>
          )}

          {/* PDF Preview */}
          {showPDFPreview && pdfData ? (
            <ResumePDFViewer data={pdfData} />
          ) : (
            <>
              {/* Summary */}
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Professional Summary</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(resume_data.summary, "summary")}
                  >
                    {copied === "summary" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{resume_data.summary}</p>
                </CardContent>
              </Card>

          {/* Experience */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {resume_data.experience.map((job, i) => (
                <div key={i}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold">{job.title}</p>
                      <p className="text-sm text-muted-foreground">{job.company}</p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{job.dates}</p>
                      {job.location && <p>{job.location}</p>}
                    </div>
                  </div>
                  {job.bullets.length > 0 && (
                    <ul className="list-disc list-inside space-y-1">
                      {job.bullets.map((bullet, j) => (
                        <li
                          key={j}
                          className="text-sm"
                          dangerouslySetInnerHTML={{
                            __html: bullet.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                          }}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Additional Experience - lighter on details, older roles */}
          {resume_data.additionalExperience?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Additional Experience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {resume_data.additionalExperience.map((job, i) => (
                  <div key={i}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{job.title}</p>
                        <p className="text-sm text-muted-foreground">{job.company}</p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{job.dates}</p>
                        {job.location && <p>{job.location}</p>}
                      </div>
                    </div>
                    {job.bullets.length > 0 && (
                      <ul className="list-disc list-inside space-y-1 mt-1">
                        {job.bullets.map((bullet, j) => (
                          <li
                            key={j}
                            className="text-sm"
                            dangerouslySetInnerHTML={{
                              __html: bullet.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
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
          {resume_data.ventures?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ventures & Projects</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {resume_data.ventures.map((venture, i) => (
                  <div key={i} className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{venture.name}</p>
                        {venture.status && (
                          <Badge variant="outline" className="text-xs">
                            {venture.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{venture.role}</p>
                      {venture.description && (
                        <p className="text-sm mt-1">{venture.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Skills - Grid Layout */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Skills</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Handle both old format (string[]) and new format (SkillCategory[]) */}
              {Array.isArray(resume_data.skills) && resume_data.skills.length > 0 && (
                typeof resume_data.skills[0] === "string" ? (
                  // Old format: flat array of strings - simple grid
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {(resume_data.skills as unknown as string[]).map((skill, i) => (
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
                  // New format: categorized grid
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {(resume_data.skills as SkillCategory[]).map((category, catIndex) => (
                      <div
                        key={catIndex}
                        className={`p-3 rounded-lg border ${
                          catIndex === 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border"
                        }`}
                      >
                        <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                          catIndex === 0 ? "text-primary" : "text-muted-foreground"
                        }`}>
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
                    ))}
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* Education */}
          {resume_data.education.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Education</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {resume_data.education.map((edu, i) => (
                  <div key={i} className="flex justify-between">
                    <div>
                      <p className="font-medium">{edu.degree}</p>
                      <p className="text-sm text-muted-foreground">{edu.institution}</p>
                    </div>
                    {edu.year && (
                      <p className="text-sm text-muted-foreground">{edu.year}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
