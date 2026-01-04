"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface RegenerateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editedFieldCount: number;
  onConfirm: () => void;
}

export function RegenerateWarningDialog({
  open,
  onOpenChange,
  editedFieldCount,
  onConfirm,
}: RegenerateWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Regenerate Profile?
          </DialogTitle>
          <DialogDescription>
            You have {editedFieldCount} edited{" "}
            {editedFieldCount === 1 ? "field" : "fields"} that will be lost if
            you regenerate. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Regenerate Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
