import "../global.css";
import { useEffect, useState } from "react";
import { View, LogBox } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MeshBackground } from "../components/ui/mesh-background";
import { ShareIntentProvider, useShareIntent } from "expo-share-intent";
import { supabase, markSessionInvalid } from "../lib/supabase";

// Suppress the refresh token error from showing in logs since we handle it
LogBox.ignoreLogs(["Invalid Refresh Token"]);

// Global handler for auth errors that happen during auto-refresh
// This catches errors before our React components mount
const setupGlobalAuthErrorHandler = () => {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const message = args[0]?.toString() || "";
    if (
      message.includes("Refresh Token") ||
      message.includes("refresh_token") ||
      (message.includes("AuthApiError") && message.includes("Invalid"))
    ) {
      console.log(
        "[Auth] Caught refresh token error globally, clearing session",
      );
      markSessionInvalid();
      supabase.auth.signOut({ scope: "local" }).catch(() => {});
      return; // Don't log the error
    }
    originalConsoleError.apply(console, args);
  };
};

setupGlobalAuthErrorHandler();

// Also handle unhandled promise rejections for auth errors
// ErrorUtils is a React Native global for error handling
declare const ErrorUtils:
  | {
      getGlobalHandler: () =>
        | ((error: Error, isFatal?: boolean) => void)
        | undefined;
      setGlobalHandler: (
        handler: (error: Error, isFatal?: boolean) => void,
      ) => void;
    }
  | undefined;

if (typeof ErrorUtils !== "undefined") {
  const originalHandler = ErrorUtils?.getGlobalHandler?.();
  ErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
    const message = error?.message || "";
    if (
      message.includes("Refresh Token") ||
      message.includes("refresh_token")
    ) {
      console.log("[Auth] Caught refresh token error in global handler");
      markSessionInvalid();
      supabase.auth.signOut({ scope: "local" }).catch(() => {});
      return; // Don't propagate
    }
    originalHandler?.(error, isFatal);
  });
}

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

const queryClient = new QueryClient();

// Custom dark theme with our colors
const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#14b8a6",
    background: "transparent", // Make transparent so MeshBackground shows
    card: "#0f172a",
    text: "#ffffff",
    border: "#1e293b",
  },
};

function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const { session, loading } = useAuth();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Don't process share intent until auth is loaded
    if (loading) return;

    // Don't process if no share intent or already processing
    if (!hasShareIntent || !shareIntent || isProcessing) return;

    // Need to be authenticated to add opportunities
    if (!session) {
      // Reset share intent - user needs to login first
      resetShareIntent();
      return;
    }

    // Extract the URL from share intent
    const sharedUrl = shareIntent.webUrl || shareIntent.text;

    if (sharedUrl) {
      console.log("[ShareIntent] Received URL:", sharedUrl);
      setIsProcessing(true);

      // Start processing immediately, then navigate to processing screen
      (async () => {
        try {
          const response = await fetch(`${API_URL}/api/process-opportunity`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ url: sharedUrl }),
          });

          const data = await response.json();

          if (response.ok && data.jobId) {
            // Navigate directly to processing screen with jobId (skip the form)
            router.push({
              pathname: "/(app)/add-opportunity",
              params: { jobId: data.jobId },
            });
          } else {
            // On error, show the form so user can add description
            router.push({
              pathname: "/(app)/add-opportunity",
              params: {
                url: sharedUrl,
                error: data.error || "Failed to start processing",
              },
            });
          }
        } catch (error) {
          console.error("[ShareIntent] API error:", error);
          router.push({
            pathname: "/(app)/add-opportunity",
            params: { url: sharedUrl, error: "Failed to connect to server" },
          });
        } finally {
          resetShareIntent();
          setIsProcessing(false);
        }
      })();
    }
  }, [
    hasShareIntent,
    shareIntent,
    session,
    loading,
    router,
    resetShareIntent,
    isProcessing,
  ]);

  return null;
}

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(app)");
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
            <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
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
