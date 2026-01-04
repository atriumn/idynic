"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Bug,
  Lightbulb,
  HelpCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

type FeedbackType = "bug" | "feature" | "question";

interface FeedbackModalProps {
  trigger?: React.ReactNode;
}

export function FeedbackModal({ trigger }: FeedbackModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState<{ issueUrl: string } | null>(null);

  const typeConfig = {
    bug: {
      icon: Bug,
      label: "Bug Report",
      placeholder: "What went wrong?",
      descPlaceholder: "Please describe the issue and steps to reproduce it...",
    },
    feature: {
      icon: Lightbulb,
      label: "Feature Request",
      placeholder: "What would you like to see?",
      descPlaceholder: "Describe the feature and why it would be helpful...",
    },
    question: {
      icon: HelpCircle,
      label: "Question",
      placeholder: "What would you like to know?",
      descPlaceholder: "Ask your question here...",
    },
  };

  const config = typeConfig[type];
  const TypeIcon = config.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          email: email.trim() || undefined,
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit feedback");
      }

      const data = await res.json();
      setSubmitted({ issueUrl: data.issueUrl });
      toast.success("Feedback submitted successfully!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit feedback",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset form after animation
    setTimeout(() => {
      setTitle("");
      setDescription("");
      setEmail("");
      setType("bug");
      setSubmitted(null);
    }, 200);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}
    >
      <DialogTrigger asChild>
        {trigger || (
          <button className="hover:text-foreground">Report a Bug</button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Help us improve Idynic by reporting bugs, requesting features, or
            asking questions.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <div className="text-green-600 text-lg font-medium">
                Thank you!
              </div>
              <p className="text-muted-foreground text-sm">
                Your feedback has been submitted. You can track its progress on
                GitHub.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline">
                <a
                  href={submitted.issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on GitHub
                </a>
              </Button>
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as FeedbackType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      Bug Report
                    </div>
                  </SelectItem>
                  <SelectItem value="feature">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Feature Request
                    </div>
                  </SelectItem>
                  <SelectItem value="question">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Question
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={config.placeholder}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={config.descPlaceholder}
                className="min-h-[120px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="For follow-up questions"
              />
              <p className="text-xs text-muted-foreground">
                We&apos;ll only use this to follow up on your feedback.
              </p>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TypeIcon className="h-4 w-4 mr-2" />
              )}
              Submit {config.label}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
