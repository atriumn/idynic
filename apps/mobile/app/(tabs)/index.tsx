import { View, Text } from 'react-native';

import EditScreenInfo from '@/components/EditScreenInfo';

export default function TabOneScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-900">
      <Text className="text-2xl font-bold text-teal-500">Tab One</Text>
      <View className="my-8 h-px w-4/5 bg-slate-700" />
      <EditScreenInfo path="app/(tabs)/index.tsx" />
    </View>
  );
}
