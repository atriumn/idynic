"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface StoryInputProps {
  onSubmitComplete?: () => void;
}

type Phase = "validating" | "extracting" | "embeddings" | "synthesis" | null;

const PHASE_LABELS: Record<NonNullable<Phase>, string> = {
  validating: "Checking story",
  extracting: "Extracting evidence",
  embeddings: "Generating embeddings",
  synthesis: "Synthesizing claims",
};

interface Highlight {
  id: number;
  text: string;
}

const MIN_LENGTH = 200;
const MAX_LENGTH = 10000;

export function StoryInput({ onSubmitComplete }: StoryInputProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<Phase>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [completedPhases, setCompletedPhases] = useState<Set<Phase>>(new Set());
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [summary, setSummary] = useState<{ created: number; updated: number } | null>(null);
  const highlightIdRef = useRef(0);

  const charCount = text.length;
  const isValidLength = charCount >= MIN_LENGTH && charCount <= MAX_LENGTH;

  const handleSubmit = useCallback(async () => {
    if (!isValidLength) return;

    setError(null);
    setWarning(null);
    setIsProcessing(true);
    setCurrentPhase(null);
    setProgress(null);
    setCompletedPhases(new Set());
    setHighlights([]);
    setIsComplete(false);
    setSummary(null);

    try {
      const response = await fetch("/api/process-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Submission failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastPhase: Phase = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.phase) {
              if (lastPhase && lastPhase !== data.phase) {
                setCompletedPhases(prev => new Set([...Array.from(prev), lastPhase]));
              }
              lastPhase = data.phase;
              setCurrentPhase(data.phase);
              setProgress(data.progress || null);
            }

            if (data.highlight) {
              const id = ++highlightIdRef.current;
              setHighlights(prev => [{ id, text: data.highlight }, ...prev].slice(0, 5));
            }

            if (data.warning) {
              setWarning(data.warning);
            }

            if (data.error) {
              throw new Error(data.error);
            }

            if (data.done) {
              if (lastPhase) {
                setCompletedPhases(prev => new Set([...Array.from(prev), lastPhase]));
              }
              setIsComplete(true);
              setSummary({
                created: data.summary?.claimsCreated || 0,
                updated: data.summary?.claimsUpdated || 0,
              });
              setText("");
              onSubmitComplete?.();
              router.refresh();
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== "Submission failed") {
              console.warn("Failed to parse SSE event:", line);
            } else {
              throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsProcessing(false);
    }
  }, [text, isValidLength, router, onSubmitComplete]);

  const allPhases: NonNullable<Phase>[] = ["validating", "extracting", "embeddings", "synthesis"];

  return (
    <Card className="border-2 border-muted-foreground/25">
      <CardContent className="py-6 px-6">
        {isProcessing || isComplete ? (
          <div className="w-full space-y-4">
            {/* Phase progress */}
            <div className="space-y-2 text-left">
              {allPhases.map((phase) => {
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
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <span className="text-muted-foreground">○</span>
                    )}
                    <span>
                      {PHASE_LABELS[phase]}
                      {isCurrent && progress && ` (${progress})`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Highlights feed */}
            {highlights.length > 0 && (
              <div className="relative mt-4 h-32 overflow-hidden rounded-md bg-muted/50 p-3">
                <div className="space-y-1">
                  {highlights.map((highlight, index) => (
                    <div
                      key={highlight.id}
                      className={cn(
                        "text-sm transition-all duration-500",
                        index === 0 && "font-medium",
                        index > 0 && "opacity-60",
                        index > 1 && "opacity-40 blur-[0.5px]",
                        index > 2 && "opacity-20 blur-[1px]"
                      )}
                    >
                      {highlight.text}
                    </div>
                  ))}
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted/50 to-transparent" />
              </div>
            )}

            {isComplete && summary && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm">
                <p className="font-medium text-green-800">Processing complete!</p>
                <p className="text-green-700 mt-1">
                  {summary.created > 0 && `+${summary.created} new claim${summary.created > 1 ? 's' : ''}`}
                  {summary.created > 0 && summary.updated > 0 && ', '}
                  {summary.updated > 0 && `${summary.updated} updated`}
                  {summary.created === 0 && summary.updated === 0 && 'No new claims (may match existing)'}
                </p>
              </div>
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
              <span className={cn(
                "text-xs",
                charCount < MIN_LENGTH ? "text-muted-foreground" : "text-green-600"
              )}>
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
        {warning && <p className="mt-4 text-sm text-yellow-600">{warning}</p>}
      </CardContent>
    </Card>
  );
}
