"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { ResumeUpload } from "@/components/resume-upload";
import { useState } from "react";
import { useInvalidateGraph } from "@/lib/hooks/use-identity-graph";

export function UploadResumeModal() {
  const [open, setOpen] = useState(false);
  const invalidateGraph = useInvalidateGraph();

  const handleComplete = () => {
    invalidateGraph();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Upload Resume
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Resume</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <ResumeUpload onUploadComplete={handleComplete} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
