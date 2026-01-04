import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  FileText,
  BookOpen,
  ChevronRight,
  Trash2,
  Upload,
  MessageSquarePlus,
} from "lucide-react-native";
import {
  useDocuments,
  useDeleteDocument,
  DocumentListItem,
} from "../../hooks/use-documents";

function formatDate(dateString: string | null): string {
  if (!dateString) return "Unknown date";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDocumentDisplayName(doc: DocumentListItem): string {
  if (doc.filename) {
    // Remove date suffix pattern like "(12/25/2024)"
    return doc.filename.replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{4}\)\s*$/, "");
  }
  return doc.type === "resume" ? "Resume" : "Story";
}

function DocumentRow({
  document,
  onPress,
  onDelete,
}: {
  document: DocumentListItem;
  onPress: () => void;
  onDelete: () => void;
}) {
  const isStory = document.type === "story";
  const Icon = isStory ? BookOpen : FileText;
  const iconColor = isStory ? "#a855f7" : "#3b82f6";
  const bgColor = isStory ? "#3b0764" : "#1e3a5f";
  const isProcessing =
    document.status === "processing" || document.status === "pending";
  const isFailed = document.status === "failed";

  const handleLongPress = () => {
    Alert.alert(
      "Delete Document",
      `Are you sure you want to delete "${getDocumentDisplayName(document)}"? This will also remove all evidence extracted from this document.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ],
    );
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      className="flex-row items-center px-4 py-3 border-b border-slate-700"
      android_ripple={{ color: "rgba(255,255,255,0.1)" }}
    >
      {/* Icon */}
      <View
        className="w-10 h-10 rounded-lg items-center justify-center mr-3"
        style={{ backgroundColor: bgColor }}
      >
        <Icon color={iconColor} size={20} />
      </View>

      {/* Document Info */}
      <View className="flex-1">
        <Text className="text-white font-medium" numberOfLines={1}>
          {getDocumentDisplayName(document)}
        </Text>
        <View className="flex-row items-center gap-2 mt-0.5">
          <Text className="text-slate-400 text-sm">
            {formatDate(document.created_at)}
          </Text>
          {isProcessing && (
            <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700">
              <ActivityIndicator size={10} color="#94a3b8" />
              <Text className="text-xs text-slate-400">Processing</Text>
            </View>
          )}
          {isFailed && (
            <View className="px-2 py-0.5 rounded-full bg-red-900/50">
              <Text className="text-xs text-red-400">Failed</Text>
            </View>
          )}
        </View>
      </View>

      {/* Type Badge */}
      <View
        className="px-2 py-1 rounded-md mr-3"
        style={{
          backgroundColor: isStory
            ? "rgba(168, 85, 247, 0.2)"
            : "rgba(59, 130, 246, 0.2)",
        }}
      >
        <Text
          className="text-xs font-medium"
          style={{ color: isStory ? "#c084fc" : "#60a5fa" }}
        >
          {isStory ? "Story" : "Resume"}
        </Text>
      </View>

      {/* Evidence Count */}
      {document.evidence_count > 0 && (
        <Text className="text-slate-500 text-xs mr-2">
          {document.evidence_count} evidence
        </Text>
      )}

      {/* Chevron */}
      <ChevronRight color="#64748b" size={20} />
    </Pressable>
  );
}

export default function DocumentsScreen() {
  const router = useRouter();
  const {
    data: documents,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useDocuments();
  const deleteDocumentMutation = useDeleteDocument();

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleDocumentPress = (documentId: string) => {
    router.push(`/documents/${documentId}`);
  };

  const handleDeleteDocument = async (document: DocumentListItem) => {
    try {
      await deleteDocumentMutation.mutateAsync(document.id);
    } catch (err) {
      Alert.alert("Error", "Failed to delete document. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView
        className="flex-1 bg-slate-900 justify-center items-center"
        edges={["bottom"]}
      >
        <ActivityIndicator color="#14b8a6" size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 p-4" edges={["bottom"]}>
        <Text className="text-red-500">Failed to load documents</Text>
        <Text className="text-slate-400 mt-2 text-sm">{error.message}</Text>
      </SafeAreaView>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <ScrollView
        className="flex-1 bg-slate-900"
        contentContainerStyle={{
          padding: 24,
          flex: 1,
          justifyContent: "center",
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor="#ffffff"
          />
        }
      >
        <SafeAreaView edges={["bottom"]}>
          <View className="items-center">
            <View className="w-16 h-16 rounded-2xl bg-slate-800 items-center justify-center mb-4">
              <FileText color="#64748b" size={32} />
            </View>
            <Text className="text-xl font-bold text-white mb-2">
              No documents yet
            </Text>
            <Text className="text-slate-400 text-center mb-6 px-8">
              Upload a resume or add a story to get started. We&apos;ll extract
              your skills, experience, and achievements.
            </Text>

            <View className="w-full gap-3">
              <Pressable
                onPress={() => router.push("/upload-resume")}
                className="flex-row items-center justify-center gap-2 bg-slate-700 border border-slate-600 py-4 px-6 rounded-xl"
              >
                <Upload color="#14b8a6" size={20} />
                <Text className="text-white font-semibold text-base">
                  Upload Resume
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/add-story")}
                className="flex-row items-center justify-center gap-2 bg-slate-700 border border-slate-600 py-4 px-6 rounded-xl"
              >
                <MessageSquarePlus color="#14b8a6" size={20} />
                <Text className="text-white font-semibold text-base">
                  Add Story
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: "#0f172a" }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor="#ffffff"
        />
      }
    >
      <View className="border-b border-slate-800">
        <View className="px-4 py-2 bg-slate-800/50">
          <Text className="text-slate-400 text-sm">
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </Text>
        </View>
        {documents.map((doc) => (
          <DocumentRow
            key={doc.id}
            document={doc}
            onPress={() => handleDocumentPress(doc.id)}
            onDelete={() => handleDeleteDocument(doc)}
          />
        ))}
      </View>

      <View className="p-4">
        <Text className="text-slate-500 text-xs text-center">
          Long press on a document to delete it
        </Text>
      </View>
    </ScrollView>
  );
}
