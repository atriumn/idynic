import { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Image, Linking, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import RenderHtml from 'react-native-render-html';
import * as Clipboard from 'expo-clipboard';
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
  User,
  Sparkles,
  Share2,
  Check,
  GraduationCap,
  Rocket,
} from 'lucide-react-native';
import {
  useOpportunity,
  useTailoredProfile,
  useGenerateTailoredProfile,
  ResumeData,
  ResumeExperience,
  SkillCategory,
} from '../../../hooks/use-opportunity';
import { getRequirements } from '../../../hooks/use-opportunities';
import { useCreateSharedLink } from '../../../hooks/use-shared-links';

/**
 * Render markdown bold (**text**) as styled Text elements
 */
function renderMarkdownBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={i} className="font-semibold text-white">{part.slice(2, -2)}</Text>;
    }
    return part;
  });
}

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

function RequirementsList({ items, label }: { items: string[]; label: string }) {
  if (!items || items.length === 0) return null;

  return (
    <View className="mb-4">
      <Text className="text-xs font-bold text-slate-500 uppercase mb-2">{label}</Text>
      {items.map((item, index) => (
        <View key={index} className="flex-row items-start gap-2 mb-2">
          <View className="h-1.5 w-1.5 rounded-full bg-slate-500 mt-1.5" />
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

function TailoredWorkHistory({ experience }: { experience: ResumeExperience[] }) {
  if (!experience || experience.length === 0) return null;

  return (
    <View>
      {experience.map((job, index) => (
        <View key={index} className="mb-4 last:mb-0">
          <Text className="text-white font-semibold">{job.title}</Text>
          <Text className="text-teal-400 text-sm">{job.company}</Text>
          <View className="flex-row items-center gap-2 mt-0.5">
            <Text className="text-xs text-slate-500">{job.dates}</Text>
            {job.location && <Text className="text-xs text-slate-500">• {job.location}</Text>}
          </View>
          {job.bullets && job.bullets.length > 0 && (
            <View className="mt-2">
              {job.bullets.map((bullet, i) => (
                <View key={i} className="flex-row items-start gap-2 mb-1">
                  <View className="h-1 w-1 rounded-full bg-slate-500 mt-2" />
                  <Text className="text-sm text-slate-300 flex-1">
                    {renderMarkdownBold(bullet)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function TailoredVentures({ ventures }: { ventures: ResumeData['ventures'] }) {
  if (!ventures || ventures.length === 0) return null;

  return (
    <View>
      {ventures.map((venture, index) => (
        <View key={index} className="mb-3 last:mb-0">
          <View className="flex-row items-center gap-2">
            <Text className="text-white font-semibold">{venture.name}</Text>
            {venture.status && (
              <View className="bg-amber-900/50 px-2 py-0.5 rounded">
                <Text className="text-amber-300 text-xs">{venture.status}</Text>
              </View>
            )}
          </View>
          <Text className="text-teal-400 text-sm">{venture.role}</Text>
          {venture.description && (
            <Text className="text-slate-300 text-sm mt-1">{venture.description}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function TailoredEducation({ education }: { education: ResumeData['education'] }) {
  if (!education || education.length === 0) return null;

  return (
    <View>
      {education.map((edu, index) => (
        <View key={index} className="mb-3 last:mb-0 flex-row justify-between">
          <View className="flex-1">
            <Text className="text-white font-semibold">{edu.degree}</Text>
            <Text className="text-teal-400 text-sm">{edu.institution}</Text>
          </View>
          {edu.year && (
            <Text className="text-slate-500 text-sm">{edu.year}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function TailoredSkills({ skills }: { skills: SkillCategory[] | string[] }) {
  if (!skills || skills.length === 0) return null;

  // Handle old format (string[])
  if (typeof skills[0] === 'string') {
    return (
      <View className="flex-row flex-wrap gap-2">
        {(skills as string[]).map((skill, index) => (
          <View key={index} className="bg-teal-900/50 px-3 py-1 rounded-full">
            <Text className="text-teal-300 text-sm">{skill}</Text>
          </View>
        ))}
      </View>
    );
  }

  // Handle new format (SkillCategory[])
  return (
    <View className="gap-4">
      {(skills as SkillCategory[]).map((category, catIndex) => (
        <View key={catIndex}>
          <Text className="text-xs font-bold text-slate-500 uppercase mb-2">
            {category.category}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {category.skills.map((skill, index) => (
              <View
                key={index}
                className={`px-3 py-1 rounded-full ${
                  catIndex === 0 && index < 3 ? 'bg-teal-600' : 'bg-slate-700'
                }`}
              >
                <Text
                  className={`text-sm ${
                    catIndex === 0 && index < 3 ? 'text-white font-medium' : 'text-slate-300'
                  }`}
                >
                  {skill}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function OpportunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<'tailored' | 'research'>('tailored');
  const [shareCopied, setShareCopied] = useState(false);

  const { data: opportunity, isLoading, error } = useOpportunity(id || '');
  const { data: tailoredProfile, isLoading: tailoredLoading } = useTailoredProfile(id || '');
  const generateProfile = useGenerateTailoredProfile(id || '');
  const createSharedLink = useCreateSharedLink();

  const handleGenerateProfile = () => {
    generateProfile.mutate({});
  };

  const handleShare = async () => {
    if (!tailoredProfile?.id) return;

    try {
      const result = await createSharedLink.mutateAsync({
        tailoredProfileId: tailoredProfile.id,
      });
      await Clipboard.setStringAsync(result.url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error('Failed to create/copy share link:', err);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center" edges={['top', 'bottom']}>
        <ActivityIndicator color="#14b8a6" size="large" />
      </SafeAreaView>
    );
  }

  if (error || !opportunity) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 p-4" edges={['top', 'bottom']}>
        <Pressable onPress={() => router.push('/opportunities')} className="flex-row items-center mb-4">
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

  const htmlStyles = {
    body: { color: '#cbd5e1', fontSize: 14, lineHeight: 22 },
    p: { marginBottom: 12 },
    li: { marginBottom: 4 },
    ul: { paddingLeft: 16 },
    ol: { paddingLeft: 16 },
    h1: { color: '#f8fafc', fontSize: 20, fontWeight: '700' as const, marginBottom: 8 },
    h2: { color: '#f8fafc', fontSize: 18, fontWeight: '700' as const, marginBottom: 8 },
    h3: { color: '#f8fafc', fontSize: 16, fontWeight: '600' as const, marginBottom: 6 },
    strong: { color: '#f8fafc', fontWeight: '600' as const },
    a: { color: '#14b8a6' },
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-900" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="px-4 pt-2">
          <Pressable onPress={() => router.push('/opportunities')} className="flex-row items-center mb-4 py-2">
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

          {/* Action Buttons */}
          <View className="flex-row gap-3 mb-6">
            {/* View Posting Button */}
            {opportunity.url && (
              <Pressable
                onPress={() => Linking.openURL(opportunity.url!)}
                className={`py-3 px-4 rounded-xl flex-row items-center justify-center active:bg-teal-700 ${
                  tailoredProfile?.id ? 'flex-1 bg-teal-600' : 'flex-1 bg-teal-600'
                }`}
              >
                <ExternalLink color="white" size={18} />
                <Text className="text-white font-bold ml-2">View Posting</Text>
              </Pressable>
            )}

            {/* Share Button - only show when tailored profile exists */}
            {tailoredProfile?.id && (
              <Pressable
                onPress={handleShare}
                disabled={createSharedLink.isPending}
                className={`py-3 px-4 rounded-xl flex-row items-center justify-center ${
                  shareCopied
                    ? 'bg-green-600'
                    : createSharedLink.isPending
                    ? 'bg-slate-700'
                    : 'bg-slate-700 active:bg-slate-600'
                }`}
              >
                {createSharedLink.isPending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : shareCopied ? (
                  <>
                    <Check color="white" size={18} />
                    <Text className="text-white font-bold ml-2">Copied!</Text>
                  </>
                ) : (
                  <>
                    <Share2 color="white" size={18} />
                    <Text className="text-white font-bold ml-2">Share</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          {/* Tab Switcher */}
          <View className="flex-row bg-slate-800/50 rounded-xl p-1 mb-6">
            <Pressable
              onPress={() => setActiveTab('tailored')}
              className={`flex-1 py-3 rounded-lg ${activeTab === 'tailored' ? 'bg-slate-700' : ''}`}
            >
              <Text className={`text-center text-xs font-bold uppercase tracking-wider ${activeTab === 'tailored' ? 'text-white' : 'text-slate-400'}`}>
                Tailored Profile
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('research')}
              className={`flex-1 py-3 rounded-lg ${activeTab === 'research' ? 'bg-slate-700' : ''}`}
            >
              <Text className={`text-center text-xs font-bold uppercase tracking-wider ${activeTab === 'research' ? 'text-white' : 'text-slate-400'}`}>
                Research
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Tab Content */}
        {activeTab === 'tailored' ? (
          <View className="px-4">
            {tailoredLoading ? (
              <View className="py-8 items-center">
                <ActivityIndicator color="#14b8a6" size="small" />
              </View>
            ) : tailoredProfile && tailoredProfile.resume_data ? (
              <>
                {/* Summary */}
                {tailoredProfile.resume_data.summary && (
                  <Section title="Summary" icon={<User color="#14b8a6" size={18} />}>
                    <View className="bg-slate-800 rounded-xl p-4">
                      <Text className="text-sm text-slate-300 leading-relaxed">
                        {tailoredProfile.resume_data.summary}
                      </Text>
                    </View>
                  </Section>
                )}

                {/* Tailored Experience */}
                {tailoredProfile.resume_data.experience && tailoredProfile.resume_data.experience.length > 0 && (
                  <Section title="Relevant Experience" icon={<Briefcase color="#14b8a6" size={18} />}>
                    <View className="bg-slate-800 rounded-xl p-4">
                      <TailoredWorkHistory experience={tailoredProfile.resume_data.experience} />
                    </View>
                  </Section>
                )}

                {/* Additional Experience */}
                {tailoredProfile.resume_data.additionalExperience && tailoredProfile.resume_data.additionalExperience.length > 0 && (
                  <Section title="Additional Experience" icon={<Briefcase color="#94a3b8" size={18} />}>
                    <View className="bg-slate-800 rounded-xl p-4">
                      <TailoredWorkHistory experience={tailoredProfile.resume_data.additionalExperience} />
                    </View>
                  </Section>
                )}

                {/* Ventures */}
                {tailoredProfile.resume_data.ventures && tailoredProfile.resume_data.ventures.length > 0 && (
                  <Section title="Ventures & Projects" icon={<Rocket color="#f59e0b" size={18} />}>
                    <View className="bg-slate-800 rounded-xl p-4">
                      <TailoredVentures ventures={tailoredProfile.resume_data.ventures} />
                    </View>
                  </Section>
                )}

                {/* Tailored Skills */}
                {tailoredProfile.resume_data.skills && tailoredProfile.resume_data.skills.length > 0 && (
                  <Section title="Skills" icon={<Sparkles color="#14b8a6" size={18} />}>
                    <TailoredSkills skills={tailoredProfile.resume_data.skills} />
                  </Section>
                )}

                {/* Education */}
                {tailoredProfile.resume_data.education && tailoredProfile.resume_data.education.length > 0 && (
                  <Section title="Education" icon={<GraduationCap color="#14b8a6" size={18} />}>
                    <View className="bg-slate-800 rounded-xl p-4">
                      <TailoredEducation education={tailoredProfile.resume_data.education} />
                    </View>
                  </Section>
                )}

                {/* Narrative / Cover Letter */}
                {tailoredProfile.narrative && (
                  <Section title="Cover Letter Narrative" icon={<FileText color="#14b8a6" size={18} />}>
                    <View className="bg-slate-800 rounded-xl p-4">
                      <Text className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {tailoredProfile.narrative}
                      </Text>
                    </View>
                  </Section>
                )}
              </>
            ) : (
              <View className="bg-slate-800/50 rounded-xl p-6 items-center">
                <View className="h-16 w-16 rounded-full bg-slate-700 items-center justify-center mb-4">
                  <Sparkles color="#64748b" size={28} />
                </View>
                <Text className="text-lg font-bold text-white mb-2 text-center">No Tailored Profile Yet</Text>
                <Text className="text-slate-400 text-center text-sm mb-4">
                  Generate an AI-tailored resume optimized for this opportunity.
                </Text>
                <Pressable
                  onPress={handleGenerateProfile}
                  disabled={generateProfile.isPending}
                  className={`py-3 px-6 rounded-xl flex-row items-center justify-center ${
                    generateProfile.isPending ? 'bg-teal-800' : 'bg-teal-600 active:bg-teal-700'
                  }`}
                >
                  {generateProfile.isPending ? (
                    <>
                      <ActivityIndicator color="white" size="small" />
                      <Text className="text-white font-bold ml-2">Generating...</Text>
                    </>
                  ) : (
                    <>
                      <Sparkles color="white" size={18} />
                      <Text className="text-white font-bold ml-2">Generate Tailored Profile</Text>
                    </>
                  )}
                </Pressable>
                {generateProfile.isError && (
                  <Text className="text-red-400 text-sm mt-3 text-center">
                    {generateProfile.error?.message || 'Failed to generate profile'}
                  </Text>
                )}
              </View>
            )}
          </View>
        ) : (
          <View className="px-4">
            {/* Requirements Section */}
            {reqs && (reqs.mustHave?.length || reqs.niceToHave?.length) ? (
              <Section title="Requirements" icon={<CheckCircle2 color="#14b8a6" size={18} />}>
                <View className="bg-slate-800 rounded-xl p-4">
                  <RequirementsList items={reqs.mustHave || []} label="Must Have" />
                  <RequirementsList items={reqs.niceToHave || []} label="Nice to Have" />
                </View>
              </Section>
            ) : null}

            {/* Company Research Section */}
            {opportunity.company_role_context && (
              <Section title="Strategic Role Intent" icon={<Lightbulb color="#f59e0b" size={18} />}>
                <View className="bg-amber-900/30 rounded-xl p-4 border border-amber-800/50">
                  <Text className="text-sm text-amber-200 italic leading-relaxed">
                    "{opportunity.company_role_context}"
                  </Text>
                </View>
              </Section>
            )}

            {Array.isArray(opportunity.company_recent_news) && opportunity.company_recent_news.length > 0 && (
              <Section title="Market Intelligence" icon={<Newspaper color="#3b82f6" size={18} />}>
                <View className="bg-slate-800 rounded-xl p-4">
                  <BulletList items={opportunity.company_recent_news} color="bg-blue-500" />
                </View>
              </Section>
            )}

            {Array.isArray(opportunity.company_challenges) && opportunity.company_challenges.length > 0 && (
              <Section title="Likely Challenges" icon={<TrendingUp color="#22c55e" size={18} />}>
                <View className="bg-slate-800 rounded-xl p-4">
                  <BulletList items={opportunity.company_challenges} color="bg-green-500" />
                </View>
              </Section>
            )}

            {/* Job Description */}
            {(opportunity.description_html || opportunity.description) && (
              <Section title="Job Description" icon={<FileText color="#94a3b8" size={18} />}>
                <View className="bg-slate-800 rounded-xl p-4">
                  {opportunity.description_html ? (
                    <RenderHtml
                      contentWidth={width - 64}
                      source={{ html: opportunity.description_html }}
                      tagsStyles={htmlStyles}
                      ignoredDomTags={['button', 'script', 'style', 'iframe']}
                    />
                  ) : (
                    <Text className="text-sm text-slate-300 leading-relaxed">{opportunity.description}</Text>
                  )}
                </View>
              </Section>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
