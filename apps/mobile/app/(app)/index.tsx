import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-slate-900 p-4">
      <Text className="text-2xl font-bold text-white">Welcome back</Text>
      <Text className="text-slate-400 mt-2">Your career dashboard</Text>
    </View>
  );
}
