import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAddOpportunity } from "../../hooks/use-add-opportunity";
import { useDocumentJob } from "../../hooks/use-document-job";
import {
  OPPORTUNITY_PHASES,
  PHASE_LABELS,
  type DocumentJobPhase,
} from "@idynic/shared/types";
import { Check, X, Loader2, Link as LinkIcon } from "lucide-react-native";

export default function AddOpportunityScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ url?: string; jobId?: string; error?: string }>();

  const [url, setUrl] = useState(params.url || "");
  const [description, setDescription] = useState("");
  // Use jobId from params if passed (from share intent), otherwise null
  const [jobId, setJobId] = useState<string | null>(params.jobId || null);

  const { addOpportunity, isSubmitting, error: submitError, reset } = useAddOpportunity();
  const { job, displayMessages } = useDocumentJob(jobId);

  // Show error from share intent if present
  const [shareError, setShareError] = useState<string | null>(params.error || null);

  // Handle job completion
  useEffect(() => {
    if (job?.status === "completed") {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      // Navigate to the opportunity after a brief delay
      setTimeout(() => {
        const opportunityId = (job.summary as { opportunityId?: string })?.opportunityId;
        if (opportunityId) {
          router.replace(`/opportunities/${opportunityId}`);
        } else {
          router.replace("/opportunities");
        }
      }, 1000);
    }
  }, [job?.status, job?.summary, queryClient, router]);

  // Clear share error when user starts typing
  useEffect(() => {
    if (shareError && (url !== params.url || description)) {
      setShareError(null);
    }
  }, [url, description, shareError, params.url]);

  const handleSubmit = async () => {
    if (!url && !description) return;

    try {
      const result = await addOpportunity(url, description || undefined);
      setJobId(result.jobId);
    } catch {
      // Error is handled by the hook
    }
  };

  const handleCancel = () => {
    if (jobId && !params.jobId) {
      // Can't cancel processing job we started, just go back
      router.back();
    } else {
      reset();
      setShareError(null);
      router.back();
    }
  };

  const isProcessing = !!jobId && job?.status === "processing";
  const isCompleted = job?.status === "completed";
  const isFailed = job?.status === "failed";
  const currentPhase = job?.phase as DocumentJobPhase | null;
  const phaseIndex = currentPhase ? OPPORTUNITY_PHASES.indexOf(currentPhase) : -1;

  // Show processing view
  if (jobId) {
    return (
      <View className="flex-1 bg-slate-900 p-6 justify-center">
        <View className="items-center mb-8">
          {isCompleted ? (
            <View className="w-16 h-16 rounded-full bg-green-500/20 items-center justify-center mb-4">
              <Check size={32} color="#22c55e" />
            </View>
          ) : isFailed ? (
            <View className="w-16 h-16 rounded-full bg-red-500/20 items-center justify-center mb-4">
              <X size={32} color="#ef4444" />
            </View>
          ) : (
            <View className="w-16 h-16 rounded-full bg-teal-500/20 items-center justify-center mb-4">
              <ActivityIndicator size="large" color="#14b8a6" />
            </View>
          )}

          <Text className="text-white text-xl font-semibold mb-2">
            {isCompleted
              ? "Opportunity Added!"
              : isFailed
              ? "Processing Failed"
              : "Processing Opportunity"}
          </Text>
          <Text className="text-slate-400 text-center">
            {isCompleted
              ? "Taking you to your opportunity..."
              : isFailed
              ? job?.error || "Something went wrong"
              : currentPhase
              ? PHASE_LABELS[currentPhase]
              : "Starting..."}
          </Text>
        </View>

        {/* Progress bar */}
        {isProcessing && (
          <View className="mb-6">
            <View className="flex-row justify-between mb-2 px-2">
              {OPPORTUNITY_PHASES.map((phase, i) => (
                <Text
                  key={phase}
                  className={`text-xs ${
                    i <= phaseIndex ? "text-teal-400" : "text-slate-600"
                  }`}
                >
                  {i + 1}
                </Text>
              ))}
            </View>
            <View className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <View
                className="h-full bg-teal-500"
                style={{
                  width: `${((phaseIndex + 1) / OPPORTUNITY_PHASES.length) * 100}%`,
                }}
              />
            </View>
          </View>
        )}

        {/* Ticker messages */}
        {displayMessages.length > 0 && (
          <View className="space-y-1">
            {displayMessages.slice(0, 4).map((msg, i) => (
              <Text
                key={msg.id}
                className="text-slate-500 text-sm text-center"
                style={{ opacity: 1 - i * 0.2 }}
              >
                {msg.text}
              </Text>
            ))}
          </View>
        )}

        {/* Retry button for failed jobs */}
        {isFailed && (
          <TouchableOpacity
            onPress={() => {
              setJobId(null);
              setShareError(null);
              reset();
            }}
            className="mt-8 bg-slate-800 py-3 px-6 rounded-lg self-center"
          >
            <Text className="text-white font-medium">Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Show form view
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-900"
    >
      <ScrollView className="flex-1 p-6">
        <Text className="text-white text-2xl font-bold mb-2">Add Opportunity</Text>
        <Text className="text-slate-400 mb-6">
          Share a job URL or paste the description
        </Text>

        {/* URL Input */}
        <View className="mb-4">
          <Text className="text-slate-300 text-sm font-medium mb-2">Job URL</Text>
          <View className="flex-row items-center bg-slate-800 rounded-lg px-4 py-3">
            <LinkIcon size={18} color="#64748b" />
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="https://linkedin.com/jobs/view/..."
              placeholderTextColor="#64748b"
              className="flex-1 text-white ml-3"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
        </View>

        {/* Description Input */}
        <View className="mb-6">
          <Text className="text-slate-300 text-sm font-medium mb-2">
            Job Description {!url && "(required)"}
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={
              url
                ? "Optional - will be fetched from the URL"
                : "Paste the full job description here..."
            }
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            className="bg-slate-800 rounded-lg px-4 py-3 text-white min-h-[200px]"
          />
        </View>

        {/* Error message */}
        {(submitError || shareError) && (
          <View className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
            <Text className="text-red-400 text-sm">{submitError || shareError}</Text>
          </View>
        )}

        {/* Buttons */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={handleCancel}
            className="flex-1 bg-slate-800 py-3 rounded-lg items-center"
          >
            <Text className="text-slate-300 font-medium">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting || (!url && !description)}
            className={`flex-1 py-3 rounded-lg items-center flex-row justify-center ${
              isSubmitting || (!url && !description)
                ? "bg-teal-500/50"
                : "bg-teal-500"
            }`}
          >
            {isSubmitting && (
              <ActivityIndicator size="small" color="white" className="mr-2" />
            )}
            <Text className="text-white font-medium">
              {isSubmitting ? "Starting..." : "Add Opportunity"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
