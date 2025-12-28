import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { Logo } from '../../components/logo';

const BETA_CODE_KEY = 'idynic_beta_code';

type Screen = 'auth' | 'confirmation';
type AuthMode = 'signin' | 'signup';

export default function LoginScreen() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [mode, setMode] = useState<AuthMode>('signin');

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite code state (for signup only)
  const [inviteCode, setInviteCode] = useState('');
  const [codeValidated, setCodeValidated] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);

  const validateCode = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setError('Please enter an invite code');
      return;
    }

    setValidatingCode(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('check_beta_code', {
        input_code: code,
      });

      if (rpcError) {
        setError('Unable to validate code. Please try again.');
        return;
      }

      if (data) {
        // Store code for consumption after signup
        await SecureStore.setItemAsync(BETA_CODE_KEY, code);
        setCodeValidated(true);
      } else {
        setError('Invalid or expired invite code');
      }
    } catch {
      setError('Unable to validate code. Please try again.');
    } finally {
      setValidatingCode(false);
    }
  };

  const consumeStoredCode = async (userId: string) => {
    const code = await SecureStore.getItemAsync(BETA_CODE_KEY);
    if (code) {
      await supabase.rpc('consume_beta_code', {
        input_code: code,
        user_id: userId,
      });
      await SecureStore.deleteItemAsync(BETA_CODE_KEY);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        const { error: authError, data } = await supabase.auth.signUp({ email, password });

        if (authError) {
          setError(authError.message);
        } else if (data?.user && !data.session) {
          // User created but needs email confirmation
          setScreen('confirmation');
        } else if (data?.user && data.session) {
          // User created and signed in - consume the code
          await consumeStoredCode(data.user.id);
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) {
          setError(authError.message);
        }
        // Navigation happens via auth state change
      }
    } catch (e) {
      setError('Network error: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'idynic://auth/callback',
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, 'idynic://auth/callback');

        if (result.type === 'success' && result.url) {
          // Supabase puts tokens in hash fragment, not query params
          const hashIndex = result.url.indexOf('#');
          if (hashIndex === -1) {
            setError('No auth tokens in response');
            return;
          }
          const hashParams = new URLSearchParams(result.url.substring(hashIndex + 1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              setError(sessionError.message);
            } else if (sessionData?.user && mode === 'signup') {
              // Only consume code if signing up
              await consumeStoredCode(sessionData.user.id);
            }
            // For signin, navigation happens via auth state change
            // If new user via signin (edge case), beta gate will catch it
          }
        }
      }
    } catch (e) {
      setError('Google auth failed: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: 'idynic://auth/callback',
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, 'idynic://auth/callback');

        if (result.type === 'success' && result.url) {
          const hashIndex = result.url.indexOf('#');
          if (hashIndex === -1) {
            setError('No auth tokens in response');
            return;
          }
          const hashParams = new URLSearchParams(result.url.substring(hashIndex + 1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              setError(sessionError.message);
            } else if (sessionData?.user && mode === 'signup') {
              await consumeStoredCode(sessionData.user.id);
            }
          }
        }
      }
    } catch (e) {
      setError('Apple auth failed: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    // Reset signup-specific state when switching to signin
    if (newMode === 'signin') {
      setCodeValidated(false);
      setInviteCode('');
    }
  };

  // Email confirmation screen
  if (screen === 'confirmation') {
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
            onPress={() => {
              setScreen('auth');
              switchMode('signin');
              setPassword('');
            }}
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

  // Main auth screen
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
        <Text className="text-slate-400 mb-6 text-center">Your smart career companion</Text>

        {/* Mode tabs */}
        <View className="flex-row mb-6 bg-slate-800 rounded-lg p-1">
          <Pressable
            onPress={() => switchMode('signin')}
            className={`flex-1 py-3 rounded-md ${mode === 'signin' ? 'bg-slate-700' : ''}`}
          >
            <Text className={`text-center font-medium ${mode === 'signin' ? 'text-white' : 'text-slate-400'}`}>
              Sign In
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchMode('signup')}
            className={`flex-1 py-3 rounded-md ${mode === 'signup' ? 'bg-slate-700' : ''}`}
          >
            <Text className={`text-center font-medium ${mode === 'signup' ? 'text-white' : 'text-slate-400'}`}>
              Sign Up
            </Text>
          </Pressable>
        </View>

        {error && (
          <View className="bg-red-900/50 p-3 rounded-lg mb-4">
            <Text className="text-red-300 text-center">{error}</Text>
          </View>
        )}

        {/* SIGNUP: Code entry first */}
        {mode === 'signup' && !codeValidated && (
          <View className="mb-6">
            <Text className="text-slate-300 text-center mb-4">
              Enter your invite code to get started
            </Text>

            <TextInput
              className="bg-slate-800 text-white px-4 py-4 rounded-lg mb-4 text-center text-lg uppercase tracking-widest"
              placeholder="Invite code"
              placeholderTextColor="#64748b"
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Pressable
              onPress={validateCode}
              disabled={validatingCode}
              className="bg-teal-600 py-4 rounded-lg mb-4"
            >
              {validatingCode ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-semibold">
                  Validate Code
                </Text>
              )}
            </Pressable>

            <Text className="text-slate-500 text-center text-sm">
              Don't have a code? Join our waitlist at idynic.com
            </Text>
          </View>
        )}

        {/* SIGNUP: Code validated - show auth options */}
        {mode === 'signup' && codeValidated && (
          <>
            <View className="bg-teal-900/30 p-3 rounded-lg mb-4 border border-teal-700">
              <Text className="text-teal-400 text-center text-sm">
                Code validated! Create your account below.
              </Text>
            </View>

            <Pressable
              onPress={handleGoogleAuth}
              disabled={loading}
              className="bg-white py-3 px-4 rounded-lg border border-gray-300 flex-row items-center justify-center mb-3"
              style={{ opacity: loading ? 0.5 : 1 }}
            >
              <Image
                source={require('../../assets/icons/google.png')}
                style={{ width: 18, height: 18, marginRight: 10 }}
                resizeMode="contain"
              />
              <Text className="text-gray-700 font-medium text-sm">Sign up with Google</Text>
            </Pressable>

            <Pressable
              onPress={handleAppleAuth}
              disabled={loading}
              className="bg-black py-3 px-4 rounded-lg flex-row items-center justify-center mb-4"
              style={{ opacity: loading ? 0.5 : 1 }}
            >
              <Svg width={18} height={18} viewBox="0 0 18 18" fill="#ffffff" style={{ marginRight: 10 }}>
                <Path d="M13.04 15.21c-.73.71-1.54.6-2.31.26-.82-.35-1.57-.36-2.43 0-1.08.46-1.65.33-2.3-.26-3.62-3.78-3.08-9.53 1.08-9.74 1.01.05 1.72.56 2.31.6.89-.18 1.73-.7 2.68-.63 1.13.09 1.99.54 2.55 1.35-2.34 1.4-1.78 4.49.36 5.35-.43 1.12-.98 2.24-1.9 3.07h-.04ZM9.27 5.44c-.11-1.67 1.24-3.05 2.8-3.19.22 1.94-1.75 3.38-2.8 3.19Z" />
              </Svg>
              <Text className="text-white font-medium text-sm">Sign up with Apple</Text>
            </Pressable>

            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-slate-700" />
              <Text className="text-slate-500 px-4">or</Text>
              <View className="flex-1 h-px bg-slate-700" />
            </View>

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
              onPress={handleEmailAuth}
              disabled={loading}
              className="bg-teal-600 w-full py-4 rounded-lg"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-semibold">
                  Sign Up
                </Text>
              )}
            </Pressable>

            <Text className="text-slate-500 text-center text-xs mt-4">
              By signing up, you agree to our{' '}
              <Text
                className="underline"
                onPress={() => Linking.openURL('https://idynic.com/legal/terms')}
              >
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text
                className="underline"
                onPress={() => Linking.openURL('https://idynic.com/legal/privacy')}
              >
                Privacy Policy
              </Text>
            </Text>

            <Pressable
              onPress={() => setCodeValidated(false)}
              className="mt-4"
            >
              <Text className="text-slate-500 text-center text-sm">
                Use a different invite code
              </Text>
            </Pressable>
          </>
        )}

        {/* SIGNIN: Show auth options directly */}
        {mode === 'signin' && (
          <>
            <Pressable
              onPress={handleGoogleAuth}
              disabled={loading}
              className="bg-white py-3 px-4 rounded-lg border border-gray-300 flex-row items-center justify-center mb-3"
              style={{ opacity: loading ? 0.5 : 1 }}
            >
              <Image
                source={require('../../assets/icons/google.png')}
                style={{ width: 18, height: 18, marginRight: 10 }}
                resizeMode="contain"
              />
              <Text className="text-gray-700 font-medium text-sm">Sign in with Google</Text>
            </Pressable>

            <Pressable
              onPress={handleAppleAuth}
              disabled={loading}
              className="bg-black py-3 px-4 rounded-lg flex-row items-center justify-center mb-4"
              style={{ opacity: loading ? 0.5 : 1 }}
            >
              <Svg width={18} height={18} viewBox="0 0 18 18" fill="#ffffff" style={{ marginRight: 10 }}>
                <Path d="M13.04 15.21c-.73.71-1.54.6-2.31.26-.82-.35-1.57-.36-2.43 0-1.08.46-1.65.33-2.3-.26-3.62-3.78-3.08-9.53 1.08-9.74 1.01.05 1.72.56 2.31.6.89-.18 1.73-.7 2.68-.63 1.13.09 1.99.54 2.55 1.35-2.34 1.4-1.78 4.49.36 5.35-.43 1.12-.98 2.24-1.9 3.07h-.04ZM9.27 5.44c-.11-1.67 1.24-3.05 2.8-3.19.22 1.94-1.75 3.38-2.8 3.19Z" />
              </Svg>
              <Text className="text-white font-medium text-sm">Sign in with Apple</Text>
            </Pressable>

            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-slate-700" />
              <Text className="text-slate-500 px-4">or</Text>
              <View className="flex-1 h-px bg-slate-700" />
            </View>

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
              onPress={handleEmailAuth}
              disabled={loading}
              className="bg-teal-600 w-full py-4 rounded-lg"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-semibold">
                  Sign In
                </Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
