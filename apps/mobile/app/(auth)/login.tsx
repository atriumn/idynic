import { View, Text, Pressable } from 'react-native';

export default function LoginScreen() {
  const handleGoogleLogin = async () => {
    // TODO: Implement OAuth with expo-auth-session
  };

  const handleMagicLink = async () => {
    // TODO: Implement magic link
  };

  return (
    <View className="flex-1 bg-slate-900 justify-center items-center px-6">
      <Text className="text-3xl font-bold text-white mb-2">idynic</Text>
      <Text className="text-slate-400 mb-8">Your smart career companion</Text>

      <Pressable
        onPress={handleGoogleLogin}
        className="bg-white w-full py-4 rounded-lg mb-4"
      >
        <Text className="text-slate-900 text-center font-semibold">
          Continue with Google
        </Text>
      </Pressable>

      <Pressable
        onPress={handleMagicLink}
        className="bg-teal-600 w-full py-4 rounded-lg"
      >
        <Text className="text-white text-center font-semibold">
          Continue with Email
        </Text>
      </Pressable>
    </View>
  );
}
