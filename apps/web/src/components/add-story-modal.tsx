"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { StoryInput } from "@/components/story-input";
import { useState } from "react";
import { useInvalidateGraph } from "@/lib/hooks/use-identity-graph";

export function AddStoryModal() {
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
          <MessageSquare className="h-4 w-4 mr-2" />
          Add Story
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Share a Story</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <StoryInput onSubmitComplete={handleComplete} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
