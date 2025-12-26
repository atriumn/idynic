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
            <div className="space-y-4">
              <div className="bg-green-500/10 text-green-600 text-sm p-3 rounded-md text-center">
                Code validated! Create your account below.
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogleAuth}
                disabled={loading}
              >
                Sign up with Google
              </Button>

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
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogleAuth}
                disabled={loading}
              >
                Sign in with Google
              </Button>

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
