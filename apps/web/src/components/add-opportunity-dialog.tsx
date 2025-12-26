"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Linkedin, CheckCircle2, XCircle } from "lucide-react";
import { useDocumentJob } from "@/lib/hooks/use-document-job";
import { OPPORTUNITY_PHASES, PHASE_LABELS, type DocumentJobPhase } from "@idynic/shared/types";

function isLinkedInJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("linkedin.com") && parsed.pathname.includes("/jobs/view/");
  } catch {
    return false;
  }
}

function looksLikeJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Known job boards
    const jobBoards = [
      "indeed.com", "glassdoor.com", "ziprecruiter.com", "monster.com",
      "dice.com", "builtin.com", "lever.co", "greenhouse.io", "workday.com",
      "myworkdayjobs.com", "smartrecruiters.com", "ashbyhq.com", "wellfound.com",
    ];

    if (jobBoards.some((board) => hostname.includes(board))) return true;
    if (hostname.startsWith("jobs.") || hostname.startsWith("careers.")) return true;

    const jobPatterns = ["/job/", "/jobs/", "/career/", "/careers/", "/position/", "/opening/", "/apply/"];
    if (jobPatterns.some((pattern) => pathname.includes(pattern))) return true;

    return false;
  } catch {
    return false;
  }
}

export function AddOpportunityDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [isLinkedIn, setIsLinkedIn] = useState(false);
  const [isJobUrl, setIsJobUrl] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const router = useRouter();

  const { job, displayMessages } = useDocumentJob(jobId);

  // Handle job completion or failure
  useEffect(() => {
    if (job?.status === "completed") {
      // Brief delay so user sees "completed" state
      setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 1000);
    }
    if (job?.status === "failed") {
      setError(job.error || "Processing failed");
      setJobId(null);
    }
  }, [job?.status, job?.error, router]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setIsLinkedIn(isLinkedInJobUrl(newUrl));
    setIsJobUrl(looksLikeJobUrl(newUrl) || isLinkedInJobUrl(newUrl));
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setUrl("");
      setIsLinkedIn(false);
      setIsJobUrl(false);
      setError(null);
      setJobId(null);
      setIsSubmitting(false);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setJobId(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      url: formData.get("url") as string,
      description: formData.get("description") as string,
    };

    try {
      const response = await fetch("/api/process-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to add opportunity");
      }

      // Start listening to job updates
      setJobId(result.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isProcessing = !!jobId && job?.status === "processing";
  const isCompleted = job?.status === "completed";
  const currentPhase = job?.phase as DocumentJobPhase | null;
  const phaseIndex = currentPhase ? OPPORTUNITY_PHASES.indexOf(currentPhase) : -1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Opportunity
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        {!jobId ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add Opportunity</DialogTitle>
              <DialogDescription>
                Add a job posting to track and see how your profile matches.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="url">Job URL</Label>
                <div className="relative">
                  <Input
                    id="url"
                    name="url"
                    type="url"
                    placeholder="https://linkedin.com/jobs/view/..."
                    value={url}
                    onChange={handleUrlChange}
                    className={isLinkedIn ? "pr-10" : ""}
                  />
                  {isLinkedIn && (
                    <Linkedin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0A66C2]" />
                  )}
                </div>
                {isJobUrl && (
                  <p className="text-sm text-muted-foreground">
                    {isLinkedIn
                      ? "LinkedIn job detected - we'll auto-fill the details"
                      : "Job URL detected - we'll try to fetch the details"
                    }
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">
                  Job Description {!isJobUrl && "*"}
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder={isJobUrl ? "Optional - will be fetched from the URL" : "Paste the full job description here..."}
                  className="min-h-[200px]"
                  required={!isJobUrl}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting
                  ? (isLinkedIn ? "Starting..." : "Starting...")
                  : "Add Opportunity"
                }
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="py-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isCompleted ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Opportunity Added
                  </>
                ) : job?.status === "failed" ? (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    Processing Failed
                  </>
                ) : (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    Processing Opportunity
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {isCompleted
                  ? "Your opportunity has been saved successfully."
                  : currentPhase
                    ? PHASE_LABELS[currentPhase]
                    : "Starting..."
                }
              </DialogDescription>
            </DialogHeader>

            {/* Progress bar */}
            {isProcessing && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  {OPPORTUNITY_PHASES.map((phase, i) => (
                    <span
                      key={phase}
                      className={i <= phaseIndex ? "text-primary" : ""}
                    >
                      {i + 1}
                    </span>
                  ))}
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{
                      width: `${((phaseIndex + 1) / OPPORTUNITY_PHASES.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Ticker messages */}
            {displayMessages.length > 0 && (
              <div className="mt-4 space-y-1 max-h-32 overflow-hidden">
                {displayMessages.slice(0, 4).map((msg, i) => (
                  <p
                    key={msg.id}
                    className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2"
                    style={{ opacity: 1 - i * 0.2 }}
                  >
                    {msg.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
