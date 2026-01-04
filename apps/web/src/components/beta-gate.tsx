"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface BetaGateProps {
  onAccessGranted: () => void;
}

export function BetaGate({ onAccessGranted }: BetaGateProps) {
  const supabase = createClient();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateAndConsumeCode = async () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      setError("Please enter an invite code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      // Validate the code
      const { data: isValid, error: checkError } = await supabase.rpc(
        "check_beta_code",
        { input_code: trimmedCode },
      );

      if (checkError) {
        setError("Unable to validate code. Please try again.");
        setLoading(false);
        return;
      }

      if (!isValid) {
        setError("Invalid or expired invite code");
        setLoading(false);
        return;
      }

      // Consume the code
      const { error: consumeError } = await supabase.rpc("consume_beta_code", {
        input_code: trimmedCode,
        user_id: user.id,
      });

      if (consumeError) {
        setError("Unable to activate code. Please try again.");
        setLoading(false);
        return;
      }

      onAccessGranted();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Almost there!</CardTitle>
          <p className="text-muted-foreground text-sm">
            Enter your invite code to get started
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          <Input
            type="text"
            placeholder="Invite code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && validateAndConsumeCode()}
            className="text-center uppercase tracking-widest text-lg"
          />

          <Button
            className="w-full"
            onClick={validateAndConsumeCode}
            disabled={loading}
          >
            {loading ? "Activating..." : "Activate"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have a code? Join our waitlist at idynic.com
          </p>

          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
