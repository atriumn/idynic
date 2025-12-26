import '../global.css';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MeshBackground } from '../components/ui/mesh-background';
import { ShareIntentProvider, useShareIntent } from 'expo-share-intent';

const queryClient = new QueryClient();

// Custom dark theme with our colors
const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#14b8a6',
    background: 'transparent', // Make transparent so MeshBackground shows
    card: '#0f172a',
    text: '#ffffff',
    border: '#1e293b',
  },
};

function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Don't process share intent until auth is loaded
    if (loading) return;

    // Don't process if no share intent
    if (!hasShareIntent || !shareIntent) return;

    // Need to be authenticated to add opportunities
    if (!session) {
      // Reset share intent - user needs to login first
      resetShareIntent();
      return;
    }

    // Extract the URL from share intent
    const sharedUrl = shareIntent.webUrl || shareIntent.text;

    if (sharedUrl) {
      console.log('[ShareIntent] Received URL:', sharedUrl);

      // Navigate to add opportunity screen with the URL
      // Use replace to avoid back navigation issues
      router.push({
        pathname: '/(app)/add-opportunity',
        params: { url: sharedUrl },
      });

      // Reset share intent after handling
      resetShareIntent();
    }
  }, [hasShareIntent, shareIntent, session, loading, router, resetShareIntent]);

  return null;
}

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, loading, segments]);

  return (
    <>
      <ShareIntentHandler />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={CustomDarkTheme}>
          <AuthProvider>
            <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
               <MeshBackground />
               <StatusBar style="light" />
               <RootLayoutNav />
            </View>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ShareIntentProvider>
  );
}
