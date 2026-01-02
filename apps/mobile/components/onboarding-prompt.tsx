import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { X, ArrowRight } from "lucide-react-native";
import {
  useOnboardingProgress,
  type OnboardingPromptKey,
  type OnboardingPrompt as OnboardingPromptType,
} from "@idynic/shared";
import { mobileStorageAdapter } from "../lib/storage-adapter";

interface OnboardingPromptProps {
  /** The prompt key to display */
  promptKey: OnboardingPromptKey;
  /** Handler for in-context actions like "generate_tailored_profile" */
  onAction?: (action: string) => void;
  /** Called when the prompt is dismissed (optional) */
  onDismiss?: () => void;
}

/**
 * Onboarding prompt component for mobile that shows contextual next-step guidance.
 *
 * Displays a fixed bottom toast-like prompt above the tab bar with NativeWind styling.
 * Prompts persist until dismissed and won't reappear after dismissal.
 *
 * @example
 * ```tsx
 * // After resume upload success
 * <OnboardingPrompt promptKey="after_resume_upload" />
 *
 * // With action handler for in-context actions
 * <OnboardingPrompt
 *   promptKey="after_opportunity_added"
 *   onAction={(action) => {
 *     if (action === "generate_tailored_profile") {
 *       generateProfile();
 *     }
 *   }}
 * />
 * ```
 */
export function OnboardingPrompt({
  promptKey,
  onAction,
  onDismiss,
}: OnboardingPromptProps) {
  const router = useRouter();
  const { getPrompt, dismissPrompt, isLoading } = useOnboardingProgress(
    mobileStorageAdapter
  );

  const rawPrompt = getPrompt(promptKey);

  if (isLoading || !rawPrompt) return null;

  // Cast to the interface type to allow optional property access
  const prompt = rawPrompt as OnboardingPromptType;

  const handleDismiss = () => {
    dismissPrompt(promptKey);
    onDismiss?.();
  };

  const handlePrimaryPress = () => {
    if (prompt.primaryAction.action) {
      onAction?.(prompt.primaryAction.action);
    } else if (prompt.primaryAction.route) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(prompt.primaryAction.route as any);
    }
    dismissPrompt(promptKey);
  };

  const handleSecondaryPress = () => {
    if (prompt.secondaryAction?.action) {
      onAction?.(prompt.secondaryAction.action);
    } else if (prompt.secondaryAction?.route) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(prompt.secondaryAction.route as any);
    }
    dismissPrompt(promptKey);
  };

  return (
    <View className="absolute bottom-20 left-4 right-4 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg">
      {/* Dismiss button */}
      <Pressable
        onPress={handleDismiss}
        className="absolute top-2 right-2 p-2 rounded-lg active:bg-slate-700"
        accessibilityLabel="Dismiss"
        accessibilityRole="button"
      >
        <X color="#94a3b8" size={18} />
      </Pressable>

      {/* Title */}
      <Text className="text-white font-semibold text-base mb-1 pr-8">
        {prompt.title}
      </Text>

      {/* Message */}
      <Text className="text-slate-400 text-sm mb-4">{prompt.message}</Text>

      {/* Action buttons */}
      <View className="flex-row gap-3">
        <Pressable
          onPress={handlePrimaryPress}
          className="flex-1 bg-teal-600 py-3 px-4 rounded-xl flex-row items-center justify-center active:bg-teal-700"
        >
          <Text className="text-white font-bold text-sm">
            {prompt.primaryAction.label}
          </Text>
          <ArrowRight color="white" size={16} style={{ marginLeft: 6 }} />
        </Pressable>

        {prompt.secondaryAction && (
          <Pressable
            onPress={handleSecondaryPress}
            className="flex-1 bg-slate-700 py-3 px-4 rounded-xl items-center justify-center active:bg-slate-600"
          >
            <Text className="text-white font-bold text-sm">
              {prompt.secondaryAction.label}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
