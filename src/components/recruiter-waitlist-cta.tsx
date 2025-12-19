"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

/**
 * Placeholder component for recruiter waitlist CTA.
 * Will be implemented in Task 13 with full dialog and form functionality.
 */
export function RecruiterWaitlistCTA() {
  return (
    <Button variant="outline" size="sm" disabled>
      Hiring? Get early access
      <ArrowRight className="h-4 w-4 ml-1" />
    </Button>
  );
}
