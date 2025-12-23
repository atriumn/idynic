import { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfile } from '../../hooks/use-profile';

const INITIAL_SKILLS_COUNT = 10;

export default function ProfileScreen() {
  const { data: profile, isLoading, error } = useProfile();
  const [showAllSkills, setShowAllSkills] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center" edges={['bottom']}>
        <ActivityIndicator color="#14b8a6" size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 p-4" edges={['bottom']}>
        <Text className="text-red-500">Failed to load profile</Text>
        <Text className="text-slate-400 mt-2 text-sm">{error.message}</Text>
      </SafeAreaView>
    );
  }

  const displayedSkills = showAllSkills
    ? profile?.skills
    : profile?.skills?.slice(0, INITIAL_SKILLS_COUNT);
  const hasMoreSkills = (profile?.skills?.length || 0) > INITIAL_SKILLS_COUNT;

  return (
    <ScrollView className="flex-1 bg-slate-900">
      <View className="p-4">
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

        {/* Ventures */}
        {profile?.ventures && profile.ventures.length > 0 && (
          <View className="mt-6">
            <Text className="text-slate-400 text-sm uppercase mb-3">Ventures</Text>
            {profile.ventures.map((venture) => (
              <View key={venture.id} className="mb-4 bg-slate-800 p-4 rounded-lg">
                <Text className="text-white font-semibold">{venture.title}</Text>
                <Text className="text-teal-400">{venture.company}</Text>
                {venture.summary && (
                  <Text className="text-slate-300 mt-2 text-sm">{venture.summary}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {profile?.education && profile.education.length > 0 && (
          <View className="mt-6">
            <Text className="text-slate-400 text-sm uppercase mb-3">Education</Text>
            {profile.education.map((edu) => {
              const contextStr = typeof edu.context === 'string' ? edu.context : null;
              return (
                <View key={edu.id} className="mb-4 bg-slate-800 p-4 rounded-lg">
                  <Text className="text-white">{edu.text}</Text>
                  {contextStr && (
                    <Text className="text-slate-400 text-sm mt-1">{contextStr}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Skills */}
        {profile?.skills && profile.skills.length > 0 && (
          <View className="mt-6 mb-8">
            <Text className="text-slate-400 text-sm uppercase mb-3">
              Skills ({profile.skills.length})
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {displayedSkills?.map((skill) => (
                <View key={skill.id} className="bg-teal-900/50 px-3 py-1 rounded-full">
                  <Text className="text-teal-300 text-sm">{skill.label}</Text>
                </View>
              ))}
            </View>
            {hasMoreSkills && (
              <Pressable
                onPress={() => setShowAllSkills(!showAllSkills)}
                className="mt-3"
              >
                <Text className="text-teal-400 text-sm">
                  {showAllSkills
                    ? 'Show less'
                    : `Show ${profile.skills.length - INITIAL_SKILLS_COUNT} more`}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
