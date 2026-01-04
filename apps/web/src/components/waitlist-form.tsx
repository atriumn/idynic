"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

type WaitlistSource = "homepage" | "students" | "recruiters" | "mobile";
type WaitlistInterest = "job_seeking" | "recruiting";

interface WaitlistFormProps {
  source: WaitlistSource;
  interests?: WaitlistInterest[];
  emailLabel?: string;
  emailPlaceholder?: string;
  submitLabel?: string;
  successTitle?: string;
  successMessage?: string;
  privacyNote?: string;
}

export function WaitlistForm({
  source,
  interests,
  emailLabel = "Email",
  emailPlaceholder = "you@example.com",
  submitLabel = "Join Waitlist",
  successTitle = "You're on the list!",
  successMessage = "We'll reach out when we launch.",
  privacyNote = "We'll never share your email. Unsubscribe anytime.",
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source, interests }),
      });

      if (!res.ok) throw new Error();

      setSuccess(true);
      toast.success(successTitle);
    } catch {
      toast.error("Failed to join waitlist");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="py-8 text-center">
        <Check className="h-16 w-16 mx-auto text-green-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">{successTitle}</h3>
        <p className="text-muted-foreground">{successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="waitlist-email">{emailLabel}</Label>
        <Input
          id="waitlist-email"
          type="email"
          placeholder={emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="text-lg h-12"
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : submitLabel}
      </Button>
      <p className="text-xs text-center text-muted-foreground">{privacyNote}</p>
    </form>
  );
}
