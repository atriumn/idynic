"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Upload, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocumentJob } from "@/lib/hooks/use-document-job";
import { useInvalidateGraph } from "@/lib/hooks/use-identity-graph";
import { RESUME_PHASES, PHASE_LABELS, type DocumentJobPhase } from "@idynic/shared/types";

export function UploadResumeModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidateGraph = useInvalidateGraph();
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const { job, displayMessages } = useDocumentJob(jobId);

  // Handle job completion or failure
  useEffect(() => {
    if (job?.status === "completed") {
      queryClient.invalidateQueries({ queryKey: ["identity-reflection"] });
      queryClient.invalidateQueries({ queryKey: ["identity-graph"] });
      invalidateGraph();
      setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 1000);
    }
    if (job?.status === "failed") {
      setError(job.error || "Processing failed");
      setJobId(null);
    }
  }, [job?.status, job?.error, router, queryClient, invalidateGraph]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setError(null);
      setJobId(null);
      setIsDragging(false);
    }
  }, []);

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
        throw new Error(data.message || data.error || "Upload failed");
      }

      setJobId(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
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

  const isProcessing = !!jobId && job?.status === "processing";
  const isCompleted = job?.status === "completed";
  const currentPhase = job?.phase as DocumentJobPhase | null;
  const phaseIndex = currentPhase ? RESUME_PHASES.indexOf(currentPhase) : -1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Upload Resume
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] border-2 shadow-lg">
        {!jobId ? (
          <>
            <DialogHeader>
              <DialogTitle>Upload Resume</DialogTitle>
              <DialogDescription>
                Upload your resume to extract skills, experience, and achievements.
              </DialogDescription>
            </DialogHeader>
            <div
              className={cn(
                "mt-4 border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">Drag and drop your resume here</p>
              <p className="text-xs text-muted-foreground mb-4">PDF files only, max 10MB</p>
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
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
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
                    Resume Processed
                  </>
                ) : job?.status === "failed" ? (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    Processing Failed
                  </>
                ) : (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    Processing Resume
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {isCompleted
                  ? "Your resume has been processed successfully."
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
                  {RESUME_PHASES.map((phase, i) => (
                    <span
                      key={phase}
                      className={i <= phaseIndex ? "text-blue-500" : ""}
                    >
                      {i + 1}
                    </span>
                  ))}
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{
                      width: `${((phaseIndex + 1) / RESUME_PHASES.length) * 100}%`,
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
