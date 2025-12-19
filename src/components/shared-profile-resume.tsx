"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface SharedProfileResumeProps {
  resumeData: Record<string, unknown>;
  candidateName: string | null;
  candidateContact: {
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
  };
}

/**
 * Placeholder component for PDF download functionality.
 * Will be implemented in Task 12 to integrate with ResumePDFDownload component.
 */
export function SharedProfileResume({
  resumeData,
  candidateName,
  candidateContact,
}: SharedProfileResumeProps) {
  return (
    <Button variant="outline" size="sm" disabled>
      <Download className="h-4 w-4 mr-2" />
      Download PDF
    </Button>
  );
}
