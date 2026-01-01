import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { ResumeUpload } from "../../components/resume-upload";
import { OnboardingPrompt } from "../../components/onboarding-prompt";

export default function UploadResumeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPrompt, setShowPrompt] = useState(false);

  const handleComplete = () => {
    // Invalidate identity claims and profile to refresh the data
    queryClient.invalidateQueries({ queryKey: ["identity-claims"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });

    // Show onboarding prompt instead of auto-navigating
    setShowPrompt(true);
  };

  const handlePromptDismiss = () => {
    // Navigate back to home when prompt is dismissed
    router.replace("/(app)");
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-900" edges={["bottom"]}>
      <View className="flex-1">
        <ResumeUpload onComplete={handleComplete} />
        {showPrompt && (
          <OnboardingPrompt
            promptKey="after_resume_upload"
            onDismiss={handlePromptDismiss}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
