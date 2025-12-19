"use client";

import { ResumePDFDownload } from "@/components/resume-pdf";
import type { ResumeDocumentProps } from "@/components/resume-pdf";

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

export function SharedProfileResume({
  resumeData,
  candidateName,
  candidateContact,
}: SharedProfileResumeProps) {
  // Cast and merge candidate contact info into resume data
  const data = resumeData as ResumeDocumentProps;

  const resumeWithContact: ResumeDocumentProps = {
    ...data,
    name: candidateName || data.name || "Candidate",
    email: candidateContact.email || data.email,
    phone: candidateContact.phone || data.phone,
    location: candidateContact.location || data.location,
    linkedin: candidateContact.linkedin || data.linkedin,
    github: candidateContact.github || data.github,
    website: candidateContact.website || data.website,
  };

  return (
    <ResumePDFDownload
      data={resumeWithContact}
      filename={`${candidateName || "resume"}.pdf`}
    />
  );
}
