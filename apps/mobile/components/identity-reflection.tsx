import { View, Text, ActivityIndicator } from 'react-native';
import { IdentityReflection as IdentityReflectionData } from '../hooks/use-profile';

// Archetype color mapping for React Native
const ARCHETYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Builder: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  Optimizer: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  Connector: { bg: '#e0f2fe', text: '#075985', border: '#7dd3fc' },
  Guide: { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
  Stabilizer: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  Specialist: { bg: '#ffe4e6', text: '#9f1239', border: '#fda4af' },
  Strategist: { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
  Advocate: { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  Investigator: { bg: '#cffafe', text: '#155e75', border: '#67e8f9' },
  Performer: { bg: '#fae8ff', text: '#86198f', border: '#f0abfc' },
};

const DEFAULT_COLOR = { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };

interface IdentityReflectionProps {
  data: IdentityReflectionData | null;
  isLoading?: boolean;
}

export function IdentityReflection({ data, isLoading }: IdentityReflectionProps) {
  // Don't render anything if no data and not loading
  if (!data && !isLoading) {
    return null;
  }

  // Check if we have any content to show
  const hasContent = data && (
    data.headline ||
    data.bio ||
    data.archetype ||
    (data.keywords && data.keywords.length > 0) ||
    (data.matches && data.matches.length > 0)
  );

  // Loading state
  if (isLoading) {
    return (
      <View className="bg-slate-800 rounded-xl p-4 mb-4">
        <View className="flex-row items-center gap-3">
          <ActivityIndicator color="#14b8a6" size="small" />
          <Text className="text-slate-400">Synthesizing your profile...</Text>
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
    <View className="bg-slate-800 rounded-xl p-4 mb-4">
      {/* Archetype Badge */}
      {data?.archetype && (
        <View
          className="self-start px-3 py-1 rounded-full mb-3 border"
          style={{
            backgroundColor: colors.bg,
            borderColor: colors.border,
          }}
        >
          <Text
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: colors.text }}
          >
            {data.archetype}
          </Text>
        </View>
      )}

      {/* Headline */}
      {data?.headline && (
        <Text className="text-xl font-bold text-white mb-2">{data.headline}</Text>
      )}

      {/* Bio */}
      {data?.bio && (
        <Text className="text-slate-300 mb-3 leading-relaxed">{data.bio}</Text>
      )}

      {/* Keywords */}
      {data?.keywords && data.keywords.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mb-3">
          {data.keywords.map((keyword, index) => (
            <View
              key={index}
              className="bg-slate-700 px-2.5 py-1 rounded-full"
            >
              <Text className="text-sm text-slate-300">{keyword}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Job Matches */}
      {data?.matches && data.matches.length > 0 && (
        <Text className="text-sm text-slate-500">
          <Text className="font-medium">Best fit roles: </Text>
          {data.matches.join(' \u00B7 ')}
        </Text>
      )}
    </View>
  );
}
