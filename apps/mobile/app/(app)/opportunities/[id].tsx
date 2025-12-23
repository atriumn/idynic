import { View, Text, ScrollView, ActivityIndicator, Pressable, Image, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Briefcase,
  DollarSign,
  ExternalLink,
  Globe,
  Lightbulb,
  Newspaper,
  TrendingUp,
  FileText,
  CheckCircle2,
  Circle,
} from 'lucide-react-native';
import { useOpportunity, OpportunityDetail } from '../../../hooks/use-opportunity';
import { getRequirements } from '../../../hooks/use-opportunities';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  tracking: { bg: 'bg-slate-700', text: 'text-slate-300' },
  applied: { bg: 'bg-blue-900', text: 'text-blue-300' },
  interviewing: { bg: 'bg-amber-900', text: 'text-amber-300' },
  offer: { bg: 'bg-green-900', text: 'text-green-300' },
  rejected: { bg: 'bg-red-900', text: 'text-red-300' },
  archived: { bg: 'bg-slate-800', text: 'text-slate-400' },
};

function formatSalary(min: number | null, max: number | null, currency: string | null): string | null {
  if (!min && !max) return null;
  const curr = currency || '$';
  const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  if (min && max) {
    return `${curr}${formatter.format(min)} - ${curr}${formatter.format(max)}`;
  }
  if (min) return `${curr}${formatter.format(min)}+`;
  if (max) return `Up to ${curr}${formatter.format(max)}`;
  return null;
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <View className="flex-row items-center gap-2 mb-3">
        {icon}
        <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function RequirementsList({ items, label, matched }: { items: string[]; label: string; matched?: boolean }) {
  if (!items || items.length === 0) return null;

  return (
    <View className="mb-4">
      <Text className="text-xs font-bold text-slate-500 uppercase mb-2">{label}</Text>
      {items.map((item, index) => (
        <View key={index} className="flex-row items-start gap-2 mb-2">
          {matched !== undefined ? (
            matched ? (
              <CheckCircle2 color="#14b8a6" size={16} />
            ) : (
              <Circle color="#64748b" size={16} />
            )
          ) : (
            <View className="h-1.5 w-1.5 rounded-full bg-slate-500 mt-1.5" />
          )}
          <Text className="text-sm text-slate-300 flex-1">{item}</Text>
        </View>
      ))}
    </View>
  );
}

function BulletList({ items, color }: { items: unknown; color: string }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <View>
      {items.map((item, index) => (
        <View key={index} className="flex-row items-start gap-2 mb-2">
          <View className={`h-1.5 w-1.5 rounded-full mt-1.5 ${color}`} />
          <Text className="text-sm text-slate-300 flex-1">{String(item)}</Text>
        </View>
      ))}
    </View>
  );
}

