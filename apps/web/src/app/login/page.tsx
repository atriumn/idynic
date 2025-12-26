"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BETA_CODE_KEY = "idynic_beta_code";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Beta code state
  const [betaCode, setBetaCode] = useState("");
  const [codeValidated, setCodeValidated] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  // Waitlist state
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check if we already have a validated code in localStorage
    const storedCode = localStorage.getItem(BETA_CODE_KEY);
    if (storedCode) {
      setBetaCode(storedCode);
      setCodeValidated(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        // Consume the beta code after successful signup
        const code = localStorage.getItem(BETA_CODE_KEY);
        if (code) {
          await supabase.rpc("consume_beta_code", {
            input_code: code,
            user_id: session.user.id,
          });
          localStorage.removeItem(BETA_CODE_KEY);
        }
        router.push("/identity");
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const validateCode = async () => {
    if (!betaCode.trim()) {
      setCodeError("Please enter an invite code");
      return;
    }

    setValidating(true);
    setCodeError(null);

    const { data, error } = await supabase.rpc("check_beta_code", {
      input_code: betaCode.trim().toUpperCase(),
    });

    setValidating(false);

    if (error) {
      setCodeError("Unable to validate code. Please try again.");
      return;
    }

    if (data) {
      const normalizedCode = betaCode.trim().toUpperCase();
      setBetaCode(normalizedCode);
      localStorage.setItem(BETA_CODE_KEY, normalizedCode);
      setCodeValidated(true);
    } else {
      setCodeError("Invalid or expired invite code");
    }
  };

  const joinWaitlist = async () => {
    if (!waitlistEmail.trim()) {
      setWaitlistError("Please enter your email");
      return;
    }

    setSubmittingWaitlist(true);
    setWaitlistError(null);

    const { error } = await supabase
      .from("beta_waitlist")
      .insert({ email: waitlistEmail.trim().toLowerCase() });

    setSubmittingWaitlist(false);

    if (error) {
      if (error.code === "23505") {
        setWaitlistError("This email is already on the waitlist");
      } else {
        setWaitlistError("Unable to join waitlist. Please try again.");
      }
      return;
    }

    setWaitlistSubmitted(true);
  };

  const resetToCodeEntry = () => {
    localStorage.removeItem(BETA_CODE_KEY);
    setBetaCode("");
    setCodeValidated(false);
    setCodeError(null);
    setShowWaitlist(false);
    setWaitlistSubmitted(false);
  };

  if (!mounted) {
    return null;
  }

  // Waitlist success screen
  if (waitlistSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">You&apos;re on the list!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Thanks for your interest in Idynic. We&apos;ll notify you at{" "}
              <span className="font-medium text-foreground">{waitlistEmail}</span>{" "}
              when we have a spot for you.
            </p>
            <Button variant="outline" onClick={resetToCodeEntry}>
              Back to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Waitlist form
  if (showWaitlist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Join the Waitlist</CardTitle>
            <p className="text-muted-foreground text-sm">
              We&apos;ll notify you when we have a spot
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {waitlistError && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {waitlistError}
              </div>
            )}
            <Input
              type="email"
              placeholder="Enter your email"
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && joinWaitlist()}
            />
            <Button
              className="w-full"
              onClick={joinWaitlist}
              disabled={submittingWaitlist}
            >
              {submittingWaitlist ? "Joining..." : "Join Waitlist"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowWaitlist(false)}
            >
              I have an invite code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main auth screen - sign in always available, sign up requires code
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Idynic</CardTitle>
          <p className="text-muted-foreground text-sm">
            Your smart career companion
          </p>
        </CardHeader>
        <CardContent>
          {/* Show code input for signup if not validated */}
          {!codeValidated && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-3 text-center">
                Have an invite code? Enter it to sign up.
              </p>
              {codeError && (
                <div className="bg-destructive/10 text-destructive text-sm p-2 rounded-md mb-3">
                  {codeError}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Invite code"
                  value={betaCode}
                  onChange={(e) => setBetaCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && validateCode()}
                  className="text-center uppercase tracking-wider"
                />
                <Button
                  onClick={validateCode}
                  disabled={validating}
                  variant="secondary"
                >
                  {validating ? "..." : "Verify"}
                </Button>
              </div>
              <div className="text-center mt-2">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={() => setShowWaitlist(true)}
                >
                  No code? Join waitlist
                </button>
              </div>
            </div>
          )}

          {codeValidated && (
            <div className="mb-4 p-2 bg-green-500/10 text-green-600 text-sm rounded-md text-center">
              Invite code verified - you can now sign up!
            </div>
          )}

          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "#18181b",
                    brandAccent: "#27272a",
                  },
                },
                dark: {
                  colors: {
                    brand: "#14b8a6",
                    brandAccent: "#0d9488",
                    inputText: "#ffffff",
                    inputBackground: "#1e293b",
                    inputBorder: "#334155",
                    inputPlaceholder: "#64748b",
                  },
                },
              },
            }}
            providers={codeValidated ? ["google"] : []}
            view={codeValidated ? "sign_up" : "sign_in"}
            redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`}
          />

          {codeValidated && (
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={resetToCodeEntry}
              >
                Use a different invite code
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
