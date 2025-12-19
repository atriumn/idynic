"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import type { ResumeDocumentProps } from "./resume-document";

// Dynamic imports
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

const ResumeDocument = dynamic(
  () => import("./resume-document").then((mod) => mod.ResumeDocument),
  { ssr: false }
);

interface ResumePDFDownloadProps {
  data: ResumeDocumentProps;
  filename?: string;
}

export function ResumePDFDownload({ data, filename = "resume.pdf" }: ResumePDFDownloadProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  return (
    <PDFDownloadLink
      document={<ResumeDocument {...data} />}
      fileName={filename}
    >
      {({ loading }) => (
        <Button variant="outline" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Preparing...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
