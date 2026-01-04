import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TextInput,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronDown,
  Award,
  Lightbulb,
  GraduationCap,
  BadgeCheck,
  Cuboid,
  FileText,
  BookOpen,
  Search,
  X,
  Upload,
  MessageSquarePlus,
  Eye,
  Wand2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react-native";
import { EMPTY_STATE } from "@idynic/shared";
import {
  useIdentityClaims,
  hasAnyClaims,
  getTotalClaimCount,
  IdentityClaim,
  Evidence,
  CLAIM_TYPE_COLORS,
  CLAIM_TYPE_LABELS,
  GroupedClaims,
} from "../../hooks/use-identity-claims";
import { useProfile } from "../../hooks/use-profile";
import { Logo } from "../../components/logo";
import { IdentityReflection } from "../../components/identity-reflection";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CLAIM_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  skill: Cuboid,
  achievement: Award,
  attribute: Lightbulb,
  education: GraduationCap,
  certification: BadgeCheck,
};

function ConfidenceBar({
  confidence,
  color,
}: {
  confidence: number | null;
  color: string;
}) {
  const value = confidence ?? 0;
  const percentage = Math.round(value * 100);

  return (
    <View className="items-end gap-1 w-24">
      <View className="flex-row items-baseline gap-0.5">
        <Text className="text-base font-bold text-white font-mono leading-none">
          {percentage}
        </Text>
        <Text className="text-[10px] font-bold text-slate-500">%</Text>
      </View>
      <View className="w-full h-1 bg-slate-800 rounded-full overflow-hidden border border-white/5">
        <View
          className="h-full rounded-full"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 4,
          }}
        />
      </View>
      <Text className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
        Confidence
      </Text>
    </View>
  );
}

function EvidenceBadge({ evidence }: { evidence: Evidence }) {
  const router = useRouter();
  const isStory = evidence.document?.type === "story";
  const Icon = isStory ? BookOpen : FileText;

  const getDocumentName = () => {
    if (!evidence.document) return evidence.source_type || "Source";
    if (evidence.document.filename) return evidence.document.filename;
    return evidence.document.type === "resume" ? "Resume" : "Document";
  };

  const badgeContent = (
    <View className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/40 mr-2 mb-2">
      <Icon color="#94a3b8" size={12} opacity={0.5} />
      <Text className="text-xs text-slate-300 font-medium" numberOfLines={1}>
        {getDocumentName().replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{4}\)\s*$/, "")}
      </Text>
    </View>
  );

  if (evidence.document?.id) {
    return (
      <Pressable
        onPress={() => router.push(`/documents/${evidence.document?.id}`)}
      >
        {badgeContent}
      </Pressable>
    );
  }

  return badgeContent;
}

