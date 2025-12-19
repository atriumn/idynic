"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  Building2
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

interface WorkHistoryItem {
  id: string;
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  summary: string | null;
  company_domain: string | null;
  order_index: number;
}

interface WorkHistorySectionProps {
  items: WorkHistoryItem[];
  onUpdate: (items: WorkHistoryItem[]) => void;
}

const EMPTY_ITEM: Omit<WorkHistoryItem, "id" | "order_index"> = {
  company: "",
  title: "",
  start_date: "",
  end_date: null,
  location: null,
  summary: null,
  company_domain: null,
};

export function WorkHistorySection({ items, onUpdate }: WorkHistorySectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<WorkHistoryItem>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (item: WorkHistoryItem) => {
    setEditingId(item.id);
    setEditData(item);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/profile/work-history/${editingId}`, {
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
      setEditData({});
      toast.success("Work history updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newItem.company || !newItem.title || !newItem.start_date) {
      toast.error("Company, title, and start date are required");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/profile/work-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newItem, entry_type: "work" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add");
      }

      const added = await response.json();
      onUpdate([...items, added]);
      setIsAdding(false);
      setNewItem(EMPTY_ITEM);
      toast.success("Work history added");
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
      const response = await fetch(`/api/profile/work-history/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete");
      }

      onUpdate(items.filter((item) => item.id !== deleteId));
      toast.success("Work history deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsSaving(false);
      setDeleteId(null);
    }
  };

  const renderForm = (
    data: Partial<WorkHistoryItem>,
    setData: (data: Partial<WorkHistoryItem>) => void,
    onSave: () => void,
    onCancel: () => void
  ) => (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Company *</Label>
          <Input
            value={data.company || ""}
            onChange={(e) => setData({ ...data, company: e.target.value })}
            placeholder="Company name"
          />
        </div>
        <div className="space-y-2">
          <Label>Title *</Label>
          <Input
            value={data.title || ""}
            onChange={(e) => setData({ ...data, title: e.target.value })}
            placeholder="Job title"
          />
        </div>
        <div className="space-y-2">
          <Label>Start Date *</Label>
          <Input
            value={data.start_date || ""}
            onChange={(e) => setData({ ...data, start_date: e.target.value })}
            placeholder="e.g., Jan 2020"
          />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input
            value={data.end_date || ""}
            onChange={(e) => setData({ ...data, end_date: e.target.value || null })}
            placeholder="e.g., Dec 2023 or Present"
          />
        </div>
        <div className="space-y-2">
          <Label>Location</Label>
          <Input
            value={data.location || ""}
            onChange={(e) => setData({ ...data, location: e.target.value || null })}
            placeholder="City, State"
          />
        </div>
        <div className="space-y-2">
          <Label>Company Domain (for logo)</Label>
          <Input
            value={data.company_domain || ""}
            onChange={(e) => setData({ ...data, company_domain: e.target.value || null })}
            placeholder="e.g., google.com"
          />
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
                <CardTitle className="text-lg">Work History ({items.length})</CardTitle>
              </CollapsibleTrigger>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
                <Pencil className="h-4 w-4 mr-1" />
                {isEditing ? "Done" : "Edit"}
              </Button>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {items.length === 0 && !isAdding ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No work history yet. Add one?</p>
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
                          setEditData({});
                        }
                      )}
                    </div>
                  ) : (
                    <div key={item.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex gap-3">
                        {item.company_domain && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={`https://logo.clearbit.com/${item.company_domain}`}
                            alt=""
                            className="w-10 h-10 rounded object-contain bg-white"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        )}
                        <div>
                          <h4 className="font-medium">{item.title}</h4>
                          <p className="text-sm text-muted-foreground">{item.company}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.start_date} - {item.end_date || "Present"}
                            {item.location && ` · ${item.location}`}
                          </p>
                        </div>
                      </div>
                      {isEditing && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteId(item.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                )
              )}

              {isAdding && (
                renderForm(
                  newItem,
                  (data) => setNewItem({ ...EMPTY_ITEM, ...data }),
                  handleAdd,
                  () => {
                    setIsAdding(false);
                    setNewItem(EMPTY_ITEM);
                  }
                )
              )}

              {isEditing && !isAdding && (
                <Button variant="outline" className="w-full" onClick={() => setIsAdding(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Work History
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete work history?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this entry from your profile. Evidence and accomplishments linked to this role will be preserved.
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
