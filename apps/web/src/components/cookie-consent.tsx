"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "idynic_cookie_consent";

type ConsentStatus = "pending" | "accepted" | "declined";

export function CookieConsent() {
  const [status, setStatus] = useState<ConsentStatus>("pending");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored === "accepted" || stored === "declined") {
      setStatus(stored);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setStatus("accepted");
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    setStatus("declined");
  };

  // Don't render on server or if already decided
  if (!mounted || status !== "pending") {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-lg">
      <div className="container mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground text-center sm:text-left">
          We use cookies to analyze site usage and improve your experience. By
          clicking &quot;Accept&quot;, you consent to our use of analytics cookies. See
          our{" "}
          <Link href="/legal/cookies" className="underline hover:text-foreground">
            Cookie Policy
          </Link>{" "}
          for details.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleDecline}>
            Decline
          </Button>
          <Button size="sm" onClick={handleAccept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper to check consent status (for analytics initialization)
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted";
}
