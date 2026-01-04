"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface SkillItem {
  id: string;
  label: string;
  description: string | null;
  confidence: number;
  source: string;
}

interface SkillsSectionProps {
  items: SkillItem[];
  onUpdate: (items: SkillItem[]) => void;
}

export function SkillsSection({ items, onUpdate }: SkillsSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newSkill.trim()) return;
    setIsAdding(true);
    try {
      const response = await fetch("/api/profile/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newSkill.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add skill");
      }

      const added = await response.json();
      onUpdate([...items, added]);
      setNewSkill("");
      toast.success("Skill added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add skill");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/profile/skills/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete");
      }

      onUpdate(items.filter((item) => item.id !== id));
      toast.success("Skill removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newSkill.trim()) {
      e.preventDefault();
      handleAdd();
    }
  };

  // Group skills by source for display
  const extractedSkills = items.filter((s) => s.source === "extracted");
  const manualSkills = items.filter((s) => s.source === "manual");

  return (
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
              <CardTitle className="text-lg">Skills ({items.length})</CardTitle>
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              {isEditing ? "Done" : "Edit"}
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No skills yet. Upload a resume or add skills manually.</p>
              </div>
            ) : (
              <>
                {extractedSkills.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      From your resume
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {extractedSkills.map((skill) => (
                        <Badge
                          key={skill.id}
                          variant="secondary"
                          className="text-sm py-1 px-3 flex items-center gap-1"
                        >
                          {skill.label}
                          {isEditing && (
                            <button
                              onClick={() => handleDelete(skill.id)}
                              disabled={deletingId === skill.id}
                              className="ml-1 hover:text-destructive"
                            >
                              {deletingId === skill.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {manualSkills.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Manually added
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {manualSkills.map((skill) => (
                        <Badge
                          key={skill.id}
                          variant="outline"
                          className="text-sm py-1 px-3 flex items-center gap-1"
                        >
                          {skill.label}
                          {isEditing && (
                            <button
                              onClick={() => handleDelete(skill.id)}
                              disabled={deletingId === skill.id}
                              className="ml-1 hover:text-destructive"
                            >
                              {deletingId === skill.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {isEditing && (
              <div className="flex gap-2">
                <Input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add a skill..."
                  className="flex-1"
                />
                <Button
                  onClick={handleAdd}
                  disabled={!newSkill.trim() || isAdding}
                >
                  {isAdding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
