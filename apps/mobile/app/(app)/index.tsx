import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronDown,
  ChevronUp,
  Award,
  Lightbulb,
  GraduationCap,
  BadgeCheck,
  Sparkles,
  FileText,
  Search,
  X,
} from 'lucide-react-native';
import {
  useIdentityClaims,
  hasAnyClaims,
  getTotalClaimCount,
  IdentityClaim,
  Evidence,
  CLAIM_TYPE_COLORS,
  CLAIM_TYPE_LABELS,
  GroupedClaims,
} from '../../hooks/use-identity-claims';
import { useProfile } from '../../hooks/use-profile';
import { Logo } from '../../components/logo';
import { IdentityReflection } from '../../components/identity-reflection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CLAIM_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  skill: Sparkles,
  achievement: Award,
  attribute: Lightbulb,
  education: GraduationCap,
  certification: BadgeCheck,
};

function ConfidenceBar({ confidence }: { confidence: number | null }) {
  const value = confidence ?? 0;
  const percentage = Math.round(value * 100);

  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <View
          className="h-full bg-teal-500 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </View>
      <Text className="text-xs text-slate-500 w-8">{percentage}%</Text>
    </View>
  );
}

function EvidenceItem({ evidence }: { evidence: Evidence }) {
  return (
    <View className="flex-row items-start gap-2 mb-2">
      <FileText color="#64748b" size={14} />
      <View className="flex-1">
        <Text className="text-sm text-slate-300">{evidence.text}</Text>
        <Text className="text-xs text-slate-500 mt-0.5">
          {evidence.source_type || 'Source'} • {evidence.evidence_type}
        </Text>
      </View>
    </View>
  );
}

