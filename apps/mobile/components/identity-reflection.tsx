import { View, Text, ActivityIndicator } from "react-native";
import { Sparkles } from "lucide-react-native";
import { IdentityReflection as IdentityReflectionData } from "../hooks/use-profile";

// Archetype color mapping for React Native
const ARCHETYPE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  Builder: { bg: "#fef3c7", text: "#fcd34d", border: "#fcd34d" },
  Optimizer: { bg: "#d1fae5", text: "#6ee7b7", border: "#6ee7b7" },
  Connector: { bg: "#e0f2fe", text: "#7dd3fc", border: "#7dd3fc" },
  Guide: { bg: "#ede9fe", text: "#c4b5fd", border: "#c4b5fd" },
  Stabilizer: { bg: "#f1f5f9", text: "#cbd5e1", border: "#cbd5e1" },
  Specialist: { bg: "#ffe4e6", text: "#fda4af", border: "#fda4af" },
  Strategist: { bg: "#e0e7ff", text: "#a5b4fc", border: "#a5b4fc" },
  Advocate: { bg: "#ffedd5", text: "#fdba74", border: "#fdba74" },
  Investigator: { bg: "#cffafe", text: "#67e8f9", border: "#67e8f9" },
  Performer: { bg: "#fae8ff", text: "#f0abfc", border: "#f0abfc" },
};

const DEFAULT_COLOR = { bg: "#f1f5f9", text: "#cbd5e1", border: "#cbd5e1" };

interface IdentityReflectionProps {
  data: IdentityReflectionData | null;
  isLoading?: boolean;
}

export function IdentityReflection({
  data,
  isLoading,
}: IdentityReflectionProps) {
  // Don't render anything if no data and not loading
  if (!data && !isLoading) {
    return null;
  }

  // Check if we have any content to show
  const hasContent =
    data &&
    (data.headline ||
      data.bio ||
      data.archetype ||
      (data.keywords && data.keywords.length > 0) ||
      (data.matches && data.matches.length > 0));

  // Loading state
  if (isLoading) {
    return (
      <View className="bg-slate-950 rounded-2xl p-6 mb-6 border border-slate-800 shadow-xl overflow-hidden">
        <View className="flex-row items-center gap-3">
          <ActivityIndicator color="#14b8a6" size="small" />
          <Text className="text-slate-400 font-medium">
            Synthesizing your Master Record...
          </Text>
        </View>
      </View>
    );
  }

  // No content to show
  if (!hasContent) {
    return null;
  }

  const colors = data?.archetype
    ? ARCHETYPE_COLORS[data.archetype] || DEFAULT_COLOR
    : DEFAULT_COLOR;

  return (
    <View className="bg-slate-950 rounded-2xl p-6 mb-6 border border-slate-800 shadow-xl overflow-hidden">
      {/* Archetype Badge */}
      {data?.archetype && (
        <View
          className="self-start flex-row items-center gap-2 px-3 py-1 rounded-full mb-4 border"
          style={{
            backgroundColor: `${colors.text}15`,
            borderColor: `${colors.border}40`,
          }}
        >
          <Sparkles size={12} color={colors.text} />
          <Text
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: colors.text }}
          >
            {data.archetype}
          </Text>
        </View>
      )}

      {/* Headline */}
      {data?.headline && (
        <Text className="text-2xl font-bold text-white mb-3 tracking-tight">
          {data.headline}
        </Text>
      )}

      {/* Bio */}
      {data?.bio && (
        <Text className="text-slate-400 text-base mb-6 leading-relaxed">
          {data.bio}
        </Text>
      )}

      {/* Keywords & Matches Section */}
      <View className="pt-4 border-t border-slate-800/50">
        {data?.keywords && data.keywords.length > 0 && (
          <View className="mb-4">
            <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">
              Core Competencies
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {data.keywords.map((keyword, index) => (
                <View
                  key={index}
                  className="bg-slate-900/50 border border-slate-800 px-2.5 py-1 rounded-md"
                >
                  <Text className="text-xs font-medium text-slate-300">
                    {keyword}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Job Matches */}
        {data?.matches && data.matches.length > 0 && (
          <View>
            <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Best Fit Roles
            </Text>
            <Text className="text-sm font-medium text-slate-300">
              {data.matches.join(" \u00B7 ")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
