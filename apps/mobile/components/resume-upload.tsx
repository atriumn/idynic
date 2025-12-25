import { useState, useCallback, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { FileText, Upload } from "lucide-react-native";
import { useAuth } from "../lib/auth-context";
import { useDocumentJob } from "../hooks/use-document-job";
import {
  RESUME_PHASES,
  PHASE_LABELS,
  type DocumentJobPhase,
  type JobSummary,
} from "@idynic/shared/types";

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

interface ResumeUploadProps {
  onComplete?: () => void;
}

export function ResumeUpload({ onComplete }: ResumeUploadProps) {
  const { session } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const { job, displayMessages } = useDocumentJob(jobId);

  // Handle job completion or failure
  useEffect(() => {
    if (job?.status === "completed") {
      onComplete?.();
    }
    if (job?.status === "failed") {
      setError(job.error || "Processing failed");
      setJobId(null);
    }
  }, [job?.status, job?.error, onComplete]);

  const handlePickDocument = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file) return;

      // Check file size (10MB max)
      if (file.size && file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }

      setError(null);
      setIsUploading(true);
      setJobId(null);
      setFileName(file.name);

      // Create form data
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        type: "application/pdf",
        name: file.name,
      } as unknown as Blob);

      const response = await fetch(`${API_URL}/api/process-resume`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      // Handle non-JSON responses (e.g., HTML error pages)
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

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
  }, [session?.access_token]);

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

  const summary = job?.summary as JobSummary | null;

  if (isProcessing || isComplete) {
    return (
      <View className="flex-1 bg-slate-900 p-4">
        {/* File name */}
        {fileName && (
          <View className="flex-row items-center gap-2 mb-4">
            <FileText color="#64748b" size={18} />
            <Text className="text-slate-400 text-sm">{fileName}</Text>
          </View>
        )}

        {/* Phase progress */}
        <View className="space-y-3 mb-4">
          {RESUME_PHASES.map((phase) => {
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
                  {isCurrent && job?.progress && ` (batch ${job.progress})`}
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
              Found {summary.evidenceCount} evidence items
              {summary.workHistoryCount > 0 && `, ${summary.workHistoryCount} work history entries`}
              {summary.claimsCreated > 0 && `, +${summary.claimsCreated} new claims`}
              {summary.claimsUpdated > 0 && `, ${summary.claimsUpdated} updated`}
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
    <View className="flex-1 bg-slate-900 p-4 justify-center items-center">
      {/* Upload area */}
      <Pressable
        onPress={handlePickDocument}
        className="bg-slate-800 border-2 border-dashed border-slate-600 rounded-2xl p-8 items-center w-full"
      >
        <View className="bg-slate-700 rounded-full p-4 mb-4">
          <Upload color="#94a3b8" size={32} />
        </View>
        <Text className="text-white text-lg font-semibold mb-2">
          Upload your resume
        </Text>
        <Text className="text-slate-400 text-sm text-center">
          Tap to select a PDF file{"\n"}Max size: 10MB
        </Text>
      </Pressable>

      {/* Error */}
      {error && (
        <Text className="text-red-500 text-sm mt-4 text-center">{error}</Text>
      )}
    </View>
  );
}
