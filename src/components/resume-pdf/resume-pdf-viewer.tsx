"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { ResumeDocumentProps } from "./resume-document";

interface ResumePDFViewerProps {
  data: ResumeDocumentProps;
}

export function ResumePDFViewer({ data }: ResumePDFViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function generatePdf() {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamically import react-pdf and the document
        const [{ pdf }, { ResumeDocument }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("./resume-document"),
        ]);

        if (cancelled) return;

        // Generate blob
        const blob = await pdf(<ResumeDocument {...data} />).toBlob();

        if (cancelled) return;

        // Create object URL for iframe
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (err) {
        console.error("Failed to generate PDF:", err);
        if (!cancelled) {
          setError("Failed to generate PDF preview");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    generatePdf();

    return () => {
      cancelled = true;
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [data]);

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[700px] bg-muted/30 rounded-lg border">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Generating PDF preview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[700px] bg-muted/30 rounded-lg border">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-[700px] border rounded-lg overflow-hidden bg-gray-100">
      {pdfUrl && (
        <iframe
          src={pdfUrl}
          className="w-full h-full"
          title="Resume PDF Preview"
        />
      )}
    </div>
  );
}
