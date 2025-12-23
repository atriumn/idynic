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
        <Text className="text-slate-400 mt-2 text-sm">{error.message}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-900 p-4">
      {/* Contact Info */}
      <Text className="text-2xl font-bold text-white">
        {profile?.contact?.name || 'Your Profile'}
      </Text>

      {profile?.contact?.location && (
        <Text className="text-slate-400 mt-1">{profile.contact.location}</Text>
      )}

      {profile?.contact?.email && (
        <Text className="text-teal-400 mt-1">{profile.contact.email}</Text>
      )}

      {/* Work History */}
      {profile?.workHistory && profile.workHistory.length > 0 && (
        <View className="mt-6">
          <Text className="text-slate-400 text-sm uppercase mb-3">Experience</Text>
          {profile.workHistory.map((job) => (
            <View key={job.id} className="mb-4 bg-slate-800 p-4 rounded-lg">
              <Text className="text-white font-semibold">{job.title}</Text>
              <Text className="text-teal-400">{job.company}</Text>
              {job.location && (
                <Text className="text-slate-400 text-sm">{job.location}</Text>
              )}
              {job.summary && (
                <Text className="text-slate-300 mt-2 text-sm">{job.summary}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Skills */}
      {profile?.skills && profile.skills.length > 0 && (
        <View className="mt-6">
          <Text className="text-slate-400 text-sm uppercase mb-3">Skills</Text>
          <View className="flex-row flex-wrap gap-2">
            {profile.skills.slice(0, 10).map((skill) => (
              <View key={skill.id} className="bg-teal-900/50 px-3 py-1 rounded-full">
                <Text className="text-teal-300 text-sm">{skill.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
