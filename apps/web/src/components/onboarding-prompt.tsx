"use client";

import { useRouter } from "next/navigation";
import { X, ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  useOnboardingProgress,
  type OnboardingPromptKey,
  type OnboardingPrompt as OnboardingPromptType,
} from "@idynic/shared";
import { webStorageAdapter } from "@/lib/storage-adapter";

interface OnboardingPromptProps {
  /** The prompt key to display */
  promptKey: OnboardingPromptKey;
  /** Handler for in-context actions like "generate_tailored_profile" */
  onAction?: (action: string) => void;
  /** Called when the prompt is dismissed (optional) */
  onDismiss?: () => void;
}

/**
 * Onboarding prompt component that shows contextual next-step guidance.
 *
 * Displays a fixed bottom-right toast-like prompt with slide-in animation.
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
  const { getPrompt, dismissPrompt, isLoading } =
    useOnboardingProgress(webStorageAdapter);

  const rawPrompt = getPrompt(promptKey);

  if (isLoading || !rawPrompt) return null;

  // Cast to the interface type to allow optional property access
  const prompt = rawPrompt as OnboardingPromptType;

  const handleDismiss = () => {
    dismissPrompt(promptKey);
    onDismiss?.();
  };

  const handlePrimaryClick = () => {
    if (prompt.primaryAction.action) {
      onAction?.(prompt.primaryAction.action);
    } else if (prompt.primaryAction.webRoute || prompt.primaryAction.route) {
      router.push(prompt.primaryAction.webRoute || prompt.primaryAction.route!);
    }
    dismissPrompt(promptKey);
  };

  const handleSecondaryClick = () => {
    if (prompt.secondaryAction?.action) {
      onAction?.(prompt.secondaryAction.action);
    } else if (
      prompt.secondaryAction?.webRoute ||
      prompt.secondaryAction?.route
    ) {
      router.push(
        prompt.secondaryAction.webRoute || prompt.secondaryAction.route!,
      );
    }
    dismissPrompt(promptKey);
  };

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-card border border-border rounded-xl shadow-lg p-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <h3 className="font-semibold text-foreground mb-1 pr-6">
        {prompt.title}
      </h3>
      <p className="text-sm text-muted-foreground mb-3">{prompt.message}</p>

      <div className="flex gap-2">
        <Button size="sm" onClick={handlePrimaryClick}>
          {prompt.primaryAction.label}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
        {prompt.secondaryAction && (
          <Button size="sm" variant="outline" onClick={handleSecondaryClick}>
            {prompt.secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
