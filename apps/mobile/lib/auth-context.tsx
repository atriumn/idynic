import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, markSessionInvalid } from "./supabase";
import * as Linking from "expo-linking";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Handle deep links for auth callback
  const handleDeepLink = async (url: string) => {
    console.log("[Auth] Deep link received:", url);

    // Parse the URL to extract tokens
    // Supabase sends: idynic://auth/callback#access_token=...&refresh_token=...&type=signup
    if (url.includes("access_token") || url.includes("refresh_token")) {
      try {
        // Extract hash fragment (Supabase puts tokens in hash)
        const hashIndex = url.indexOf("#");
        if (hashIndex !== -1) {
          const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          console.log("[Auth] Found tokens in URL");

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error("[Auth] Failed to set session:", error.message);
            } else {
              console.log("[Auth] Session set successfully:", data.user?.id);
            }
          }
        }
      } catch (error) {
        console.error("[Auth] Error handling deep link:", error);
      }
    }
  };

  useEffect(() => {
    // Check for initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for deep links while app is open
    const subscription = Linking.addEventListener("url", (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const clearInvalidSession = async () => {
      console.log("[Auth] Clearing invalid session from storage");
      // Mark session invalid to prevent further reads from storage
      markSessionInvalid();
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Ignore signOut errors
      }
      setSession(null);
      setLoading(false);
    };

    const initAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) {
          console.error("[Auth] getSession error:", error.message);
          // If we get an invalid refresh token error, clear the session
          if (
            error.message.includes("Refresh Token") ||
            error.message.includes("refresh_token") ||
            error.code === "refresh_token_not_found"
          ) {
            await clearInvalidSession();
            return;
          }
        }
        setSession(session);
        setLoading(false);
      } catch (error) {
        // Handle thrown errors (e.g., from auto-refresh)
        console.error("[Auth] Auth initialization error:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("Refresh Token") ||
          errorMessage.includes("refresh_token") ||
          errorMessage.includes("Invalid")
        ) {
          await clearInvalidSession();
          return;
        }
        setSession(null);
        setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth] Auth state changed:", event, session?.user?.id);

      // Handle token refresh errors
      if (event === "TOKEN_REFRESHED" && !session) {
        console.log("[Auth] Token refresh failed, clearing session");
        await clearInvalidSession();
        return;
      }

      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
