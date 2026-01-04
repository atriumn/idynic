"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useDocumentJob } from "@/lib/hooks/use-document-job";
import {
  STORY_PHASES,
  PHASE_LABELS,
  type DocumentJobPhase,
  type JobSummary,
} from "@idynic/shared/types";

interface StoryInputProps {
  onSubmitComplete?: () => void;
}

const MIN_LENGTH = 200;
const MAX_LENGTH = 10000;

export function StoryInput({ onSubmitComplete }: StoryInputProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
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
      // Invalidate identity queries so the UI updates without manual refresh
      queryClient.invalidateQueries({ queryKey: ["identity-reflection"] });
      queryClient.invalidateQueries({ queryKey: ["identity-graph"] });
      setText("");
      onSubmitComplete?.();
      router.refresh();
    }
    if (job?.status === "failed") {
      setError(job.error || "Processing failed");
      setJobId(null);
    }
  }, [job?.status, job?.error, onSubmitComplete, router, queryClient]);

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

      // Start listening to job updates
      setJobId(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [text, isValidLength]);

  // Calculate phase states
  const isProcessing = isSubmitting || job?.status === "processing";
  const isComplete = job?.status === "completed";
  const currentPhase = job?.phase as DocumentJobPhase | null;

  const completedPhases = new Set<DocumentJobPhase>();
  if (currentPhase) {
    const currentIndex = STORY_PHASES.indexOf(currentPhase);
    for (let i = 0; i < currentIndex; i++) {
      completedPhases.add(STORY_PHASES[i]);
    }
  }
  if (isComplete) {
    STORY_PHASES.forEach((p) => completedPhases.add(p));
  }

  const summary = job?.summary as JobSummary | null;

  return (
    <Card className="border-2 border-muted-foreground/25">
      <CardContent className="py-6 px-6">
        {isProcessing || isComplete ? (
          <div className="w-full space-y-4">
            {/* Phase progress */}
            <div className="space-y-2 text-left">
              {STORY_PHASES.map((phase) => {
                const isCompleted = completedPhases.has(phase);
                const isCurrent = currentPhase === phase;
                const isPending = !isCompleted && !isCurrent;

                return (
                  <div
                    key={phase}
                    className={cn(
                      "flex items-center gap-2 text-sm transition-opacity",
                      isPending && "opacity-40",
                    )}
                  >
                    {isCompleted ? (
                      <span className="text-green-500">✓</span>
                    ) : isCurrent ? (
                      <svg
                        className="h-4 w-4 animate-spin text-teal-500"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : (
                      <span className="text-muted-foreground">○</span>
                    )}
                    <span>
                      {PHASE_LABELS[phase]}
                      {isCurrent && job?.progress && ` (${job.progress})`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Highlights feed */}
            {displayMessages.length > 0 && (
              <div className="relative mt-4 h-32 overflow-hidden rounded-md bg-muted/50 p-3">
                <div className="space-y-1">
                  {displayMessages.map((message, index) => (
                    <div
                      key={message.id}
                      className={cn(
                        "text-sm transition-all duration-500",
                        index === 0 && "font-medium",
                        index > 0 && "opacity-60",
                        index > 1 && "opacity-40 blur-[0.5px]",
                        index > 2 && "opacity-20 blur-[1px]",
                      )}
                    >
                      {message.text}
                    </div>
                  ))}
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted/50 to-transparent" />
              </div>
            )}

            {isComplete && summary && (
              <div className="rounded-md bg-teal-500/10 border border-teal-600 p-3 text-sm">
                <p className="font-medium text-teal-400">
                  Processing complete!
                </p>
                <p className="text-teal-300 mt-1">
                  {summary.claimsCreated > 0 &&
                    `+${summary.claimsCreated} new claim${summary.claimsCreated > 1 ? "s" : ""}`}
                  {summary.claimsCreated > 0 &&
                    summary.claimsUpdated > 0 &&
                    ", "}
                  {summary.claimsUpdated > 0 &&
                    `${summary.claimsUpdated} updated`}
                  {summary.claimsCreated === 0 &&
                    summary.claimsUpdated === 0 &&
                    "No new claims (may match existing)"}
                </p>
              </div>
            )}

            {job?.warning && (
              <p className="text-sm text-yellow-500">{job.warning}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea
              placeholder="Share a story about a challenge you overcame, an achievement you're proud of, or an experience that shaped you professionally..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="resize-none"
              maxLength={MAX_LENGTH}
            />
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-xs",
                  charCount < MIN_LENGTH
                    ? "text-muted-foreground"
                    : "text-green-600",
                )}
              >
                {charCount}/{MIN_LENGTH} min characters
              </span>
              <Button
                onClick={handleSubmit}
                disabled={!isValidLength}
                size="sm"
              >
                Submit Story
              </Button>
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
