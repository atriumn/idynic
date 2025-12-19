"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Check, X, Loader2, GraduationCap } from "lucide-react";
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

interface EducationItem {
  id: string;
  text: string;
  context: { school?: string; degree?: string; field?: string; start_date?: string; end_date?: string; source?: string } | null;
}

interface EducationSectionProps {
  items: EducationItem[];
  onUpdate: (items: EducationItem[]) => void;
}

const EMPTY_ITEM = { school: "", degree: "", field: "", start_date: "", end_date: "" };

export function EducationSection({ items, onUpdate }: EducationSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState(EMPTY_ITEM);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (item: EducationItem) => {
    setEditingId(item.id);
    setEditData({
      school: item.context?.school || "",
      degree: item.context?.degree || "",
      field: item.context?.field || "",
      start_date: item.context?.start_date || "",
      end_date: item.context?.end_date || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/profile/education/${editingId}`, {
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
      setEditData(EMPTY_ITEM);
      toast.success("Education updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newItem.school.trim()) {
      toast.error("School name is required");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/profile/education", {
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
      toast.success("Education added");
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
      const response = await fetch(`/api/profile/education/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete");
      }

      onUpdate(items.filter((item) => item.id !== deleteId));
      toast.success("Education deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsSaving(false);
      setDeleteId(null);
    }
  };

  const renderForm = (
    data: typeof EMPTY_ITEM,
    setData: (data: typeof EMPTY_ITEM) => void,
    onSave: () => void,
    onCancel: () => void
  ) => (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>School *</Label>
          <Input
            value={data.school}
            onChange={(e) => setData({ ...data, school: e.target.value })}
            placeholder="e.g., Stanford University"
          />
        </div>
        <div className="space-y-2">
          <Label>Degree</Label>
          <Input
            value={data.degree}
            onChange={(e) => setData({ ...data, degree: e.target.value })}
            placeholder="e.g., Bachelor of Science"
          />
        </div>
        <div className="space-y-2">
          <Label>Field of Study</Label>
          <Input
            value={data.field}
            onChange={(e) => setData({ ...data, field: e.target.value })}
            placeholder="e.g., Computer Science"
          />
        </div>
        <div className="space-y-2 grid grid-cols-2 gap-2">
          <div>
            <Label>Start</Label>
            <Input
              value={data.start_date}
              onChange={(e) => setData({ ...data, start_date: e.target.value })}
              placeholder="e.g., 2018"
            />
          </div>
          <div>
            <Label>End</Label>
            <Input
              value={data.end_date}
              onChange={(e) => setData({ ...data, end_date: e.target.value })}
              placeholder="e.g., 2022"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
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
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-lg">Education ({items.length})</CardTitle>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {items.length === 0 && !isAdding ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No education history yet. Add one?</p>
                </div>
              ) : (
                items.map((item) =>
                  editingId === item.id ? (
                    <div key={item.id}>
                      {renderForm(
                        editData,
                        setEditData,
                        handleSaveEdit,
                        () => {
                          setEditingId(null);
                          setEditData(EMPTY_ITEM);
                        }
                      )}
                    </div>
                  ) : (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{item.context?.school || item.text}</p>
                        <p className="text-sm text-muted-foreground">
                          {[item.context?.degree, item.context?.field && `in ${item.context.field}`]
                            .filter(Boolean)
                            .join(" ")}
                        </p>
                        {(item.context?.start_date || item.context?.end_date) && (
                          <p className="text-xs text-muted-foreground">
                            {item.context?.start_date} - {item.context?.end_date || "Present"}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )
                )
              )}

              {isAdding && (
                renderForm(
                  newItem,
                  setNewItem,
                  handleAdd,
                  () => {
                    setIsAdding(false);
                    setNewItem(EMPTY_ITEM);
                  }
                )
              )}

              {!isAdding && (
                <Button variant="outline" className="w-full" onClick={() => setIsAdding(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Education
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete education entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this education entry from your profile.
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
