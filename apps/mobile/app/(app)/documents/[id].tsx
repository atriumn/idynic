import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  FileText,
  BookOpen,
  ArrowLeft,
  Trash2,
  Calendar,
  Sparkles,
  Award,
  Lightbulb,
} from "lucide-react-native";
import {
  useDocument,
  useDeleteDocument,
  DocumentEvidence,
} from "../../../hooks/use-documents";

function formatDate(dateString: string | null): string {
  if (!dateString) return "Unknown date";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDocumentDisplayName(
  filename: string | null,
  type: string
): string {
  if (filename) {
    // Remove date suffix pattern like "(12/25/2024)"
    return filename.replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{4}\)\s*$/, "");
  }
  return type === "resume" ? "Resume" : "Story";
}

const EVIDENCE_TYPE_STYLES: Record<
  string,
  { bgHex: string; textHex: string; borderHex: string }
> = {
  skill_listed: {
    bgHex: "#134e4a",
    textHex: "#5eead4",
    borderHex: "#0f766e",
  },
  accomplishment: {
    bgHex: "#78350f",
    textHex: "#fcd34d",
    borderHex: "#b45309",
  },
  trait_indicator: {
    bgHex: "#3b0764",
    textHex: "#d8b4fe",
    borderHex: "#7e22ce",
  },
};

const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  skill_listed: "Skill",
  accomplishment: "Accomplishment",
  trait_indicator: "Trait",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EVIDENCE_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  skill_listed: Sparkles,
  accomplishment: Award,
  trait_indicator: Lightbulb,
};

function EvidenceCard({ evidence }: { evidence: DocumentEvidence }) {
  const style = EVIDENCE_TYPE_STYLES[evidence.evidence_type] || {
    bgHex: "#1e293b",
    textHex: "#94a3b8",
    borderHex: "#334155",
  };
  const Icon = EVIDENCE_TYPE_ICONS[evidence.evidence_type] || Sparkles;
  const typeLabel =
    EVIDENCE_TYPE_LABELS[evidence.evidence_type] || evidence.evidence_type;

  return (
    <View
      className="p-3 rounded-lg mb-2"
      style={{ backgroundColor: style.bgHex, borderColor: style.borderHex, borderWidth: 1 }}
    >
      <View className="flex-row items-start gap-2">
        <View className="mt-0.5">
          <Icon color={style.textHex} size={16} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1.5">
            <View
              className="px-2 py-0.5 rounded-md"
              style={{ backgroundColor: `${style.textHex}20` }}
            >
              <Text className="text-xs font-medium" style={{ color: style.textHex }}>
                {typeLabel}
              </Text>
            </View>
            {evidence.evidence_date && (
              <View className="flex-row items-center gap-1">
                <Calendar color="#64748b" size={12} />
                <Text className="text-xs text-slate-400">
                  {formatDate(evidence.evidence_date)}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-sm text-slate-200">{evidence.text}</Text>
        </View>
      </View>
    </View>
  );
}

export default function DocumentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: document, isLoading, error } = useDocument(id || null);
  const deleteDocumentMutation = useDeleteDocument();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = () => {
    if (!document) return;

    Alert.alert(
      "Delete Document",
      `Are you sure you want to delete "${getDocumentDisplayName(document.filename, document.type)}"? This will also remove all evidence extracted from this document.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteDocumentMutation.mutateAsync(document.id);
              router.back();
            } catch (err) {
              Alert.alert("Error", "Failed to delete document. Please try again.");
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          className="flex-1 bg-slate-900 justify-center items-center"
          edges={["bottom"]}
        >
          <ActivityIndicator color="#14b8a6" size="large" />
        </SafeAreaView>
      </>
    );
  }

  if (error || !document) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView className="flex-1 bg-slate-900" edges={["top", "bottom"]}>
          <View className="flex-row items-center px-4 py-3 border-b border-slate-800">
            <Pressable onPress={() => router.back()} className="p-2 -ml-2">
              <ArrowLeft color="#94a3b8" size={24} />
            </Pressable>
          </View>
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-red-500">
              Failed to load document. It may have been deleted.
            </Text>
            <Pressable
              onPress={() => router.back()}
              className="mt-4 px-4 py-2 bg-slate-700 rounded-lg"
            >
              <Text className="text-white">Go Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const isStory = document.type === "story";
  const Icon = isStory ? BookOpen : FileText;
  const iconColor = isStory ? "#a855f7" : "#3b82f6";
  const bgColor = isStory ? "#3b0764" : "#1e3a5f";
  const displayName = getDocumentDisplayName(document.filename, document.type);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1 bg-slate-900" edges={["top", "bottom"]}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800">
          <View className="flex-row items-center flex-1">
            <Pressable onPress={() => router.back()} className="p-2 -ml-2 mr-2">
              <ArrowLeft color="#94a3b8" size={24} />
            </Pressable>
            <View
              className="w-10 h-10 rounded-lg items-center justify-center mr-3"
              style={{ backgroundColor: bgColor }}
            >
              <Icon color={iconColor} size={20} />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-lg" numberOfLines={1}>
                {displayName}
              </Text>
              <Text className="text-slate-400 text-sm">
                {formatDate(document.created_at)}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleDelete}
            disabled={isDeleting}
            className="p-2"
          >
            {isDeleting ? (
              <ActivityIndicator size={20} color="#ef4444" />
            ) : (
              <Trash2 color="#ef4444" size={20} />
            )}
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {/* Document Content Section */}
          <View className="mb-6">
            <View className="flex-row items-center gap-2 mb-3">
              <FileText color="#64748b" size={18} />
              <Text className="text-lg font-semibold text-white">Content</Text>
            </View>
            <View className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              {document.raw_text ? (
                <Text className="text-slate-300 text-sm leading-relaxed">
                  {document.raw_text}
                </Text>
              ) : (
                <Text className="text-slate-500 text-sm italic">
                  No text content available for this document.
                </Text>
              )}
            </View>
          </View>

          {/* Evidence Section */}
          <View>
            <View className="flex-row items-center gap-2 mb-3">
              <Sparkles color="#64748b" size={18} />
              <Text className="text-lg font-semibold text-white">
                What We Learned
              </Text>
              {document.evidence.length > 0 && (
                <View className="px-2 py-0.5 rounded-full bg-slate-700">
                  <Text className="text-xs text-slate-300">
                    {document.evidence.length}
                  </Text>
                </View>
              )}
            </View>
            {document.evidence.length > 0 ? (
              document.evidence.map((ev) => (
                <EvidenceCard key={ev.id} evidence={ev} />
              ))
            ) : (
              <View className="bg-slate-800/50 rounded-lg p-6 border border-slate-700 items-center">
                <Sparkles color="#475569" size={32} />
                <Text className="text-slate-500 text-sm mt-3 text-center">
                  No evidence has been extracted from this document yet.
                </Text>
                {document.status === "processing" && (
                  <Text className="text-slate-500 text-sm mt-2">
                    Processing is in progress...
                  </Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
