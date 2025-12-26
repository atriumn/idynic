import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../lib/supabase';
import { Logo } from '../../components/logo';

const BETA_CODE_KEY = 'idynic_beta_code';

type Screen = 'auth' | 'waitlist' | 'waitlist-success' | 'confirmation';

export default function LoginScreen() {
  // Screen state
  const [screen, setScreen] = useState<Screen>('auth');

  // Beta code state
  const [betaCode, setBetaCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);

  // Waitlist state
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  // Check for existing validated code on mount
  const [codeValidated, setCodeValidated] = useState(false);

  useEffect(() => {
    const checkStoredCode = async () => {
      const storedCode = await SecureStore.getItemAsync(BETA_CODE_KEY);
      if (storedCode) {
        setBetaCode(storedCode);
        setCodeValidated(true);
      }
    };
    checkStoredCode();
  }, []);

  const validateCode = async () => {
    const code = betaCode.trim().toUpperCase();
    if (!code) {
      setCodeError('Please enter an invite code');
      return;
    }

    setValidatingCode(true);
    setCodeError(null);

    const { data, error } = await supabase.rpc('check_beta_code', {
      input_code: code,
    });

    setValidatingCode(false);

    if (error) {
      setCodeError('Unable to validate code. Please try again.');
      return;
    }

    if (data) {
      await SecureStore.setItemAsync(BETA_CODE_KEY, code);
      setBetaCode(code);
      setCodeValidated(true);
      setIsSignUp(true);
    } else {
      setCodeError('Invalid or expired invite code');
    }
  };

  const joinWaitlist = async () => {
    const emailValue = waitlistEmail.trim().toLowerCase();
    if (!emailValue) {
      setWaitlistError('Please enter your email');
      return;
    }

    setSubmittingWaitlist(true);
    setWaitlistError(null);

    const { error } = await supabase
      .from('beta_waitlist')
      .insert({ email: emailValue });

    setSubmittingWaitlist(false);

    if (error) {
      if (error.code === '23505') {
        setWaitlistError('This email is already on the waitlist');
      } else {
        setWaitlistError('Unable to join waitlist. Please try again.');
      }
      return;
    }

    setScreen('waitlist-success');
  };

  const consumeBetaCode = async (userId: string) => {
    const code = await SecureStore.getItemAsync(BETA_CODE_KEY);
    if (code) {
      await supabase.rpc('consume_beta_code', {
        input_code: code,
        user_id: userId,
      });
      await SecureStore.deleteItemAsync(BETA_CODE_KEY);
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error: authError, data } = await supabase.auth.signUp({ email, password });

        setLoading(false);

        if (authError) {
          setError(authError.message);
        } else if (data?.user && !data.session) {
          // User created but needs email confirmation
          setScreen('confirmation');
        } else if (data?.user && data.session) {
          // User created and signed in (email confirmation disabled)
          await consumeBetaCode(data.user.id);
        }
      } else {
        const { error: authError, data } = await supabase.auth.signInWithPassword({ email, password });

        setLoading(false);

        if (authError) {
          setError(authError.message);
        }
        // Navigation happens automatically via auth state change in _layout.tsx
      }
    } catch (e) {
      setLoading(false);
      setError('Network error: ' + (e as Error).message);
    }
  };

  const handleGoogleSignIn = async () => {
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
          // Extract tokens from URL and set session
          const url = new URL(result.url);
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              setError(sessionError.message);
            } else if (sessionData?.user) {
              await consumeBetaCode(sessionData.user.id);
            }
          }
        }
      }
    } catch (e) {
      setError('Google sign in failed: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resetCode = async () => {
    await SecureStore.deleteItemAsync(BETA_CODE_KEY);
    setBetaCode('');
    setCodeValidated(false);
    setCodeError(null);
  };

  // Waitlist form
  if (screen === 'waitlist') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-slate-900"
      >
        <View className="flex-1 justify-center px-6">
          <View className="items-center mb-4">
            <Logo size={80} />
          </View>
          <Text className="text-3xl font-bold text-white mb-2 text-center">Join the Waitlist</Text>
          <Text className="text-slate-400 mb-8 text-center">We'll notify you when we have a spot</Text>

          {waitlistError && (
            <View className="bg-red-900/50 p-3 rounded-lg mb-4">
              <Text className="text-red-300 text-center">{waitlistError}</Text>
            </View>
          )}

          <TextInput
            className="bg-slate-800 text-white px-4 py-3 rounded-lg mb-4"
            placeholder="Enter your email"
            placeholderTextColor="#64748b"
            value={waitlistEmail}
            onChangeText={setWaitlistEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Pressable
            onPress={joinWaitlist}
            disabled={submittingWaitlist}
            className="bg-teal-600 w-full py-4 rounded-lg mb-4"
          >
            {submittingWaitlist ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold">Join Waitlist</Text>
            )}
          </Pressable>

          <Pressable onPress={() => setScreen('auth')}>
            <Text className="text-slate-400 text-center">Back to login</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Waitlist success
  if (screen === 'waitlist-success') {
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
            You're on the list!
          </Text>

          <Text className="text-slate-300 text-center mb-2">
            Thanks for your interest in Idynic. We'll notify you at
          </Text>
          <Text className="text-teal-400 text-center font-semibold mb-8">
            {waitlistEmail}
          </Text>

          <Pressable
            onPress={() => setScreen('auth')}
            className="bg-slate-700 w-full py-4 rounded-lg"
          >
            <Text className="text-white text-center font-semibold">
              Back to login
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Email confirmation pending
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
              setIsSignUp(false);
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

        {error && (
          <View className="bg-red-900/50 p-3 rounded-lg mb-4">
            <Text className="text-red-300 text-center">{error}</Text>
          </View>
        )}

        {/* Invite code section for signups */}
        {!codeValidated && (
          <View className="bg-slate-800/50 p-4 rounded-lg mb-6 border border-slate-700">
            <Text className="text-slate-400 text-sm text-center mb-3">
              Have an invite code? Enter it to sign up.
            </Text>
            {codeError && (
              <View className="bg-red-900/50 p-2 rounded-lg mb-3">
                <Text className="text-red-300 text-center text-sm">{codeError}</Text>
              </View>
            )}
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 bg-slate-800 text-white px-3 py-2 rounded-lg text-center uppercase"
                placeholder="Code"
                placeholderTextColor="#64748b"
                value={betaCode}
                onChangeText={(text) => setBetaCode(text.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Pressable
                onPress={validateCode}
                disabled={validatingCode}
                className="bg-slate-600 px-4 py-2 rounded-lg justify-center"
              >
                <Text className="text-white font-semibold">
                  {validatingCode ? '...' : 'Verify'}
                </Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setScreen('waitlist')} className="mt-2">
              <Text className="text-slate-500 text-center text-xs underline">
                No code? Join waitlist
              </Text>
            </Pressable>
          </View>
        )}

        {codeValidated && (
          <View className="bg-teal-900/30 p-3 rounded-lg mb-4 border border-teal-700">
            <Text className="text-teal-400 text-center text-sm">
              Invite code verified - you can now sign up!
            </Text>
          </View>
        )}

        {/* Google Sign In Button - only show when code is validated */}
        {codeValidated && (
          <>
            <Pressable
              onPress={handleGoogleSignIn}
              disabled={loading}
              className="bg-white w-full py-4 rounded-lg mb-4 flex-row justify-center items-center"
            >
              <Text className="text-slate-900 text-center font-semibold">
                Continue with Google
              </Text>
            </Pressable>

            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-slate-700" />
              <Text className="text-slate-500 px-4">or</Text>
              <View className="flex-1 h-px bg-slate-700" />
            </View>
          </>
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

        {codeValidated && (
          <Pressable onPress={resetCode} className="mt-4">
            <Text className="text-slate-500 text-center text-xs">
              Use a different invite code
            </Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
