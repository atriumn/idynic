import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Rocket,
  User,
  Briefcase,
  CreditCard,
  ShieldCheck,
  Plug,
  HelpCircle,
  ExternalLink,
} from 'lucide-react-native';
import { HELP_DOCS } from '@idynic/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SECTION_ICONS: Record<string, React.ComponentType<any>> = {
  rocket: Rocket,
  user: User,
  briefcase: Briefcase,
  'id-card': CreditCard,
  shield: ShieldCheck,
  plug: Plug,
};

/**
 * Renders text with **bold** markdown syntax as bold Text elements
 */
function RichText({ children, style }: { children: string; style?: string }) {
  const parts = children.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text className={style}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} className="font-semibold text-slate-200">
              {part.slice(2, -2)}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

export default function HelpScreen() {
  const router = useRouter();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['getting-started'])
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedSections(next);
  };

  const toggleItem = (id: string) => {
    const next = new Set(expandedItems);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedItems(next);
  };

  const openDocs = () => {
    Linking.openURL(HELP_DOCS.docsUrl);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-900" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <Pressable onPress={() => router.back()} className="mr-3 p-1">
            <ArrowLeft color="#ffffff" size={24} />
          </Pressable>
          <View className="flex-row items-center gap-3 flex-1">
            <View className="w-10 h-10 bg-teal-500/20 rounded-lg items-center justify-center">
              <HelpCircle color="#14b8a6" size={20} />
            </View>
            <View>
              <Text className="text-xl font-bold text-white">{HELP_DOCS.title}</Text>
              <Text className="text-slate-400 text-sm">{HELP_DOCS.subtitle}</Text>
            </View>
          </View>
        </View>

        {/* Sections */}
        <View className="mb-8">
          {HELP_DOCS.sections.map((section) => {
            const Icon = SECTION_ICONS[section.icon] || HelpCircle;
            const isExpanded = expandedSections.has(section.id);
            const isIntegrations = section.id === 'integrations';

            return (
              <View key={section.id} className="mb-3 bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                <Pressable
                  onPress={() => toggleSection(section.id)}
                  className="flex-row items-center p-4"
                >
                  <Icon color="#14b8a6" size={20} />
                  <Text className="text-white font-semibold flex-1 ml-3">{section.title}</Text>
                  {isExpanded ? (
                    <ChevronDown color="#64748b" size={20} />
                  ) : (
                    <ChevronRight color="#64748b" size={20} />
                  )}
                </Pressable>

                {isExpanded && (
                  <View className="border-t border-slate-700">
                    {section.items.map((item, i) => {
                      const itemExpanded = expandedItems.has(item.id);
                      return (
                        <View
                          key={item.id}
                          className={i < section.items.length - 1 ? 'border-b border-slate-700/50' : ''}
                        >
                          <Pressable
                            onPress={() => toggleItem(item.id)}
                            className="flex-row items-center p-4 pl-12"
                          >
                            <Text className="text-slate-300 flex-1">{item.title}</Text>
                            {itemExpanded ? (
                              <ChevronDown color="#64748b" size={16} />
                            ) : (
                              <ChevronRight color="#64748b" size={16} />
                            )}
                          </Pressable>
                          {itemExpanded && (
                            <View className="px-12 pb-4">
                              <RichText style="text-slate-400 text-sm leading-relaxed">
                                {item.content}
                              </RichText>
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {/* Docs link for integrations section */}
                    {isIntegrations && (
                      <Pressable
                        onPress={openDocs}
                        className="flex-row items-center gap-2 px-12 py-4 border-t border-slate-700"
                      >
                        <Text className="text-teal-400 font-medium">View full documentation</Text>
                        <ExternalLink color="#2dd4bf" size={16} />
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* FAQ */}
        <View>
          <Text className="text-lg font-bold text-white mb-4">Frequently Asked Questions</Text>
          {HELP_DOCS.faq
            .filter((item) => !item.question.toLowerCase().includes('mobile app'))
            .map((item, i) => {
            const id = `faq-${i}`;
            const isExpanded = expandedItems.has(id);

            return (
              <View key={i} className="mb-3 bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                <Pressable
                  onPress={() => toggleItem(id)}
                  className="flex-row items-center p-4"
                >
                  <Text className="text-white flex-1 font-medium">{item.question}</Text>
                  {isExpanded ? (
                    <ChevronDown color="#64748b" size={20} />
                  ) : (
                    <ChevronRight color="#64748b" size={20} />
                  )}
                </Pressable>
                {isExpanded && (
                  <View className="px-4 pb-4">
                    <RichText style="text-slate-400 text-sm leading-relaxed">
                      {item.answer}
                    </RichText>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
