"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Linkedin } from "lucide-react";

function isLinkedInJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("linkedin.com") && parsed.pathname.includes("/jobs/view/");
  } catch {
    return false;
  }
}

function looksLikeJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Known job boards
    const jobBoards = [
      "indeed.com", "glassdoor.com", "ziprecruiter.com", "monster.com",
      "dice.com", "builtin.com", "lever.co", "greenhouse.io", "workday.com",
      "myworkdayjobs.com", "smartrecruiters.com", "ashbyhq.com", "wellfound.com",
    ];

    if (jobBoards.some((board) => hostname.includes(board))) return true;
    if (hostname.startsWith("jobs.") || hostname.startsWith("careers.")) return true;

    const jobPatterns = ["/job/", "/jobs/", "/career/", "/careers/", "/position/", "/opening/", "/apply/"];
    if (jobPatterns.some((pattern) => pathname.includes(pattern))) return true;

    return false;
  } catch {
    return false;
  }
}

export function AddOpportunityDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [isLinkedIn, setIsLinkedIn] = useState(false);
  const [isJobUrl, setIsJobUrl] = useState(false);
  const router = useRouter();

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setIsLinkedIn(isLinkedInJobUrl(newUrl));
    setIsJobUrl(looksLikeJobUrl(newUrl) || isLinkedInJobUrl(newUrl));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      url: formData.get("url") as string,
      description: formData.get("description") as string,
    };

    try {
      const response = await fetch("/api/process-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add opportunity");
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        setUrl("");
        setIsLinkedIn(false);
        setIsJobUrl(false);
        setError(null);
      }
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Opportunity
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Opportunity</DialogTitle>
            <DialogDescription>
              Add a job posting to track and see how your profile matches.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="url">Job URL</Label>
              <div className="relative">
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://linkedin.com/jobs/view/..."
                  value={url}
                  onChange={handleUrlChange}
                  className={isLinkedIn ? "pr-10" : ""}
                />
                {isLinkedIn && (
                  <Linkedin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0A66C2]" />
                )}
              </div>
              {isJobUrl && (
                <p className="text-sm text-muted-foreground">
                  {isLinkedIn
                    ? "LinkedIn job detected - we'll auto-fill the details"
                    : "Job URL detected - we'll try to fetch the details"
                  }
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">
                Job Description {!isJobUrl && "*"}
              </Label>
              <Textarea
                id="description"
                name="description"
                placeholder={isJobUrl ? "Optional - will be fetched from the URL" : "Paste the full job description here..."}
                className="min-h-[200px]"
                required={!isJobUrl}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading
                ? (isLinkedIn ? "Fetching from LinkedIn..." : isJobUrl ? "Fetching job details..." : "Processing...")
                : "Add Opportunity"
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
