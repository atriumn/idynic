import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Logo } from '../../components/logo';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError(null);

    console.log('[Login] Starting auth, isSignUp:', isSignUp);
    console.log('[Login] Email:', email);

    try {
      if (isSignUp) {
        const { error: authError, data } = await supabase.auth.signUp({ email, password });

        console.log('[Login] Signup response received');
        console.log('[Login] Error:', authError?.message);
        console.log('[Login] User:', data?.user?.id);
        console.log('[Login] Confirmation sent:', data?.user?.confirmation_sent_at);

        setLoading(false);

        if (authError) {
          setError(authError.message);
        } else if (data?.user && !data.session) {
          // User created but needs email confirmation
          setPendingConfirmation(true);
        }
      } else {
        const { error: authError, data } = await supabase.auth.signInWithPassword({ email, password });

        console.log('[Login] Sign in response received');
        console.log('[Login] Error:', authError?.message);
        console.log('[Login] User:', data?.user?.id);

        setLoading(false);

        if (authError) {
          setError(authError.message);
        }
      }
    } catch (e) {
      console.log('[Login] Exception:', e);
      setLoading(false);
      setError('Network error: ' + (e as Error).message);
    }
    // Navigation happens automatically via auth state change in _layout.tsx
  };

  const handleBackToSignIn = () => {
    setPendingConfirmation(false);
    setIsSignUp(false);
    setPassword('');
  };

  // Show "check your email" screen after signup
  if (pendingConfirmation) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-slate-900"
      >
        <View className="flex-1 justify-center px-6">
          <View className="items-center mb-6">
            <Logo size={80} />
          </View>

          <Text className="text-3xl font-bold text-white mb-4 text-center">
            Check your email
          </Text>

          <Text className="text-slate-300 text-center mb-2">
            We sent a confirmation link to
          </Text>
          <Text className="text-teal-400 text-center font-semibold mb-6">
            {email}
          </Text>

          <Text className="text-slate-400 text-center mb-8">
            Click the link in your email to confirm your account, then return here to sign in.
          </Text>

          <Pressable
            onPress={handleBackToSignIn}
            className="bg-slate-700 w-full py-4 rounded-lg"
          >
            <Text className="text-white text-center font-semibold">
              Back to Sign In
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-900"
    >
      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-4">
          <Logo size={80} />
        </View>
        <Text className="text-3xl font-bold text-white mb-2 text-center">idynic</Text>
        <Text className="text-slate-400 mb-8 text-center">Your smart career companion</Text>

        {error && (
          <View className="bg-red-900/50 p-3 rounded-lg mb-4">
            <Text className="text-red-300 text-center">{error}</Text>
          </View>
        )}

        <TextInput
          className="bg-slate-800 text-white px-4 py-3 rounded-lg mb-4"
          placeholder="Email"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextInput
          className="bg-slate-800 text-white px-4 py-3 rounded-lg mb-6"
          placeholder="Password"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <Pressable
          onPress={handleAuth}
          disabled={loading}
          className="bg-teal-600 w-full py-4 rounded-lg mb-4"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-semibold">
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => setIsSignUp(!isSignUp)}>
          <Text className="text-slate-400 text-center">
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
