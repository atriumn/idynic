import '../global.css';
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MeshBackground } from '../components/ui/mesh-background';

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

  return <Slot />;
}

export default function RootLayout() {
  return (
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
  );
}
