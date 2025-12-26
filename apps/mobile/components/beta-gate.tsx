import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Logo } from './logo';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

interface BetaGateProps {
  onAccessGranted: () => void;
}

export function BetaGate({ onAccessGranted }: BetaGateProps) {
  const { user, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  const validateAndConsumeCode = async () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      setError('Please enter an invite code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First validate the code
      const { data: isValid, error: checkError } = await supabase.rpc('check_beta_code', {
        input_code: trimmedCode,
      });

      if (checkError) {
        setError('Unable to validate code. Please try again.');
        setLoading(false);
        return;
      }

      if (!isValid) {
        setError('Invalid or expired invite code');
        setLoading(false);
        return;
      }

      // Consume the code
      const { error: consumeError } = await supabase.rpc('consume_beta_code', {
        input_code: trimmedCode,
        user_id: user!.id,
      });

      if (consumeError) {
        setError('Unable to activate code. Please try again.');
        setLoading(false);
        return;
      }

      // Success - notify parent
      onAccessGranted();
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const joinWaitlist = async () => {
    const email = waitlistEmail.trim().toLowerCase();
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setWaitlistLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('beta_waitlist')
        .insert({ email });

      if (error) {
        if (error.code === '23505') {
          setError('This email is already on the waitlist');
        } else {
          setError('Unable to join waitlist. Please try again.');
        }
        setWaitlistLoading(false);
        return;
      }

      setWaitlistSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setWaitlistLoading(false);
    }
  };

  // Waitlist success view
  if (waitlistSubmitted) {
    return (
      <View className="flex-1 bg-slate-900 justify-center px-6">
        <View className="items-center mb-6">
          <Logo size={80} />
        </View>

        <Text className="text-2xl font-bold text-white mb-4 text-center">
          You're on the list!
        </Text>

        <Text className="text-slate-300 text-center mb-6">
          We'll send an invite code to {waitlistEmail} when a spot opens up.
        </Text>

        <Pressable
          onPress={() => {
            setShowWaitlist(false);
            setWaitlistSubmitted(false);
          }}
          className="bg-slate-700 py-4 rounded-lg"
        >
          <Text className="text-white text-center font-semibold">
            I have a code now
          </Text>
        </Pressable>

        <Pressable onPress={signOut} className="mt-4">
          <Text className="text-slate-500 text-center text-sm">
            Sign out
          </Text>
        </Pressable>
      </View>
    );
  }

  // Waitlist form view
  if (showWaitlist) {
    return (
      <View className="flex-1 bg-slate-900 justify-center px-6">
        <View className="items-center mb-6">
          <Logo size={80} />
        </View>

        <Text className="text-2xl font-bold text-white mb-2 text-center">
          Join the Waitlist
        </Text>

        <Text className="text-slate-400 mb-6 text-center">
          We'll notify you when a spot opens up
        </Text>

        {error && (
          <View className="bg-red-900/50 p-3 rounded-lg mb-4">
            <Text className="text-red-300 text-center">{error}</Text>
          </View>
        )}

        <TextInput
          className="bg-slate-800 text-white px-4 py-3 rounded-lg mb-4"
          placeholder="Your email"
          placeholderTextColor="#64748b"
          value={waitlistEmail}
          onChangeText={setWaitlistEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Pressable
          onPress={joinWaitlist}
          disabled={waitlistLoading}
          className="bg-teal-600 py-4 rounded-lg mb-4"
        >
          {waitlistLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-semibold">
              Join Waitlist
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => setShowWaitlist(false)}>
          <Text className="text-slate-400 text-center">
            I have an invite code
          </Text>
        </Pressable>
      </View>
    );
  }

  // Main code entry view
  return (
    <View className="flex-1 bg-slate-900 justify-center px-6">
      <View className="items-center mb-6">
        <Logo size={80} />
      </View>

      <Text className="text-2xl font-bold text-white mb-2 text-center">
        Almost there!
      </Text>

      <Text className="text-slate-400 mb-6 text-center">
        Enter your invite code to get started
      </Text>

      {error && (
        <View className="bg-red-900/50 p-3 rounded-lg mb-4">
          <Text className="text-red-300 text-center">{error}</Text>
        </View>
      )}

      <TextInput
        className="bg-slate-800 text-white px-4 py-4 rounded-lg mb-4 text-center text-lg uppercase tracking-widest"
        placeholder="Enter code"
        placeholderTextColor="#64748b"
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <Pressable
        onPress={validateAndConsumeCode}
        disabled={loading}
        className="bg-teal-600 py-4 rounded-lg mb-4"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-center font-semibold">
            Activate
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => setShowWaitlist(true)}>
        <Text className="text-slate-400 text-center">
          Don't have a code? Join the waitlist
        </Text>
      </Pressable>

      <Pressable onPress={signOut} className="mt-6">
        <Text className="text-slate-500 text-center text-sm">
          Sign out
        </Text>
      </Pressable>
    </View>
  );
}
