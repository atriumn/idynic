import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Image,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Briefcase, MapPin, Clock, Building2 } from "lucide-react-native";
import {
  useOpportunities,
  Opportunity,
  getRequirements,
} from "../../hooks/use-opportunities";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  tracking: { bg: "bg-slate-700", text: "text-slate-300" },
  applied: { bg: "bg-blue-900", text: "text-blue-300" },
  interviewing: { bg: "bg-amber-900", text: "text-amber-300" },
  offer: { bg: "bg-green-900", text: "text-green-300" },
  rejected: { bg: "bg-red-900", text: "text-red-300" },
  archived: { bg: "bg-slate-800", text: "text-slate-400" },
};

/**
 * Get logo URL from company domain using logo.dev service
 */
function getLogoUrl(companyUrl: string | null | undefined): string | null {
  if (!companyUrl) return null;
  try {
    const url = new URL(companyUrl);
    const domain = url.hostname.replace(/^www\./, "");
    return `https://img.logo.dev/${domain}?token=pk_b3U88G0OTNKjNTpAlTU_OQ&retina=true`;
  } catch {
    return null;
  }
}

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const router = useRouter();
  const status = opportunity.status || "tracking";
  const colors = STATUS_COLORS[status] || STATUS_COLORS.tracking;

  const reqs = getRequirements(opportunity.requirements);
  const mustHaveCount = reqs?.mustHave?.length || 0;
  const niceToHaveCount = reqs?.niceToHave?.length || 0;

  return (
    <Pressable
      onPress={() => router.push(`/opportunities/${opportunity.id}` as never)}
      className="bg-slate-800 rounded-2xl mb-4 overflow-hidden border-2 border-slate-700 active:border-teal-500"
    >
      {/* Header */}
      <View className="p-4">
        <View className="flex-row items-start justify-between mb-3">
          <View className="h-12 w-12 rounded-xl bg-white items-center justify-center overflow-hidden">
            {opportunity.company_logo_url ||
            getLogoUrl(opportunity.company_url) ? (
              <Image
                source={{
                  uri:
                    opportunity.company_logo_url ||
                    getLogoUrl(opportunity.company_url)!,
                }}
                className="h-10 w-10"
                resizeMode="contain"
              />
            ) : (
              <Building2 color="#94a3b8" size={24} />
            )}
          </View>
          <View className={`px-2 py-1 rounded ${colors.bg}`}>
            <Text className={`text-xs font-bold uppercase ${colors.text}`}>
              {status}
            </Text>
          </View>
        </View>

        <Text className="text-lg font-bold text-white mb-1" numberOfLines={2}>
          {opportunity.title || "Untitled Opportunity"}
        </Text>
        <Text className="text-sm font-semibold text-slate-400 uppercase">
          {opportunity.company || "Direct Hire"}
        </Text>
      </View>

      {/* Meta info */}
      <View className="px-4 pb-4 flex-row flex-wrap gap-2">
        {opportunity.location && (
          <View className="flex-row items-center bg-slate-700/50 px-2 py-1 rounded">
            <MapPin color="#94a3b8" size={12} />
            <Text className="text-xs text-slate-400 ml-1">
              {opportunity.location}
            </Text>
          </View>
        )}
        {opportunity.employment_type && (
          <View className="flex-row items-center bg-slate-700/50 px-2 py-1 rounded">
            <Briefcase color="#94a3b8" size={12} />
            <Text className="text-xs text-slate-400 ml-1">
              {opportunity.employment_type}
            </Text>
          </View>
        )}
      </View>

      {/* Match info */}
      {(mustHaveCount > 0 || niceToHaveCount > 0) && (
        <View className="px-4 pb-4 flex-row gap-4">
          {mustHaveCount > 0 && (
            <View>
              <Text className="text-lg font-bold text-white">
                {mustHaveCount}
              </Text>
              <Text className="text-xs text-slate-500 uppercase">Required</Text>
            </View>
          )}
          {niceToHaveCount > 0 && (
            <View>
              <Text className="text-lg font-bold text-slate-400">
                {niceToHaveCount}
              </Text>
              <Text className="text-xs text-slate-500 uppercase">Bonus</Text>
            </View>
          )}
        </View>
      )}

      {/* Footer */}
      <View className="px-4 py-3 bg-slate-700/30 flex-row items-center">
        <Clock color="#64748b" size={12} />
        <Text className="text-xs text-slate-500 ml-1.5 uppercase font-semibold">
          {opportunity.created_at
            ? formatDistanceToNow(new Date(opportunity.created_at), {
                addSuffix: true,
              })
            : "Just now"}
        </Text>
      </View>
    </Pressable>
  );
}

export default function OpportunitiesScreen() {
  const {
    data: opportunities,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useOpportunities();

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-900 justify-center items-center">
        <ActivityIndicator color="#14b8a6" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-slate-900 p-4">
        <Text className="text-red-500">Failed to load opportunities</Text>
        <Text className="text-slate-400 mt-2 text-sm">{error.message}</Text>
      </View>
    );
  }

  if (!opportunities || opportunities.length === 0) {
    return (
      <View className="flex-1 bg-slate-900 justify-center items-center p-8">
        <View className="h-20 w-20 rounded-full bg-slate-800 items-center justify-center mb-6">
          <Briefcase color="#64748b" size={40} />
        </View>
        <Text className="text-xl font-bold text-white mb-2 text-center">
          No opportunities yet
        </Text>
        <Text className="text-slate-400 text-center">
          Start tracking your job search by adding opportunities from the web
          app.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: "#0f172a" }}>
      <FlatList
        data={opportunities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <OpportunityCard opportunity={item} />}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#ffffff"
          />
        }
      />
    </View>
  );
}
