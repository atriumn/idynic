"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import type { ResumeDocumentProps } from "./resume-document";

interface ResumePDFDownloadProps {
  data: ResumeDocumentProps;
  filename?: string;
}

export function ResumePDFDownload({ data, filename = "resume.pdf" }: ResumePDFDownloadProps) {
  const [isClient, setIsClient] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleDownload = useCallback(async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    try {
      // Dynamically import react-pdf and the document
      const [{ pdf }, { ResumeDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./resume-document"),
      ]);

      // Generate blob
      const blob = await pdf(<ResumeDocument {...data} />).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [data, filename, isGenerating]);

  if (!isClient) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={isGenerating}
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </>
      )}
    </Button>
  );
}