export default function OpportunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: opportunity, isLoading, error } = useOpportunity(id || '');

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center" edges={['bottom']}>
        <ActivityIndicator color="#14b8a6" size="large" />
      </SafeAreaView>
    );
  }

  if (error || !opportunity) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 p-4" edges={['bottom']}>
        <Pressable onPress={() => router.back()} className="flex-row items-center mb-4">
          <ArrowLeft color="#94a3b8" size={20} />
          <Text className="text-slate-400 ml-2">Back</Text>
        </Pressable>
        <Text className="text-red-500">Failed to load opportunity</Text>
        <Text className="text-slate-400 mt-2 text-sm">{error?.message || 'Opportunity not found'}</Text>
      </SafeAreaView>
    );
  }

  const status = opportunity.status || 'tracking';
  const colors = STATUS_COLORS[status] || STATUS_COLORS.tracking;
  const salaryStr = formatSalary(opportunity.salary_min, opportunity.salary_max, opportunity.salary_currency);
  const reqs = getRequirements(opportunity.requirements);

  return (
    <SafeAreaView className="flex-1 bg-slate-900" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="px-4 pt-4">
          <Pressable onPress={() => router.back()} className="flex-row items-center mb-6">
            <ArrowLeft color="#94a3b8" size={20} />
            <Text className="text-slate-400 ml-2">Back to Opportunities</Text>
          </Pressable>

          {/* Company Logo and Status */}
          <View className="flex-row items-start justify-between mb-4">
            <View className="h-16 w-16 rounded-2xl bg-white items-center justify-center overflow-hidden">
              {opportunity.company_logo_url ? (
                <Image
                  source={{ uri: opportunity.company_logo_url }}
                  className="h-14 w-14"
                  resizeMode="contain"
                />
              ) : (
                <Building2 color="#94a3b8" size={32} />
              )}
            </View>
            <View className={`px-3 py-1.5 rounded-lg ${colors.bg}`}>
              <Text className={`text-xs font-bold uppercase ${colors.text}`}>{status}</Text>
            </View>
          </View>

          {/* Title and Company */}
          <Text className="text-2xl font-bold text-white mb-2">{opportunity.title || 'Untitled Opportunity'}</Text>
          <View className="flex-row items-center gap-2 mb-4">
            <Text className="text-lg font-semibold text-teal-400">{opportunity.company || 'Direct Hire'}</Text>
            {opportunity.company_url && (
              <Pressable onPress={() => Linking.openURL(opportunity.company_url!)}>
                <Globe color="#64748b" size={18} />
              </Pressable>
            )}
          </View>

          {/* Meta Info Pills */}
          <View className="flex-row flex-wrap gap-2 mb-6">
            {opportunity.location && (
              <View className="flex-row items-center bg-slate-800 px-3 py-1.5 rounded-lg">
                <MapPin color="#94a3b8" size={14} />
                <Text className="text-sm text-slate-300 ml-1.5">{opportunity.location}</Text>
              </View>
            )}
            {opportunity.employment_type && (
              <View className="flex-row items-center bg-slate-800 px-3 py-1.5 rounded-lg">
                <Briefcase color="#94a3b8" size={14} />
                <Text className="text-sm text-slate-300 ml-1.5">{opportunity.employment_type}</Text>
              </View>
            )}
            {salaryStr && (
              <View className="flex-row items-center bg-green-900/50 px-3 py-1.5 rounded-lg">
                <DollarSign color="#4ade80" size={14} />
                <Text className="text-sm text-green-400 ml-1">{salaryStr}</Text>
              </View>
            )}
          </View>

          {/* View Posting Button */}
          {opportunity.url && (
            <Pressable
              onPress={() => Linking.openURL(opportunity.url!)}
              className="bg-teal-600 py-3 px-4 rounded-xl flex-row items-center justify-center mb-6 active:bg-teal-700"
            >
              <ExternalLink color="white" size={18} />
              <Text className="text-white font-bold ml-2">View Job Posting</Text>
            </Pressable>
          )}
        </View>

        {/* Requirements Section */}
        {reqs && (reqs.mustHave?.length || reqs.niceToHave?.length) ? (
          <View className="px-4">
            <Section title="Requirements" icon={<CheckCircle2 color="#14b8a6" size={18} />}>
              <View className="bg-slate-800 rounded-xl p-4">
                <RequirementsList items={reqs.mustHave || []} label="Must Have" />
                <RequirementsList items={reqs.niceToHave || []} label="Nice to Have" />
              </View>
            </Section>
          </View>
        ) : null}

        {/* Company Research Section */}
        {opportunity.company_role_context && (
          <View className="px-4">
            <Section title="Strategic Role Intent" icon={<Lightbulb color="#f59e0b" size={18} />}>
              <View className="bg-amber-900/30 rounded-xl p-4 border border-amber-800/50">
                <Text className="text-sm text-amber-200 italic leading-relaxed">
                  "{opportunity.company_role_context}"
                </Text>
              </View>
            </Section>
          </View>
        )}

        {Array.isArray(opportunity.company_recent_news) && opportunity.company_recent_news.length > 0 && (
          <View className="px-4">
            <Section title="Market Intelligence" icon={<Newspaper color="#3b82f6" size={18} />}>
              <View className="bg-slate-800 rounded-xl p-4">
                <BulletList items={opportunity.company_recent_news} color="bg-blue-500" />
              </View>
            </Section>
          </View>
        )}

        {Array.isArray(opportunity.company_challenges) && opportunity.company_challenges.length > 0 && (
          <View className="px-4">
            <Section title="Likely Challenges" icon={<TrendingUp color="#22c55e" size={18} />}>
              <View className="bg-slate-800 rounded-xl p-4">
                <BulletList items={opportunity.company_challenges} color="bg-green-500" />
              </View>
            </Section>
          </View>
        )}

        {/* Job Description */}
        {opportunity.description && (
          <View className="px-4">
            <Section title="Job Description" icon={<FileText color="#94a3b8" size={18} />}>
              <View className="bg-slate-800 rounded-xl p-4">
                <Text className="text-sm text-slate-300 leading-relaxed">{opportunity.description}</Text>
              </View>
            </Section>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
