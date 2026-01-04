"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResumeDocumentProps } from "./resume-document";

// Type declarations for pdf.js loaded from CDN
interface PDFPageViewport {
  width: number;
  height: number;
}

interface PDFRenderTask {
  promise: Promise<void>;
}

interface PDFPageProxy {
  getViewport(options: { scale: number }): PDFPageViewport;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PDFPageViewport;
  }): PDFRenderTask;
}

interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
}

interface PDFDocumentLoadingTask {
  promise: Promise<PDFDocumentProxy>;
}

interface PDFJSLib {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument(params: { data: ArrayBuffer }): PDFDocumentLoadingTask;
}

declare global {
  interface Window {
    pdfjsLib?: PDFJSLib;
  }
}

interface ResumePDFViewerProps {
  data: ResumeDocumentProps;
}

export function ResumePDFViewer({ data }: ResumePDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const scale = 1.5; // Fixed scale for consistent rendering

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load pdf.js from CDN
  useEffect(() => {
    if (!isClient) return;

    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [isClient]);

  // Generate PDF and load it
  useEffect(() => {
    if (!isClient) return;

    let cancelled = false;

    async function generateAndLoadPdf() {
      try {
        setIsLoading(true);
        setError(null);

        // Wait for pdf.js to load
        while (!window.pdfjsLib) {
          await new Promise((r) => setTimeout(r, 100));
          if (cancelled) return;
        }

        const [{ pdf }, { ResumeDocument }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("./resume-document"),
        ]);

        if (cancelled) return;

        const blob = await pdf(<ResumeDocument {...data} />).toBlob();

        if (cancelled) return;

        // Convert blob to ArrayBuffer
        const arrayBuffer = await blob.arrayBuffer();

        if (cancelled) return;

        // Load with pdf.js
        const loadingTask = window.pdfjsLib!.getDocument({ data: arrayBuffer });
        const pdfDocument = await loadingTask.promise;

        if (cancelled) return;

        setPdfDoc(pdfDocument);
        setNumPages(pdfDocument.numPages);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to generate PDF:", err);
        if (!cancelled) {
          setError("Failed to generate PDF: " + (err as Error).message);
          setIsLoading(false);
        }
      }
    }

    generateAndLoadPdf();

    return () => {
      cancelled = true;
    };
  }, [isClient, data]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const doc = pdfDoc; // Capture for async context
    let cancelled = false;

    async function renderPage() {
      try {
        const page = await doc.getPage(pageNum);

        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const context = canvas.getContext("2d")!;

        // Clear canvas before resizing
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Set new dimensions
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (cancelled) return;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
      } catch (err) {
        console.error("Failed to render page:", err);
      }
    }

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNum, scale]);

  if (!isClient || isLoading) {
    return (
      <div className="flex items-center justify-center h-[700px] bg-muted/30 rounded-lg border">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Generating PDF...</p>
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
    <div className="border rounded-lg overflow-hidden bg-gray-200">
      {/* Controls */}
      <div className="flex items-center justify-center px-4 py-2 bg-gray-700 text-white">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="text-white hover:bg-gray-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            {pageNum} / {numPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
            disabled={pageNum >= numPages}
            className="text-white hover:bg-gray-600"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="overflow-auto h-[800px] flex justify-center p-4 bg-gray-400">
        <canvas ref={canvasRef} className="shadow-lg bg-white" />
      </div>
    </div>
  );
}
