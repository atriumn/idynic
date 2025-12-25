import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth } from "../lib/auth-context";
import { useDocumentJob } from "../hooks/use-document-job";
import {
  STORY_PHASES,
  PHASE_LABELS,
  type DocumentJobPhase,
  type JobSummary,
} from "@idynic/shared/types";

const API_URL = process.env.EXPO_PUBLIC_API_URL!;
const MIN_LENGTH = 200;
const MAX_LENGTH = 10000;

interface StoryInputProps {
  onComplete?: () => void;
}

export function StoryInput({ onComplete }: StoryInputProps) {
  const { session } = useAuth();
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
      setText("");
      onComplete?.();
    }
    if (job?.status === "failed") {
      setError(job.error || "Processing failed");
      setJobId(null);
    }
  }, [job?.status, job?.error, onComplete]);

  const handleSubmit = useCallback(async () => {
    if (!isValidLength || !session?.access_token) return;

    setError(null);
    setIsSubmitting(true);
    setJobId(null);

    try {
      const response = await fetch(`${API_URL}/api/process-story`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
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
  }, [text, isValidLength, session?.access_token]);

  // Calculate phase states - include jobId check to handle loading/pending states
  const isProcessing = isSubmitting || (jobId !== null && job?.status !== "completed" && job?.status !== "failed");
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

  if (isProcessing || isComplete) {
    return (
      <View className="flex-1 bg-slate-900 p-4">
        {/* Phase progress */}
        <View className="space-y-3 mb-4">
          {STORY_PHASES.map((phase) => {
            const isCompleted = completedPhases.has(phase);
            const isCurrent = currentPhase === phase;
            const isPending = !isCompleted && !isCurrent;

            return (
              <View
                key={phase}
                className="flex-row items-center gap-3"
                style={{ opacity: isPending ? 0.4 : 1 }}
              >
                {isCompleted ? (
                  <Text className="text-green-500 text-base">✓</Text>
                ) : isCurrent ? (
                  <ActivityIndicator size="small" color="#14b8a6" />
                ) : (
                  <Text className="text-slate-500 text-base">○</Text>
                )}
                <Text className="text-white text-base">
                  {PHASE_LABELS[phase]}
                  {isCurrent && job?.progress && ` (${job.progress})`}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Highlights feed */}
        {displayMessages.length > 0 && (
          <View className="bg-slate-800 rounded-xl p-4 mb-4">
            {displayMessages.slice(0, 5).map((message, index) => (
              <Text
                key={message.id}
                className="text-sm mb-1"
                style={{
                  color: index === 0 ? "#e2e8f0" : "#94a3b8",
                  opacity: index > 1 ? 0.6 : 1,
                  fontWeight: index === 0 ? "600" : "400",
                }}
              >
                {message.text}
              </Text>
            ))}
          </View>
        )}

        {/* Completion summary */}
        {isComplete && summary && (
          <View className="bg-teal-900/30 border border-teal-700 rounded-xl p-4">
            <Text className="text-teal-400 font-semibold mb-1">Processing complete!</Text>
            <Text className="text-teal-300 text-sm">
              {summary.claimsCreated > 0 &&
                `+${summary.claimsCreated} new claim${summary.claimsCreated > 1 ? "s" : ""}`}
              {summary.claimsCreated > 0 && summary.claimsUpdated > 0 && ", "}
              {summary.claimsUpdated > 0 && `${summary.claimsUpdated} updated`}
              {summary.claimsCreated === 0 &&
                summary.claimsUpdated === 0 &&
                "No new claims (may match existing)"}
            </Text>
          </View>
        )}

        {/* Warning */}
        {job?.warning && (
          <Text className="text-yellow-500 text-sm mt-4">{job.warning}</Text>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-900"
    >
      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        {/* Input */}
        <View className="bg-slate-800 rounded-xl p-4 mb-4">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Share a story about a challenge you overcame, an achievement you're proud of, or an experience that shaped you professionally..."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={8}
            maxLength={MAX_LENGTH}
            textAlignVertical="top"
            className="text-white text-base min-h-[200px]"
            style={{ lineHeight: 24 }}
          />
        </View>

        {/* Character count and submit */}
        <View className="flex-row items-center justify-between">
          <Text
            className="text-sm"
            style={{ color: charCount < MIN_LENGTH ? "#64748b" : "#22c55e" }}
          >
            {charCount}/{MIN_LENGTH} min characters
          </Text>

          <Pressable
            onPress={handleSubmit}
            disabled={!isValidLength}
            className={`px-6 py-3 rounded-xl ${
              isValidLength ? "bg-teal-600" : "bg-slate-700"
            }`}
          >
            <Text
              className={`font-semibold ${
                isValidLength ? "text-white" : "text-slate-500"
              }`}
            >
              Submit Story
            </Text>
          </Pressable>
        </View>

        {/* Error */}
        {error && <Text className="text-red-500 text-sm mt-4">{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
