import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useProfile } from '../../../hooks/use-profile';

export default function ProfileScreen() {
  const { data: profile, isLoading, error } = useProfile();

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
        <Text className="text-red-500">Failed to load profile</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-900 p-4">
      <Text className="text-2xl font-bold text-white">
        {profile?.full_name || 'Your Profile'}
      </Text>

      {profile?.headline && (
        <Text className="text-teal-400 mt-1">{profile.headline}</Text>
      )}

      {profile?.summary && (
        <View className="mt-6">
          <Text className="text-slate-400 text-sm uppercase mb-2">Summary</Text>
          <Text className="text-white">{profile.summary}</Text>
        </View>
      )}
    </ScrollView>
  );
}
