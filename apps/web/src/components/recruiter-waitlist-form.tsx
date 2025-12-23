"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export function RecruiterWaitlistForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch("/api/recruiter-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error();

      setSuccess(true);
      toast.success("You're on the list!");
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
        <h3 className="text-xl font-semibold mb-2">You&apos;re on the list!</h3>
        <p className="text-muted-foreground">
          We&apos;ll reach out when we launch.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="text-lg h-12"
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          "Get Early Access"
        )}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        We&apos;ll never share your email. Unsubscribe anytime.
      </p>
    </form>
  );
}
