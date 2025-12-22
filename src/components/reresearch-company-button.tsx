"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowsClockwise, SpinnerGap } from "@phosphor-icons/react";

interface ReresearchCompanyButtonProps {
  opportunityId: string;
}

export function ReresearchCompanyButton({ opportunityId }: ReresearchCompanyButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReresearch = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/research-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      });

      if (!response.ok) {
        throw new Error("Failed to research company");
      }

      // Refresh the page to show new data
      router.refresh();
    } catch (error) {
      console.error("Re-research failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleReresearch}
      disabled={loading}
      className="h-7 px-2 text-xs"
    >
      {loading ? (
        <>
          <SpinnerGap className="h-3 w-3 animate-spin mr-1" />
          Researching...
        </>
      ) : (
        <>
          <ArrowsClockwise className="h-3 w-3 mr-1" />
          Re-research
        </>
      )}
    </Button>
  );
}
