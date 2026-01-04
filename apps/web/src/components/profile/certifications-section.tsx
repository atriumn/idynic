"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CertificationItem {
  id: string;
  text: string;
  context: { issuer?: string; date?: string; source?: string } | null;
}

interface CertificationsSectionProps {
  items: CertificationItem[];
  onUpdate: (items: CertificationItem[]) => void;
}

const EMPTY_ITEM = { name: "", issuer: "", date: "" };

export function CertificationsSection({
  items,
  onUpdate,
}: CertificationsSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    name: string;
    issuer: string;
    date: string;
  }>({ name: "", issuer: "", date: "" });
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (item: CertificationItem) => {
    setEditingId(item.id);
    setEditData({
      name: item.text,
      issuer: item.context?.issuer || "",
      date: item.context?.date || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/profile/certifications/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      const updated = await response.json();
      onUpdate(items.map((item) => (item.id === editingId ? updated : item)));
      setEditingId(null);
      setEditData({ name: "", issuer: "", date: "" });
      toast.success("Certification updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newItem.name.trim()) {
      toast.error("Certification name is required");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/profile/certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add");
      }

      const added = await response.json();
      onUpdate([...items, added]);
      setIsAdding(false);
      setNewItem(EMPTY_ITEM);
      toast.success("Certification added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/profile/certifications/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete");
      }

      onUpdate(items.filter((item) => item.id !== deleteId));
      toast.success("Certification deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsSaving(false);
      setDeleteId(null);
    }
  };

  const renderForm = (
    data: { name: string; issuer: string; date: string },
    setData: (data: { name: string; issuer: string; date: string }) => void,
    onSave: () => void,
    onCancel: () => void,
  ) => (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Certification Name *</Label>
          <Input
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="e.g., AWS Solutions Architect"
          />
        </div>
        <div className="space-y-2">
          <Label>Issuer</Label>
          <Input
            value={data.issuer}
            onChange={(e) => setData({ ...data, issuer: e.target.value })}
            placeholder="e.g., Amazon Web Services"
          />
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input
            value={data.date}
            onChange={(e) => setData({ ...data, date: e.target.value })}
            placeholder="e.g., Jan 2023"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Save
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 hover:text-foreground transition-colors">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <CardTitle className="text-lg">
                  Certifications ({items.length})
                </CardTitle>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {items.length === 0 && !isAdding ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No certifications yet. Add one?</p>
                </div>
              ) : (
                items.map((item) =>
                  editingId === item.id ? (
                    <div key={item.id}>
                      {renderForm(editData, setEditData, handleSaveEdit, () => {
                        setEditingId(null);
                        setEditData({ name: "", issuer: "", date: "" });
                      })}
                    </div>
                  ) : (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{item.text}</p>
                        <p className="text-sm text-muted-foreground">
                          {[item.context?.issuer, item.context?.date]
                            .filter(Boolean)
                            .join(" · ") || "No details"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ),
                )
              )}

              {isAdding &&
                renderForm(newItem, setNewItem, handleAdd, () => {
                  setIsAdding(false);
                  setNewItem(EMPTY_ITEM);
                })}

              {!isAdding && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsAdding(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Certification
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete certification?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this certification from your profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