function ClaimCard({ claim }: { claim: IdentityClaim }) {
  const [expanded, setExpanded] = useState(false);
  const colors = CLAIM_TYPE_COLORS[claim.type];
  const hasIssues = claim.issues && claim.issues.length > 0;
  const TypeIcon = CLAIM_TYPE_ICONS[claim.type] || Cuboid;
  const evidenceCount = claim.evidence.length;
  const confidence = claim.confidence ?? 0.5;

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      className="mb-3 rounded-xl border-b-2 border-r border-slate-900 overflow-hidden"
      style={{
        backgroundColor: colors.bgHex,
        borderColor: hasIssues ? "#f59e0b" : colors.borderHex,
        borderLeftWidth: 6,
        borderLeftColor: colors.borderHex,
      }}
    >
      <View className="p-4 flex-row items-center gap-4">
        {/* Type Icon */}
        <View className="h-10 w-10 rounded-lg bg-black/20 items-center justify-center border border-white/5">
          <TypeIcon color={colors.textHex} size={20} />
        </View>

        {/* Label & Badges */}
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <Text className="text-base font-bold text-white flex-1 tracking-tight">
              {claim.label}
            </Text>
            {hasIssues && <AlertTriangle color="#f59e0b" size={14} />}
          </View>

          <View className="flex-row flex-wrap gap-1.5">
            {/* Depth Badge */}
            <View
              className={`px-1.5 py-0.5 rounded border ${
                claim.type === "education" || claim.type === "certification"
                  ? "bg-slate-500/10 border-slate-500/20"
                  : evidenceCount >= 3
                    ? "bg-blue-500/10 border-blue-500/20"
                    : evidenceCount === 1
                      ? "bg-amber-500/10 border-amber-500/20"
                      : "bg-slate-500/10 border-slate-500/20"
              }`}
            >
              <Text
                className={`text-[8px] font-bold uppercase tracking-wider ${
                  evidenceCount === 1
                    ? "text-amber-500"
                    : evidenceCount >= 3
                      ? "text-blue-400"
                      : "text-slate-400"
                }`}
              >
                {claim.type === "education" || claim.type === "certification"
                  ? "STABLE"
                  : evidenceCount >= 3
                    ? "STRONG SIGNAL"
                    : evidenceCount === 1
                      ? "SINGLE SOURCE"
                      : "VERIFIED"}
              </Text>
            </View>

            {/* Maturity Badge */}
            {(confidence >= 0.85 || confidence <= 0.4) && (
              <View
                className={`px-1.5 py-0.5 rounded border ${
                  confidence >= 0.85
                    ? "bg-green-500/10 border-green-500/20"
                    : "bg-amber-500/10 border-amber-500/20"
                }`}
              >
                <Text
                  className={`text-[8px] font-bold uppercase tracking-wider ${
                    confidence >= 0.85 ? "text-green-400" : "text-amber-500"
                  }`}
                >
                  {confidence >= 0.85 ? "RECENT" : "LEGACY"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Confidence Diagnostic */}
        <ConfidenceBar confidence={claim.confidence} color={colors.borderHex} />
      </View>

      {expanded && (
        <View className="px-5 pb-5 pt-4 bg-black/20 border-t border-white/5">
          {hasIssues && (
            <View className="mb-4 p-3 rounded-xl bg-amber-950/40 border border-amber-500/30">
              <Text className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2">
                Validation Issues
              </Text>
              {claim.issues.map((issue) => (
                <View
                  key={issue.id}
                  className="flex-row items-start gap-2 mb-1"
                >
                  <AlertTriangle color="#fbbf24" size={12} />
                  <Text className="text-sm text-amber-100/90 flex-1 leading-relaxed">
                    {issue.message}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {claim.description && (
            <View className="mb-4">
              <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Context
              </Text>
              <Text className="text-sm text-slate-300 leading-relaxed italic">
                {claim.description}
              </Text>
            </View>
          )}

          <View>
            <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              Linked Evidence
            </Text>
            <View className="flex-row flex-wrap">
              {claim.evidence.map((ev) => (
                <EvidenceBadge key={ev.id} evidence={ev} />
              ))}
            </View>
          </View>
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
        className="flex-row items-center justify-between mb-3 px-1"
      >
        <View className="flex-row items-center gap-2">
          <Icon color={colors.icon} size={18} />
          <Text
            className="text-xs font-black uppercase tracking-[0.15em]"
            style={{ color: colors.textHex }}
          >
            {CLAIM_TYPE_LABELS[type]}
          </Text>
          <View className="px-2 py-0.5 rounded bg-black/20 border border-white/5">
            <Text
              className="text-[10px] font-bold font-mono"
              style={{ color: colors.textHex }}
            >
              {claims.length}
            </Text>
          </View>
        </View>
        <ChevronDown
          color="#64748b"
          size={18}
          style={{ transform: [{ rotate: collapsed ? "0deg" : "180deg" }] }}
        />
      </Pressable>

      {!collapsed &&
        claims.map((claim) => <ClaimCard key={claim.id} claim={claim} />)}
    </View>
  );
}

const CLAIM_TYPES: (keyof GroupedClaims)[] = [
  "skill",
  "achievement",
  "attribute",
  "education",
  "certification",
];

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
      className="flex-row items-center gap-1.5 px-3 py-2 rounded-full mr-2 mb-2 border"
      style={{
        backgroundColor: selected ? colors.bgHex : "#0f172a",
        borderColor: selected ? colors.borderHex : "#1e293b",
      }}
    >
      <Icon color={selected ? colors.icon : "#475569"} size={14} />
      <Text
        className="text-xs font-bold"
        style={{ color: selected ? colors.textHex : "#64748b" }}
      >
        {CLAIM_TYPE_LABELS[type]}
      </Text>
      <View className="px-1.5 py-0.5 rounded bg-black/20">
        <Text
          className="text-[10px] font-bold font-mono"
          style={{ color: selected ? colors.textHex : "#475569" }}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

export default function IdentityScreen() {
  const router = useRouter();
  const {
    data: groupedClaims,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useIdentityClaims();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<keyof GroupedClaims>>(
    new Set(CLAIM_TYPES),
  );

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

  // Count claims with issues for "All verified" indicator
  const claimsWithIssues = useMemo(() => {
    if (!groupedClaims) return 0;
    return Object.values(groupedClaims)
      .flat()
      .filter((claim) => claim.issues && claim.issues.length > 0).length;
  }, [groupedClaims]);

  const toggleType = (type: keyof GroupedClaims) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(type)) {
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
      <SafeAreaView
        className="flex-1 bg-slate-950 justify-center items-center"
        edges={["bottom"]}
      >
        <ActivityIndicator color="#14b8a6" size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950 p-4" edges={["bottom"]}>
        <Text className="text-red-500">Failed to load Master Record</Text>
        <Text className="text-slate-400 mt-2 text-sm">{error.message}</Text>
      </SafeAreaView>
    );
  }

  if (!hasAnyClaims(groupedClaims)) {
    const featureIcons = [Eye, Wand2, TrendingUp];

    return (
      <ScrollView
        className="flex-1 bg-slate-950"
        contentContainerStyle={{ padding: 24 }}
      >
        <SafeAreaView edges={["bottom"]}>
          {/* Main CTA */}
          <View className="items-center mb-8">
            <View className="mb-8 rounded-2xl overflow-hidden border border-slate-800 bg-black/40 w-full aspect-video items-center justify-center">
              <Logo size={64} />
              <Text className="text-slate-500 font-mono text-[10px] mt-4 uppercase tracking-[0.3em]">
                System Initializing
              </Text>
            </View>
            <Text className="text-2xl font-bold text-white mb-2 text-center">
              Start your Master Record
            </Text>
            <Text className="text-slate-400 text-center mb-8 px-4">
              Upload your resume or add professional stories to extract your
              first <strong>Evidence Blocks</strong>.
            </Text>

            <View className="w-full gap-3">
              <Pressable
                onPress={() => router.push("/upload-resume")}
                className="flex-row items-center justify-center gap-3 bg-teal-600 py-4 px-6 rounded-xl shadow-lg shadow-teal-900/20"
              >
                <Upload color="white" size={20} />
                <Text className="text-white font-bold text-base">
                  {EMPTY_STATE.actions.resume.title}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/add-story")}
                className="flex-row items-center justify-center gap-3 bg-slate-800 border border-slate-700 py-4 px-6 rounded-xl"
              >
                <MessageSquarePlus color="#14b8a6" size={20} />
                <Text className="text-white font-bold text-base">
                  {EMPTY_STATE.actions.story.title}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* What blocks unlock */}
          <View className="mb-8">
            {EMPTY_STATE.features.map((feature, i) => {
              const Icon = featureIcons[i];
              return (
                <View
                  key={feature.title}
                  className="bg-slate-900/50 border border-white/5 rounded-xl p-5 mb-3"
                >
                  <View className="flex-row items-center gap-3 mb-2">
                    <View className="h-8 w-8 rounded bg-teal-500/10 items-center justify-center border border-teal-500/20">
                      <Icon color="#14b8a6" size={18} />
                    </View>
                    <Text className="text-white font-bold tracking-tight">
                      {feature.title}
                    </Text>
                  </View>
                  <Text className="text-slate-400 text-sm leading-relaxed">
                    {feature.description}
                  </Text>
                </View>
              );
            })}
          </View>
        </SafeAreaView>
      </ScrollView>
    );
  }

  const totalClaims = getTotalClaimCount(groupedClaims);
  const filteredTotal = getTotalClaimCount(filteredClaims ?? undefined);
  const isFiltered =
    searchQuery.trim() || selectedTypes.size < CLAIM_TYPES.length;

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: "#020617" }} // Deepest slate (slate-950)
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
        <View className="mb-6">
          <View className="flex-row items-center gap-3 mb-2">
            <Logo size={28} />
            <Text className="text-2xl font-bold text-white tracking-tight">
              Master Record
            </Text>
          </View>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-slate-500 text-xs font-mono uppercase tracking-wider">
                {isFiltered
                  ? `${filteredTotal} / ${totalClaims} Blocks`
                  : `${totalClaims} Evidence Blocks`}
              </Text>
            </View>
            {totalClaims > 0 &&
              (claimsWithIssues > 0 ? (
                <View className="flex-row items-center gap-1.5 px-2 py-1 rounded bg-amber-900/20 border border-amber-500/20">
                  <AlertTriangle color="#fbbf24" size={12} />
                  <Text className="text-[10px] font-bold text-amber-500 uppercase tracking-tighter">
                    {claimsWithIssues} Issue{claimsWithIssues !== 1 ? "s" : ""}
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center gap-1.5 px-2 py-1 rounded bg-green-900/20 border border-green-500/20">
                  <CheckCircle2 color="#4ade80" size={12} />
                  <Text className="text-[10px] font-bold text-green-500 uppercase tracking-tighter">
                    Verified
                  </Text>
                </View>
              ))}
          </View>
        </View>

        {/* Identity Reflection */}
        <IdentityReflection
          data={profile?.identity ?? null}
          isLoading={profileLoading}
        />

        {/* Search */}
        <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-3 mb-4 shadow-inner">
          <Search color="#475569" size={18} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search evidence..."
            placeholderTextColor="#475569"
            className="flex-1 py-3 px-2 text-white font-mono text-sm"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <X color="#475569" size={18} />
            </Pressable>
          ) : null}
        </View>

        {/* Type Filters */}
        <View className="flex-row flex-wrap mb-6">
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
              className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 mb-2"
            >
              <Text className="text-xs font-bold text-slate-500">Show All</Text>
            </Pressable>
          )}
        </View>

        {/* Blocks */}
        {filteredTotal === 0 ? (
          <View className="bg-slate-900/50 rounded-2xl p-12 items-center border border-white/5 border-dashed">
            <Text className="text-slate-500 font-bold text-center uppercase tracking-widest text-xs">
              No blocks match your search
            </Text>
          </View>
        ) : (
          <>
            <ClaimTypeSection
              type="skill"
              claims={filteredClaims?.skill || []}
            />
            <ClaimTypeSection
              type="achievement"
              claims={filteredClaims?.achievement || []}
            />
            <ClaimTypeSection
              type="attribute"
              claims={filteredClaims?.attribute || []}
            />
            <ClaimTypeSection
              type="education"
              claims={filteredClaims?.education || []}
            />
            <ClaimTypeSection
              type="certification"
              claims={filteredClaims?.certification || []}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}