function ClaimCard({ claim }: { claim: IdentityClaim }) {
  const [expanded, setExpanded] = useState(false);
  const colors = CLAIM_TYPE_COLORS[claim.type];

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      className="mb-3 rounded-xl border overflow-hidden"
      style={{
        backgroundColor: colors.bgHex,
        borderColor: colors.borderHex,
      }}
    >
      <View className="p-4">
        <View className="flex-row items-start justify-between mb-2">
          <Text
            className="text-base font-semibold flex-1 mr-2"
            style={{ color: colors.textHex }}
          >
            {claim.label}
          </Text>
          {expanded ? (
            <ChevronUp color="#64748b" size={20} />
          ) : (
            <ChevronDown color="#64748b" size={20} />
          )}
        </View>

        <ConfidenceBar confidence={claim.confidence} />

        {claim.description && !expanded && (
          <Text className="text-sm text-slate-400 mt-2" numberOfLines={2}>
            {claim.description}
          </Text>
        )}
      </View>

      {expanded && (
        <View className="px-4 pb-4 border-t border-slate-700/50 pt-3">
          {claim.description && (
            <Text className="text-sm text-slate-300 mb-4">{claim.description}</Text>
          )}

          {claim.evidence.length > 0 && (
            <View>
              <Text className="text-xs font-bold text-slate-500 uppercase mb-2">
                Supporting Evidence ({claim.evidence.length})
              </Text>
              {claim.evidence.map((ev) => (
                <EvidenceItem key={ev.id} evidence={ev} />
              ))}
            </View>
          )}

          {claim.evidence.length === 0 && (
            <Text className="text-sm text-slate-500 italic">No supporting evidence</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

function ClaimTypeSection({
  type,
  claims,
}: {
  type: keyof GroupedClaims;
  claims: IdentityClaim[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const colors = CLAIM_TYPE_COLORS[type];
  const Icon = CLAIM_TYPE_ICONS[type];

  if (claims.length === 0) return null;

  return (
    <View className="mb-6">
      <Pressable
        onPress={() => setCollapsed(!collapsed)}
        className="flex-row items-center justify-between mb-3"
      >
        <View className="flex-row items-center gap-2">
          <Icon color={colors.icon} size={20} />
          <Text
            className="text-sm font-bold uppercase tracking-wider"
            style={{ color: colors.textHex }}
          >
            {CLAIM_TYPE_LABELS[type]}
          </Text>
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: colors.bgHex }}
          >
            <Text className="text-xs font-bold" style={{ color: colors.textHex }}>
              {claims.length}
            </Text>
          </View>
        </View>
        {collapsed ? (
          <ChevronDown color="#64748b" size={20} />
        ) : (
          <ChevronUp color="#64748b" size={20} />
        )}
      </Pressable>

      {!collapsed && claims.map((claim) => <ClaimCard key={claim.id} claim={claim} />)}
    </View>
  );
}

const CLAIM_TYPES: (keyof GroupedClaims)[] = ['skill', 'achievement', 'attribute', 'education', 'certification'];

function FilterChip({
  type,
  selected,
  count,
  onPress,
}: {
  type: keyof GroupedClaims;
  selected: boolean;
  count: number;
  onPress: () => void;
}) {
  const colors = CLAIM_TYPE_COLORS[type];
  const Icon = CLAIM_TYPE_ICONS[type];

  if (count === 0) return null;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full mr-2 mb-2 border"
      style={{
        backgroundColor: selected ? colors.bgHex : '#1e293b',
        borderColor: selected ? colors.borderHex : '#334155',
      }}
    >
      <Icon color={selected ? colors.icon : '#64748b'} size={14} />
      <Text
        className="text-sm"
        style={{ color: selected ? colors.textHex : '#94a3b8' }}
      >
        {CLAIM_TYPE_LABELS[type]}
      </Text>
      <View
        className="px-1.5 py-0.5 rounded-full"
        style={{ backgroundColor: selected ? 'rgba(15, 23, 42, 0.3)' : '#334155' }}
      >
        <Text
          className="text-xs"
          style={{ color: selected ? colors.textHex : '#94a3b8' }}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

export default function IdentityScreen() {
  const { data: groupedClaims, isLoading, error, refetch, isRefetching } = useIdentityClaims();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<keyof GroupedClaims>>(new Set(CLAIM_TYPES));

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const filteredClaims = useMemo(() => {
    if (!groupedClaims) return null;

    const query = searchQuery.toLowerCase().trim();
    const filtered: GroupedClaims = {
      skill: [],
      achievement: [],
      attribute: [],
      education: [],
      certification: [],
    };

    for (const type of CLAIM_TYPES) {
      if (!selectedTypes.has(type)) continue;

      filtered[type] = groupedClaims[type].filter((claim) => {
        if (!query) return true;
        return (
          claim.label.toLowerCase().includes(query) ||
          claim.description?.toLowerCase().includes(query) ||
          claim.evidence.some((e) => e.text.toLowerCase().includes(query))
        );
      });
    }

    return filtered;
  }, [groupedClaims, searchQuery, selectedTypes]);

  const toggleType = (type: keyof GroupedClaims) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(type)) {
      // Don't allow deselecting all
      if (newSelected.size > 1) {
        newSelected.delete(type);
      }
    } else {
      newSelected.add(type);
    }
    setSelectedTypes(newSelected);
  };

  const selectAllTypes = () => {
    setSelectedTypes(new Set(CLAIM_TYPES));
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center" edges={['bottom']}>
        <ActivityIndicator color="#14b8a6" size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 p-4" edges={['bottom']}>
        <Text className="text-red-500">Failed to load identity</Text>
        <Text className="text-slate-400 mt-2 text-sm">{error.message}</Text>
      </SafeAreaView>
    );
  }

  if (!hasAnyClaims(groupedClaims)) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center p-8" edges={['bottom']}>
        <View className="mb-6">
          <Logo size={80} />
        </View>
        <Text className="text-xl font-bold text-white mb-2 text-center">
          No identity claims yet
        </Text>
        <Text className="text-slate-400 text-center">
          Upload your resume or add work history from the web app to build your identity graph.
        </Text>
      </SafeAreaView>
    );
  }

  const totalClaims = getTotalClaimCount(groupedClaims);
  const filteredTotal = getTotalClaimCount(filteredClaims ?? undefined);
  const isFiltered = searchQuery.trim() || selectedTypes.size < CLAIM_TYPES.length;

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: '#0f172a' }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor="#ffffff"
        />
      }
    >
      <View className="p-4">
        {/* Header */}
        <View className="mb-4">
          <View className="flex-row items-center gap-3 mb-1">
            <Logo size={32} />
            <Text className="text-2xl font-bold text-white">Your Identity</Text>
          </View>
          <Text className="text-slate-400 mt-1">
            {isFiltered
              ? `${filteredTotal} of ${totalClaims} claims`
              : `${totalClaims} claim${totalClaims !== 1 ? 's' : ''} extracted from your experience`}
          </Text>
        </View>

        {/* Identity Reflection */}
        <IdentityReflection data={profile?.identity ?? null} isLoading={profileLoading} />

        {/* Search */}
        <View className="flex-row items-center bg-slate-800 rounded-xl px-3 mb-4">
          <Search color="#64748b" size={18} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search claims..."
            placeholderTextColor="#64748b"
            className="flex-1 py-3 px-2 text-white"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')}>
              <X color="#64748b" size={18} />
            </Pressable>
          ) : null}
        </View>

        {/* Type Filters */}
        <View className="flex-row flex-wrap mb-4">
          {CLAIM_TYPES.map((type) => (
            <FilterChip
              key={type}
              type={type}
              selected={selectedTypes.has(type)}
              count={groupedClaims?.[type]?.length || 0}
              onPress={() => toggleType(type)}
            />
          ))}
          {selectedTypes.size < CLAIM_TYPES.length && (
            <Pressable
              onPress={selectAllTypes}
              className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 mb-2"
            >
              <Text className="text-sm text-slate-400">Show All</Text>
            </Pressable>
          )}
        </View>

        {/* Claims */}
        {filteredTotal === 0 ? (
          <View className="bg-slate-800/50 rounded-xl p-8 items-center">
            <Text className="text-slate-400 text-center">
              No claims match your search
            </Text>
          </View>
        ) : (
          <>
            <ClaimTypeSection type="skill" claims={filteredClaims?.skill || []} />
            <ClaimTypeSection type="achievement" claims={filteredClaims?.achievement || []} />
            <ClaimTypeSection type="attribute" claims={filteredClaims?.attribute || []} />
            <ClaimTypeSection type="education" claims={filteredClaims?.education || []} />
            <ClaimTypeSection type="certification" claims={filteredClaims?.certification || []} />
          </>
        )}
      </View>
    </ScrollView>
  );
}
