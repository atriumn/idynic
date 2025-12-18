"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Check, AlertCircle, Lightbulb, Copy } from "lucide-react";

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

interface ResumeData {
  summary: string;
  skills: string[];
  experience: Array<{
    company: string;
    title: string;
    dates: string;
    location: string | null;
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    year: string | null;
  }>;
}

interface TailoredProfileProps {
  opportunityId: string;
}

export function TailoredProfile({ opportunityId }: TailoredProfileProps) {
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [profile, setProfile] = useState<{
    talking_points: TalkingPoints;
    narrative: string;
    resume_data: ResumeData;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

          {/* Skills */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Skills (Ordered by Relevance)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {resume_data.skills.map((skill, i) => (
                  <Badge key={i} variant={i < 5 ? "default" : "secondary"}>
                    {skill}
                  </Badge>
                ))}
              </div>
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
                </div>
              ))}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
