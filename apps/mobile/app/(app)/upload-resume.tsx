import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { ResumeUpload } from "../../components/resume-upload";

export default function UploadResumeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleComplete = () => {
    // Invalidate identity claims and profile to refresh the data
    queryClient.invalidateQueries({ queryKey: ["identity-claims"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });

    // Navigate to identity tab after a short delay to show the completion state
    setTimeout(() => {
      router.replace("/(app)");
    }, 1500);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-900" edges={["bottom"]}>
      <ResumeUpload onComplete={handleComplete} />
    </SafeAreaView>
  );
}
