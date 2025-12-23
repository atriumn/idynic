import { View, Text, Pressable } from 'react-native';
import { useAuth } from '../../lib/auth-context';

export default function SettingsScreen() {
  const { signOut, user } = useAuth();

  return (
    <View className="flex-1 bg-slate-900 p-4">
      <Text className="text-2xl font-bold text-white mb-4">Settings</Text>

      <Text className="text-slate-400 mb-6">{user?.email}</Text>

      <Pressable
        onPress={signOut}
        className="bg-red-600 py-3 px-4 rounded-lg"
      >
        <Text className="text-white text-center font-semibold">Sign Out</Text>
      </Pressable>
    </View>
  );
}
