"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
      <AlertCircle className="h-16 w-16 text-destructive/50 mb-4" />
      <h2 className="text-2xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </p>
      <div className="flex gap-4">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.href = "/"}>
          Go home
        </Button>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground mt-4">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
