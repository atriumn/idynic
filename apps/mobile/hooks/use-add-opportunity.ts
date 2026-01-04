import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";

interface AddOpportunityResult {
  jobId: string;
}

interface UseAddOpportunityResult {
  addOpportunity: (
    url: string,
    description?: string,
  ) => Promise<AddOpportunityResult>;
  isSubmitting: boolean;
  error: string | null;
  reset: () => void;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

export function useAddOpportunity(): UseAddOpportunityResult {
  const { session } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addOpportunity = async (
    url: string,
    description?: string,
  ): Promise<AddOpportunityResult> => {
    if (!session?.access_token) {
      throw new Error("Not authenticated");
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/process-opportunity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url, description }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add opportunity");
      }

      return { jobId: data.jobId };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setError(null);
    setIsSubmitting(false);
  };

  return {
    addOpportunity,
    isSubmitting,
    error,
    reset,
  };
}
