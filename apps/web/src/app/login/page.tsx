"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BETA_CODE_KEY = "idynic_beta_code";

type AuthMode = "signin" | "signup";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");

  // Auth state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Invite code state (for signup only)
  const [inviteCode, setInviteCode] = useState("");
  const [codeValidated, setCodeValidated] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);

  useEffect(() => {
    setMounted(true);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        router.push("/identity");
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const validateCode = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setError("Please enter an invite code");
      return;
    }

    setValidatingCode(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("check_beta_code", {
        input_code: code,
      });

      if (rpcError) {
        setError("Unable to validate code. Please try again.");
        return;
      }

      if (data) {
        localStorage.setItem(BETA_CODE_KEY, code);
        setCodeValidated(true);
      } else {
        setError("Invalid or expired invite code");
      }
    } catch {
      setError("Unable to validate code. Please try again.");
    } finally {
      setValidatingCode(false);
    }
  };

  const consumeStoredCode = async (userId: string) => {
    const code = localStorage.getItem(BETA_CODE_KEY);
    if (code) {
      await supabase.rpc("consume_beta_code", {
        input_code: code,
        user_id: userId,
      });
      localStorage.removeItem(BETA_CODE_KEY);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        const { error: authError, data } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) {
          setError(authError.message);
        } else if (data?.user && !data.session) {
          setShowConfirmation(true);
        } else if (data?.user && data.session) {
          await consumeStoredCode(data.user.id);
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) {
          setError(authError.message);
        }
      }
    } catch (e) {
      setError("Network error: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback${mode === "signup" ? "?signup=true" : ""}`,
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      }
    } catch (e) {
      setError("Google auth failed: " + (e as Error).message);
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: `${window.location.origin}/auth/callback${mode === "signup" ? "?signup=true" : ""}`,
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      }
    } catch (e) {
      setError("Apple auth failed: " + (e as Error).message);
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    if (newMode === "signin") {
      setCodeValidated(false);
      setInviteCode("");
    }
  };

  if (!mounted) {
    return null;
  }

  // Email confirmation screen
  if (showConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{email}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Click the link in your email to confirm your account, then return
              here to sign in.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmation(false);
                switchMode("signin");
                setPassword("");
              }}
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Idynic</CardTitle>
          <p className="text-muted-foreground text-sm">
            Your smart career companion
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode tabs */}
          <Tabs value={mode} onValueChange={(v) => switchMode(v as AuthMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
          </Tabs>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          {/* SIGNUP: Code entry first */}
          {mode === "signup" && !codeValidated && (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground">
                Enter your invite code to get started
              </p>

              <Input
                type="text"
                placeholder="Invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && validateCode()}
                className="text-center uppercase tracking-widest text-lg"
              />

              <Button
                className="w-full"
                onClick={validateCode}
                disabled={validatingCode}
              >
                {validatingCode ? "Validating..." : "Validate Code"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have a code? Join our waitlist at idynic.com
              </p>
            </div>
          )}

          {/* SIGNUP: Code validated - show auth options */}
          {mode === "signup" && codeValidated && (
            <div className="space-y-3">
              <div className="bg-green-500/10 text-green-600 text-sm p-3 rounded-md text-center">
                Code validated! Create your account below.
              </div>

              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 h-11 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-[18px] h-[18px]" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18Z" />
                  <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17Z" />
                  <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07Z" />
                  <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3Z" />
                </svg>
                Sign up with Google
              </button>

              <button
                type="button"
                onClick={handleAppleAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 h-11 bg-black rounded-lg text-sm text-white font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-[18px] h-[18px]" viewBox="0 0 18 18" fill="currentColor">
                  <path d="M13.04 15.21c-.73.71-1.54.6-2.31.26-.82-.35-1.57-.36-2.43 0-1.08.46-1.65.33-2.3-.26-3.62-3.78-3.08-9.53 1.08-9.74 1.01.05 1.72.56 2.31.6.89-.18 1.73-.7 2.68-.63 1.13.09 1.99.54 2.55 1.35-2.34 1.4-1.78 4.49.36 5.35-.43 1.12-.98 2.24-1.9 3.07h-.04ZM9.27 5.44c-.11-1.67 1.24-3.05 2.8-3.19.22 1.94-1.75 3.38-2.8 3.19Z"/>
                </svg>
                Sign up with Apple
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    or
                  </span>
                </div>
              </div>

              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
              />

              <Button
                className="w-full"
                onClick={handleEmailAuth}
                disabled={loading}
              >
                {loading ? "Creating account..." : "Sign Up"}
              </Button>

              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setCodeValidated(false)}
              >
                Use a different invite code
              </button>
            </div>
          )}

          {/* SIGNIN: Show auth options directly */}
          {mode === "signin" && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 h-11 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-[18px] h-[18px]" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18Z" />
                  <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17Z" />
                  <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07Z" />
                  <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3Z" />
                </svg>
                Sign in with Google
              </button>

              <button
                type="button"
                onClick={handleAppleAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 h-11 bg-black rounded-lg text-sm text-white font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-[18px] h-[18px]" viewBox="0 0 18 18" fill="currentColor">
                  <path d="M13.04 15.21c-.73.71-1.54.6-2.31.26-.82-.35-1.57-.36-2.43 0-1.08.46-1.65.33-2.3-.26-3.62-3.78-3.08-9.53 1.08-9.74 1.01.05 1.72.56 2.31.6.89-.18 1.73-.7 2.68-.63 1.13.09 1.99.54 2.55 1.35-2.34 1.4-1.78 4.49.36 5.35-.43 1.12-.98 2.24-1.9 3.07h-.04ZM9.27 5.44c-.11-1.67 1.24-3.05 2.8-3.19.22 1.94-1.75 3.38-2.8 3.19Z"/>
                </svg>
                Sign in with Apple
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    or
                  </span>
                </div>
              </div>

              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
              />

              <Button
                className="w-full"
                onClick={handleEmailAuth}
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
