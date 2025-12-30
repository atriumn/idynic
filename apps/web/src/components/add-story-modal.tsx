"use client";

import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocumentJob } from "@/lib/hooks/use-document-job";
import { STORY_PHASES, PHASE_LABELS, type DocumentJobPhase, type JobSummary } from "@idynic/shared/types";

const MIN_LENGTH = 200;
const MAX_LENGTH = 10000;

export function AddStoryModal() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const { job, displayMessages } = useDocumentJob(jobId);

  const charCount = text.length;
  const isValidLength = charCount >= MIN_LENGTH && charCount <= MAX_LENGTH;

  // Handle job completion or failure
  useEffect(() => {
    if (job?.status === "completed") {
      // Refetch queries and wait for completion before closing
      const refetchAndClose = async () => {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ["identity-reflection"] }),
          queryClient.refetchQueries({ queryKey: ["identity-graph"] }),
        ]);
        // Small delay to show success state before closing
        setTimeout(() => {
          setOpen(false);
          setText("");
        }, 800);
      };
      refetchAndClose();
    }
    if (job?.status === "failed") {
      setError(job.error || "Processing failed");
      setJobId(null);
    }
  }, [job?.status, job?.error, queryClient]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setText("");
      setError(null);
      setJobId(null);
      setIsSubmitting(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isValidLength) return;

    setError(null);
    setIsSubmitting(true);
    setJobId(null);

    try {
      const response = await fetch("/api/process-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Submission failed");
      }

      setJobId(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [text, isValidLength]);

  const isProcessing = !!jobId && job?.status === "processing";
  const isCompleted = job?.status === "completed";
  const currentPhase = job?.phase as DocumentJobPhase | null;
  const phaseIndex = currentPhase ? STORY_PHASES.indexOf(currentPhase) : -1;
  const summary = job?.summary as JobSummary | null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          Add Story
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] border-2 shadow-lg">
        {!jobId ? (
          <>
            <DialogHeader>
              <DialogTitle>Share a Story</DialogTitle>
              <DialogDescription>
                Share an experience that shaped you professionally. We&apos;ll extract insights to strengthen your profile.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <Textarea
                placeholder="Share a story about a challenge you overcame, an achievement you're proud of, or an experience that shaped you professionally..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                className="resize-none"
                maxLength={MAX_LENGTH}
              />
              <div className="flex items-center justify-between text-xs">
                <span
                  className={cn(
                    charCount < MIN_LENGTH ? "text-muted-foreground" : "text-green-600"
                  )}
                >
                  {charCount}/{MIN_LENGTH} min characters
                </span>
                {charCount > MAX_LENGTH * 0.9 && (
                  <span className="text-muted-foreground">
                    {MAX_LENGTH - charCount} remaining
                  </span>
                )}
              </div>
            </div>
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!isValidLength || isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Submitting..." : "Submit Story"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="py-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isCompleted ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Story Processed
                  </>
                ) : job?.status === "failed" ? (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    Processing Failed
                  </>
                ) : (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                    Processing Story
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {isCompleted
                  ? summary
                    ? `${summary.claimsCreated > 0 ? `+${summary.claimsCreated} new claim${summary.claimsCreated > 1 ? "s" : ""}` : ""}${summary.claimsCreated > 0 && summary.claimsUpdated > 0 ? ", " : ""}${summary.claimsUpdated > 0 ? `${summary.claimsUpdated} updated` : ""}${summary.claimsCreated === 0 && summary.claimsUpdated === 0 ? "Story processed (may match existing claims)" : ""}`
                    : "Your story has been processed successfully."
                  : currentPhase
                    ? PHASE_LABELS[currentPhase]
                    : job?.status === "pending"
                      ? "Queued for processing..."
                      : "Starting..."
                }
              </DialogDescription>
            </DialogHeader>

            {/* Progress bar */}
            {isProcessing && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  {STORY_PHASES.map((phase, i) => (
                    <span
                      key={phase}
                      className={i <= phaseIndex ? "text-violet-500" : ""}
                    >
                      {i + 1}
                    </span>
                  ))}
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 transition-all duration-500"
                    style={{
                      width: `${((phaseIndex + 1) / STORY_PHASES.length) * 100}%`,
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

            {job?.warning && (
              <p className="mt-4 text-sm text-yellow-500">{job.warning}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
