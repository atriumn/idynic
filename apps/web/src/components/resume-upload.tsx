"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDocumentJob } from "@/lib/hooks/use-document-job";
import { RESUME_PHASES, PHASE_LABELS, type DocumentJobPhase } from "@idynic/shared/types";

interface ResumeUploadProps {
  onUploadComplete?: () => void;
}

export function ResumeUpload({ onUploadComplete }: ResumeUploadProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const { job, displayMessages } = useDocumentJob(jobId);

  // Handle job completion or failure
  useEffect(() => {
    if (job?.status === "completed") {
      // Invalidate identity queries so the UI updates without manual refresh
      queryClient.invalidateQueries({ queryKey: ["identity-reflection"] });
      queryClient.invalidateQueries({ queryKey: ["identity-graph"] });
      onUploadComplete?.();
      router.refresh();
    }
    if (job?.status === "failed") {
      setError(job.error || "Processing failed");
      setJobId(null);
    }
  }, [job?.status, job?.error, onUploadComplete, router, queryClient]);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    setError(null);
    setIsUploading(true);
    setJobId(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/process-resume", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      // Start listening to job updates
      setJobId(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // Calculate phase states
  const isProcessing = isUploading || job?.status === "processing";
  const isComplete = job?.status === "completed";
  const currentPhase = job?.phase as DocumentJobPhase | null;

  const completedPhases = new Set<DocumentJobPhase>();
  if (currentPhase) {
    const currentIndex = RESUME_PHASES.indexOf(currentPhase);
    for (let i = 0; i < currentIndex; i++) {
      completedPhases.add(RESUME_PHASES[i]);
    }
  }
  if (isComplete) {
    RESUME_PHASES.forEach((p) => completedPhases.add(p));
  }

  return (
    <Card
      className={cn(
        "border-2 border-dashed transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <CardContent className="flex flex-col items-center justify-center py-10 px-6 text-center">
        {isProcessing || isComplete ? (
          <div className="w-full max-w-sm space-y-4">
            {/* Phase progress */}
            <div className="space-y-2 text-left">
              {RESUME_PHASES.map((phase) => {
                const isCompleted = completedPhases.has(phase);
                const isCurrent = currentPhase === phase;
                const isPending = !isCompleted && !isCurrent;

                return (
                  <div
                    key={phase}
                    className={cn(
                      "flex items-center gap-2 text-sm transition-opacity",
                      isPending && "opacity-40"
                    )}
                  >
                    {isCompleted ? (
                      <span className="text-green-600">✓</span>
                    ) : isCurrent ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
                      {isCurrent && job?.progress && ` (batch ${job.progress})`}
                      {isCurrent && !job?.progress && phase === "extracting" && (
                        <span className="ml-2 animate-pulse text-muted-foreground">
                          analyzing...
                        </span>
                      )}
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
                        index > 2 && "opacity-20 blur-[1px]"
                      )}
                    >
                      {message.text}
                    </div>
                  ))}
                </div>
                {/* Fade gradient at bottom */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted/50 to-transparent" />
              </div>
            )}

            {isComplete && <p className="text-sm font-medium text-green-600">Processing complete!</p>}
            {job?.warning && <p className="text-sm text-yellow-600">{job.warning}</p>}
          </div>
        ) : (
          <>
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-muted-foreground"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Drag and drop your resume here</p>
              <p className="text-xs text-muted-foreground">PDF files only, max 10MB</p>
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  Browse files
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,application/pdf"
                    onChange={handleInputChange}
                  />
                </label>
              </Button>
            </div>
          </>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
