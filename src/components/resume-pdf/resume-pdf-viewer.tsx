"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { ResumeDocumentProps } from "./resume-document";

// Dynamic import to avoid SSR issues with react-pdf
const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <LoadingState /> }
);

const ResumeDocument = dynamic(
  () => import("./resume-document").then((mod) => mod.ResumeDocument),
  { ssr: false }
);

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-[600px] bg-muted/30 rounded-lg">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading PDF preview...</p>
      </div>
    </div>
  );
}

interface ResumePDFViewerProps {
  data: ResumeDocumentProps;
}

export function ResumePDFViewer({ data }: ResumePDFViewerProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <LoadingState />;
  }

  return (
    <div className="w-full h-[700px] border rounded-lg overflow-hidden bg-gray-100">
      <PDFViewer width="100%" height="100%" showToolbar={true}>
        <ResumeDocument {...data} />
      </PDFViewer>
    </div>
  );
}
