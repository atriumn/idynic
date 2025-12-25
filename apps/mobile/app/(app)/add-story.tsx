import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { StoryInput } from "../../components/story-input";

export default function AddStoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleComplete = () => {
    // Invalidate identity claims to refresh the data
    queryClient.invalidateQueries({ queryKey: ["identity-claims"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });

    // Go back after a short delay to show the completion state
    setTimeout(() => {
      router.back();
    }, 1500);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-900" edges={["bottom"]}>
      <StoryInput onComplete={handleComplete} />
    </SafeAreaView>
  );
}
