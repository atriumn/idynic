import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  DocumentJob,
  DocumentJobPhase,
  JobHighlight,
} from "@idynic/shared/types";
import { TICKER_MESSAGES, formatHighlight } from "@idynic/shared/types";

interface DisplayMessage {
  id: number;
  text: string;
}

interface UseDocumentJobResult {
  job: DocumentJob | null;
  isLoading: boolean;
  error: Error | null;
  /** Combined highlights: real highlights from job + client-side ticker messages */
  displayMessages: DisplayMessage[];
}

/**
 * Hook to subscribe to document job updates via Supabase Realtime.
 * Provides real-time progress updates and client-side ticker messages.
 */
export function useDocumentJob(jobId: string | null): UseDocumentJobResult {
  const [job, setJob] = useState<DocumentJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tickerMessages, setTickerMessages] = useState<DisplayMessage[]>([]);

  const tickerIdRef = useRef(0);
  const tickerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Generate ticker messages based on current phase
  const startTicker = useCallback((phase: DocumentJobPhase | null) => {
    if (tickerIntervalRef.current) {
      clearInterval(tickerIntervalRef.current);
    }
    if (!phase) return;

    const messages = TICKER_MESSAGES[phase] || [];
    let index = 0;

    // Send first message immediately
    if (messages.length > 0) {
      const id = ++tickerIdRef.current;
      setTickerMessages((prev) =>
        [{ id, text: messages[0] }, ...prev].slice(0, 5),
      );
      index = 1;
    }

    tickerIntervalRef.current = setInterval(() => {
      if (messages.length > 0) {
        const id = ++tickerIdRef.current;
        const text = messages[index % messages.length];
        setTickerMessages((prev) => [{ id, text }, ...prev].slice(0, 5));
        index++;
      }
    }, 4000);
  }, []);

  const stopTicker = useCallback(() => {
    if (tickerIntervalRef.current) {
      clearInterval(tickerIntervalRef.current);
      tickerIntervalRef.current = null;
    }
  }, []);

  // Fetch initial job state
  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setTickerMessages([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    supabase
      .from("document_jobs")
      .select("*")
      .eq("id", jobId)
      .single()
      .then(({ data, error: err }) => {
        setIsLoading(false);
        if (err) {
          setError(new Error(err.message));
        } else if (data) {
          const jobData = data as unknown as DocumentJob;
          setJob(jobData);
          if (jobData.status === "processing" && jobData.phase) {
            startTicker(jobData.phase);
          }
        }
      });
  }, [jobId, startTicker]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "document_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const newJob = payload.new as unknown as DocumentJob;
          setJob((prevJob) => {
            // Restart ticker if phase changed
            if (
              newJob.phase !== prevJob?.phase &&
              newJob.status === "processing"
            ) {
              startTicker(newJob.phase);
            }
            return newJob;
          });

          // Handle completion
          if (newJob.status === "completed" || newJob.status === "failed") {
            stopTicker();
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      stopTicker();
      channel.unsubscribe();
    };
  }, [jobId, startTicker, stopTicker]);

  // Combine real highlights with ticker messages
  const displayMessages: DisplayMessage[] = [
    // Real highlights from job (newest first since they're added at the end)
    ...((job?.highlights as JobHighlight[]) || [])
      .slice()
      .reverse()
      .map((h, i) => ({
        id: -(i + 1), // Negative IDs for real highlights
        text: formatHighlight(h),
      })),
    // Ticker messages
    ...tickerMessages,
  ].slice(0, 8);

  return {
    job,
    isLoading,
    error,
    displayMessages,
  };
}
