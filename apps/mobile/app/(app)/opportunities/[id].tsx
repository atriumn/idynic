import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
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
  Cuboid,
  Target,
} from "lucide-react-native";
import {
  useOpportunity,
  useTailoredProfile,
  useGenerateTailoredProfile,
  ResumeData,
  ResumeExperience,
  SkillCategory,
} from "../../../hooks/use-opportunity";
import { getRequirements } from "../../../hooks/use-opportunities";
import { useCreateSharedLink } from "../../../hooks/use-shared-links";
import { OnboardingPrompt } from "../../../components/onboarding-prompt";

/**
 * Render markdown bold (**text**) as styled Text elements
 */
function renderMarkdownBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}

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

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
): string | null {
  if (!min && !max) return null;
  const curr = currency || "$";
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  });
  if (min && max) {
    return `${curr}${formatter.format(min)} - ${curr}${formatter.format(max)}`;
  }
  if (min) return `${curr}${formatter.format(min)}+`;
  if (max) return `Up to ${curr}${formatter.format(max)}`;
  return null;
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-6">
      <View className="flex-row items-center gap-2 mb-3">
        {icon}
        <Text className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function RequirementsList({
  items,
  label,
  requirementMatches = [],
}: {
  items: string[];
  label: string;
  requirementMatches?: any[];
}) {
  if (!items || items.length === 0) return null;

  return (
    <View className="mb-4 last:mb-0">
      <Text className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">
        {label}
      </Text>
      {items.map((item, index) => {
        const match = requirementMatches.find(
          (rm) => rm.requirement.text === item,
        );
        return (
          <View key={index} className="mb-3">
            <View className="flex-row items-start gap-2.5">
              {match?.bestMatch ? (
                <CheckCircle2 color="#4ade80" size={14} />
              ) : (
                <View className="h-1.5 w-1.5 rounded-full bg-slate-600 mt-2" />
              )}
              <Text className="text-sm text-slate-300 flex-1 leading-relaxed">
                {item}
              </Text>
            </View>
            {match?.bestMatch && (
              <View className="ml-6 mt-1 flex-row items-center gap-1.5">
                <View className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 flex-row items-center gap-1">
                  <Cuboid size={10} color="#3b82f6" />
                  <Text className="text-[9px] font-bold text-blue-400 uppercase tracking-tight">
                    {match.bestMatch.label}
                  </Text>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function BulletList({ items, color }: { items: unknown; color: string }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <View>
      {items.map((item, index) => (
        <View key={index} className="flex-row items-start gap-2.5 mb-2.5">
          <View className={`h-1 w-1 rounded-full mt-2 ${color}`} />
          <Text className="text-sm text-slate-300 flex-1 leading-relaxed">
            {String(item)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TailoredWorkHistory({
  experience,
  isStrength = false,
}: {
  experience: ResumeExperience[];
  isStrength?: boolean;
}) {
  if (!experience || experience.length === 0) return null;

  // Helper to get logo URL from domain
  const getCompanyLogoUrl = (
    domain: string | null | undefined,
  ): string | null => {
    if (!domain) return null;
    const cleanDomain = domain.replace(/^www\./, "");
    return `https://img.logo.dev/${cleanDomain}?token=pk_b3U88G0OTNKjNTpAlTU_OQ&retina=true`;
  };

  return (
    <View>
      {experience.map((job, index) => (
        <View
          key={index}
          className="mb-4 last:mb-0 rounded-xl border border-white/5 bg-black/20 overflow-hidden flex-row"
        >
          {isStrength && <View className="w-1.5 bg-green-500 shrink-0" />}
          <View className="p-4 flex-1">
            <View className="flex-row items-start gap-3 mb-1.5">
              {getCompanyLogoUrl(job.companyDomain) ? (
                <View className="h-10 w-10 rounded-lg bg-white items-center justify-center overflow-hidden shrink-0">
                  <Image
                    source={{ uri: getCompanyLogoUrl(job.companyDomain)! }}
                    className="h-8 w-8"
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <View className="h-10 w-10 rounded-lg bg-slate-700 items-center justify-center shrink-0">
                  <Building2 color="#94a3b8" size={20} />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-base font-bold text-white tracking-tight">
                  {job.title}
                </Text>
                <Text className="text-teal-400 text-xs font-bold">
                  {job.company}
                </Text>
              </View>
            </View>

            {job.bullets && job.bullets.length > 0 && (
              <View className="space-y-2">
                {job.bullets.map((bullet, i) => (
                  <View key={i} className="flex-row items-start gap-2.5">
                    <View className="h-1 w-1 rounded-full bg-slate-700 mt-2" />
                    <Text className="text-sm text-slate-300 flex-1 leading-relaxed">
                      {renderMarkdownBold(bullet)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function TailoredEducation({
  education,
}: {
  education: ResumeData["education"];
}) {
  if (!education || education.length === 0) return null;

  return (
    <View>
      {education.map((edu, index) => (
        <View
          key={index}
          className="mb-3 last:mb-0 flex-row justify-between bg-black/20 border border-white/5 rounded-xl p-4"
        >
          <View className="flex-1">
            <Text className="text-white font-bold">{edu.degree}</Text>
            <Text className="text-teal-400 text-xs font-bold mt-1">
              {edu.institution}
            </Text>
          </View>
          {edu.year && (
            <Text className="text-slate-500 text-xs font-mono">{edu.year}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function TailoredSkills({ skills }: { skills: SkillCategory[] | string[] }) {
  if (!skills || skills.length === 0) return null;

  if (typeof skills[0] === "string") {
    return (
      <View className="flex-row flex-wrap gap-2">
        {(skills as string[]).map((skill, index) => (
          <View
            key={index}
            className="bg-slate-800 border border-white/5 px-3 py-1.5 rounded-lg"
          >
            <Text className="text-slate-300 text-sm font-medium">{skill}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="gap-4">
      {(skills as SkillCategory[]).map((category, catIndex) => (
        <View key={catIndex}>
          <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">
            {category.category}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {category.skills.map((skill, index) => (
              <View
                key={index}
                className={`px-3 py-1.5 rounded-lg border ${
                  catIndex === 0 && index < 3
                    ? "bg-teal-500/10 border-teal-500/20"
                    : "bg-slate-800 border-white/5"
                }`}
              >
                <Text
                  className={`text-sm ${
                    catIndex === 0 && index < 3
                      ? "text-teal-400 font-bold"
                      : "text-slate-300 font-medium"
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
  // Simple hooks - no try-catch wrapping
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"tailored" | "research">(
    "research",
  );
  const [shareCopied, setShareCopied] = useState(false);
  const [showOpportunityAddedPrompt, setShowOpportunityAddedPrompt] =
    useState(false);
  const [showProfileTailoredPrompt, setShowProfileTailoredPrompt] =
    useState(false);

  const hasShownOpportunityPrompt = useRef(false);
  const hadTailoredProfile = useRef<boolean | null>(null);

  const { data: opportunity, isLoading, error } = useOpportunity(id || "");
  const { data: tailoredProfile, isLoading: tailoredLoading } =
    useTailoredProfile(id || "");
  const generateProfile = useGenerateTailoredProfile(id || "");
  const createSharedLink = useCreateSharedLink();

  useEffect(() => {
    if (
      !isLoading &&
      !tailoredLoading &&
      opportunity &&
      !tailoredProfile &&
      !hasShownOpportunityPrompt.current
    ) {
      hasShownOpportunityPrompt.current = true;
      setShowOpportunityAddedPrompt(true);
    }
  }, [isLoading, tailoredLoading, opportunity, tailoredProfile]);

  useEffect(() => {
    if (hadTailoredProfile.current === false && tailoredProfile?.resume_data) {
      setShowProfileTailoredPrompt(true);
    }
    if (!tailoredLoading) {
      hadTailoredProfile.current = !!tailoredProfile?.resume_data;
    }
  }, [tailoredProfile, tailoredLoading]);

  const handleGenerateProfile = () => {
    generateProfile.mutate({});
  };

  const handleOpportunityAddedAction = (action: string) => {
    if (action === "generate_tailored_profile") {
      handleGenerateProfile();
    }
  };

  const handleProfileTailoredAction = (action: string) => {
    if (action === "share_profile") {
      handleShare();
    } else if (action === "download_pdf") {
      handleShare();
    }
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
      console.error("Failed to create/copy share link:", err);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView
        className="flex-1 bg-slate-950 justify-center items-center"
        edges={["top", "bottom"]}
      >
        <ActivityIndicator color="#14b8a6" size="large" />
      </SafeAreaView>
    );
  }

  if (error || !opportunity) {
    return (
      <SafeAreaView
        className="flex-1 bg-slate-950 p-4"
        edges={["top", "bottom"]}
      >
        <Pressable
          onPress={() => router.push("/opportunities")}
          className="flex-row items-center mb-4"
        >
          <ArrowLeft color="#94a3b8" size={20} />
          <Text className="text-slate-400 ml-2 font-bold uppercase tracking-tight text-xs">
            Back
          </Text>
        </Pressable>
        <Text className="text-red-500 font-bold">Failed to load target</Text>
        <Text className="text-slate-400 mt-2 text-sm">
          {error?.message || "Target not found"}
        </Text>
      </SafeAreaView>
    );
  }

  const status = opportunity.status || "tracking";
  const colors = STATUS_COLORS[status] || STATUS_COLORS.tracking;
  const salaryStr = formatSalary(
    opportunity.salary_min,
    opportunity.salary_max,
    opportunity.salary_currency,
  );
  const reqs = getRequirements(opportunity.requirements);

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top", "bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <View className="px-4 pt-2">
          <Pressable
            onPress={() => router.push("/opportunities")}
            className="flex-row items-center mb-4 py-2"
          >
            <ArrowLeft color="#94a3b8" size={20} />
            <Text className="text-slate-500 ml-2 font-black uppercase tracking-widest text-[10px]">
              Back to Targets
            </Text>
          </Pressable>

          <View className="flex-row items-start justify-between mb-4">
            <View className="h-16 w-16 rounded-2xl bg-white items-center justify-center overflow-hidden border-2 border-slate-800">
              {opportunity.company_logo_url ||
              getLogoUrl(opportunity.company_url) ? (
                <Image
                  source={{
                    uri:
                      opportunity.company_logo_url ||
                      getLogoUrl(opportunity.company_url)!,
                  }}
                  className="h-14 w-14"
                  resizeMode="contain"
                />
              ) : (
                <Building2 color="#94a3b8" size={32} />
              )}
            </View>
            <View
              className={`px-3 py-1.5 rounded-lg border ${colors.bg} border-white/5`}
            >
              <Text
                className={`text-[10px] font-black uppercase tracking-widest ${colors.text}`}
              >
                {status}
              </Text>
            </View>
          </View>

          <Text className="text-3xl font-black text-white mb-2 tracking-tight leading-tight">
            {opportunity.title || "Untitled Target"}
          </Text>
          <View className="flex-row items-center gap-2 mb-6">
            <View className="bg-slate-800 px-2 py-0.5 rounded">
              <Text className="text-base font-bold text-teal-400 tracking-tight">
                {opportunity.company || "Direct Hire"}
              </Text>
            </View>
            {opportunity.company_url && (
              <Pressable
                onPress={() => Linking.openURL(opportunity.company_url!)}
              >
                <Globe color="#475569" size={18} />
              </Pressable>
            )}
          </View>

          <View className="flex-row flex-wrap gap-2 mb-8">
            {opportunity.location && (
              <View className="flex-row items-center bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
                <MapPin color="#64748b" size={14} />
                <Text className="text-xs font-bold text-slate-400 ml-1.5">
                  {opportunity.location}
                </Text>
              </View>
            )}
            {opportunity.employment_type && (
              <View className="flex-row items-center bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
                <Briefcase color="#64748b" size={14} />
                <Text className="text-xs font-bold text-slate-400 ml-1.5">
                  {opportunity.employment_type}
                </Text>
              </View>
            )}
            {salaryStr && (
              <View className="flex-row items-center bg-green-900/20 px-3 py-1.5 rounded-lg border border-green-500/20">
                <DollarSign color="#4ade80" size={14} />
                <Text className="text-xs font-bold text-green-400 ml-1">
                  {salaryStr}
                </Text>
              </View>
            )}
          </View>

          <View className="flex-row gap-3 mb-8">
            {opportunity.url && (
              <Pressable
                onPress={() => Linking.openURL(opportunity.url!)}
                className="py-4 px-4 rounded-2xl flex-1 flex-row items-center justify-center bg-teal-600 shadow-lg shadow-teal-900/20"
              >
                <ExternalLink color="white" size={18} />
                <Text className="text-white font-black uppercase tracking-tighter ml-2">
                  View Posting
                </Text>
              </Pressable>
            )}

            {tailoredProfile?.id && (
              <Pressable
                onPress={handleShare}
                disabled={createSharedLink.isPending}
                className={`py-4 px-4 rounded-2xl flex-row items-center justify-center ${
                  shareCopied
                    ? "bg-green-600"
                    : "bg-slate-800 border border-slate-700"
                }`}
              >
                {shareCopied ? (
                  <Check color="white" size={18} />
                ) : (
                  <Share2 color="white" size={18} />
                )}
                <Text className="text-white font-bold ml-2">
                  {shareCopied ? "Copied" : "Share"}
                </Text>
              </Pressable>
            )}
          </View>

          <View className="flex-row bg-slate-900 border border-white/5 rounded-2xl p-1.5 mb-8 h-14">
            <Pressable
              onPress={() => setActiveTab("research")}
              className={`flex-1 items-center justify-center rounded-xl ${activeTab === "research" ? "bg-slate-800" : ""}`}
            >
              <Text
                className={`text-[10px] font-black uppercase tracking-[0.15em] ${activeTab === "research" ? "text-white" : "text-slate-500"}`}
              >
                Research
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("tailored")}
              className={`flex-1 items-center justify-center rounded-xl ${activeTab === "tailored" ? "bg-slate-800" : ""}`}
            >
              <Text
                className={`text-[10px] font-black uppercase tracking-[0.15em] ${activeTab === "tailored" ? "text-white" : "text-slate-500"}`}
              >
                Tailored Profile
              </Text>
            </Pressable>
          </View>
        </View>

        {activeTab === "tailored" ? (
          <View className="px-4">
            {tailoredLoading ? (
              <View className="py-12 items-center">
                <ActivityIndicator color="#14b8a6" size="large" />
              </View>
            ) : tailoredProfile && tailoredProfile.resume_data ? (
              <>
                {tailoredProfile.resume_data.summary && (
                  <Section
                    title="Professional Summary"
                    icon={<User color="#14b8a6" size={18} />}
                  >
                    <View className="bg-slate-900 border border-white/5 rounded-2xl p-5 shadow-inner">
                      <Text className="text-sm text-slate-300 leading-relaxed">
                        {tailoredProfile.resume_data.summary}
                      </Text>
                    </View>
                  </Section>
                )}

                {tailoredProfile.resume_data.experience &&
                  tailoredProfile.resume_data.experience.length > 0 && (
                    <Section
                      title="Experience"
                      icon={<Cuboid color="#4ade80" size={18} />}
                    >
                      <TailoredWorkHistory
                        experience={tailoredProfile.resume_data.experience}
                        isStrength={true}
                      />
                    </Section>
                  )}

                {tailoredProfile.resume_data.additionalExperience &&
                  tailoredProfile.resume_data.additionalExperience.length >
                    0 && (
                    <Section
                      title="Additional Experience"
                      icon={<Briefcase color="#64748b" size={18} />}
                    >
                      <TailoredWorkHistory
                        experience={
                          tailoredProfile.resume_data.additionalExperience
                        }
                        isStrength={false}
                      />
                    </Section>
                  )}

                {tailoredProfile.resume_data.skills &&
                  tailoredProfile.resume_data.skills.length > 0 && (
                    <Section
                      title="Skills"
                      icon={<Sparkles color="#14b8a6" size={18} />}
                    >
                      <TailoredSkills
                        skills={tailoredProfile.resume_data.skills}
                      />
                    </Section>
                  )}

                {tailoredProfile.resume_data.education &&
                  tailoredProfile.resume_data.education.length > 0 && (
                    <Section
                      title="Education"
                      icon={<GraduationCap color="#14b8a6" size={18} />}
                    >
                      <TailoredEducation
                        education={tailoredProfile.resume_data.education}
                      />
                    </Section>
                  )}

                {tailoredProfile.narrative && (
                  <Section
                    title="Narrative"
                    icon={<FileText color="#14b8a6" size={18} />}
                  >
                    <View className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                      <Text className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                        {tailoredProfile.narrative}
                      </Text>
                    </View>
                  </Section>
                )}
              </>
            ) : (
              <View className="bg-slate-900 border border-white/10 border-dashed rounded-3xl p-10 items-center">
                <View className="h-20 w-20 rounded-2xl bg-teal-500/10 items-center justify-center mb-6 border border-teal-500/20">
                  <Sparkles color="#14b8a6" size={40} />
                </View>
                <Text className="text-2xl font-black text-white mb-3 text-center tracking-tight">
                  Ready to Assemble?
                </Text>
                <Text className="text-slate-400 text-center text-sm mb-8 px-4 leading-relaxed font-medium">
                  Tailor your Evidence Blocks and generate a high-signal
                  application for this target.
                </Text>
                <Pressable
                  onPress={handleGenerateProfile}
                  disabled={generateProfile.isPending}
                  className={`py-4 px-10 rounded-2xl flex-row items-center justify-center shadow-xl ${
                    generateProfile.isPending
                      ? "bg-teal-800"
                      : "bg-teal-600 active:bg-teal-700 shadow-teal-900/30"
                  }`}
                >
                  {generateProfile.isPending ? (
                    <>
                      <ActivityIndicator color="white" size="small" />
                      <Text className="text-white font-black uppercase tracking-widest ml-3">
                        Assembling...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Rocket color="white" size={20} />
                      <Text className="text-white font-black uppercase tracking-widest ml-3">
                        Assemble now
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View className="px-4">
            {reqs && (reqs.mustHave?.length || reqs.niceToHave?.length) ? (
              <Section
                title="System Alignment"
                icon={<Target color="#14b8a6" size={18} />}
              >
                <View className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                  <RequirementsList
                    items={reqs.mustHave || []}
                    label="Priority Requirements"
                  />
                  <View className="h-px bg-white/5 my-4" />
                  <RequirementsList
                    items={reqs.niceToHave || []}
                    label="Bonus Signals"
                  />
                </View>
              </Section>
            ) : null}

            {opportunity.company_role_context && (
              <Section
                title="Strategic Role Intent"
                icon={<Lightbulb color="#f59e0b" size={18} />}
              >
                <View className="bg-amber-900/20 rounded-2xl p-5 border border-amber-500/20">
                  <Text className="text-sm text-amber-200 italic leading-relaxed font-medium">
                    "{opportunity.company_role_context}"
                  </Text>
                </View>
              </Section>
            )}

            {Array.isArray(opportunity.company_recent_news) &&
              opportunity.company_recent_news.length > 0 && (
                <Section
                  title="Market Intelligence"
                  icon={<Newspaper color="#3b82f6" size={18} />}
                >
                  <View className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                    <BulletList
                      items={opportunity.company_recent_news}
                      color="bg-blue-500"
                    />
                  </View>
                </Section>
              )}

            {Array.isArray(opportunity.company_challenges) &&
              opportunity.company_challenges.length > 0 && (
                <Section
                  title="Likely Challenges"
                  icon={<TrendingUp color="#22c55e" size={18} />}
                >
                  <View className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                    <BulletList
                      items={opportunity.company_challenges}
                      color="bg-green-500"
                    />
                  </View>
                </Section>
              )}

            {(opportunity.description_html || opportunity.description) && (
              <Section
                title="Original Posting"
                icon={<FileText color="#94a3b8" size={18} />}
              >
                <View className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                  {/* DEBUG: Temporarily disabled RenderHtml to test if it's the cause */}
                  <Text className="text-sm text-slate-400 leading-relaxed font-medium">
                    {opportunity.description || "No description available"}
                  </Text>
                </View>
              </Section>
            )}
          </View>
        )}
      </ScrollView>

      {showOpportunityAddedPrompt && !tailoredProfile && (
        <OnboardingPrompt
          promptKey="after_opportunity_added"
          onAction={handleOpportunityAddedAction}
          onDismiss={() => setShowOpportunityAddedPrompt(false)}
        />
      )}
      {showProfileTailoredPrompt && tailoredProfile && (
        <OnboardingPrompt
          promptKey="after_profile_tailored"
          onAction={handleProfileTailoredAction}
          onDismiss={() => setShowProfileTailoredPrompt(false)}
        />
      )}
    </SafeAreaView>
  );
}
