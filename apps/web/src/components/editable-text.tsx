"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Pencil,
  Loader2,
  RotateCcw,
  Check,
  Minus,
  Plus,
  Zap,
  MessageSquare,
  Sparkles,
  ChevronDown,
} from "lucide-react";

export type ContentType = "bullet" | "summary" | "narrative";

interface QuickAction {
  label: string;
  instruction: string;
  icon?: React.ReactNode;
}

const QUICK_ACTIONS: Record<ContentType, QuickAction[]> = {
  bullet: [
    { label: "Shorten", instruction: "Make this more concise without losing impact", icon: <Minus className="h-3 w-3" /> },
    { label: "Add Metrics", instruction: "Add specific numbers or metrics if possible", icon: <Plus className="h-3 w-3" /> },
    { label: "Stronger Verbs", instruction: "Use stronger action verbs at the start", icon: <Zap className="h-3 w-3" /> },
  ],
  summary: [
    { label: "Shorten", instruction: "Make this more concise", icon: <Minus className="h-3 w-3" /> },
    { label: "Expand", instruction: "Add more detail and context", icon: <Plus className="h-3 w-3" /> },
    { label: "More Confident", instruction: "Remove hedging language, be more direct", icon: <Zap className="h-3 w-3" /> },
  ],
  narrative: [
    { label: "Shorten", instruction: "Make this more concise while keeping key points", icon: <Minus className="h-3 w-3" /> },
    { label: "Expand", instruction: "Add more detail and context", icon: <Plus className="h-3 w-3" /> },
    { label: "More Conversational", instruction: "Make the tone warmer and more conversational", icon: <MessageSquare className="h-3 w-3" /> },
    { label: "Strengthen Opening", instruction: "Make the opening sentence more compelling", icon: <Sparkles className="h-3 w-3" /> },
  ],
};

interface EditableTextProps {
  value: string;
  fieldPath: string;
  contentType: ContentType;
  isEdited: boolean;
  opportunityId: string;
  onUpdate: (newValue: string, field: string) => void;
  onRevert: (field: string) => void;
  className?: string;
  multiline?: boolean;
  skills?: string[]; // For "Emphasize [Skill]" action
}

export function EditableText({
  value,
  fieldPath,
  contentType,
  isEdited,
  opportunityId,
  onUpdate,
  onRevert,
  className = "",
  multiline = false,
  skills = [],
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editValue with value prop when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      if (multiline) {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
  }, [isEditing, multiline]);

  const handleSave = useCallback(async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tailored-profile/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: fieldPath, value: editValue }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      const data = await response.json();
      onUpdate(data.value, fieldPath);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save edit:", err);
      setError("Failed to save. Try again.");
    } finally {
      setIsLoading(false);
    }
  }, [editValue, value, opportunityId, fieldPath, onUpdate]);

  const handleAiAction = useCallback(async (instruction: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tailored-profile/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: fieldPath, instruction }),
      });

      if (!response.ok) {
        throw new Error("Failed to process");
      }

      const data = await response.json();
      setEditValue(data.value);
      onUpdate(data.value, fieldPath);
    } catch (err) {
      console.error("Failed to process AI edit:", err);
      setError("AI edit failed. Try again.");
    } finally {
      setIsLoading(false);
      setCustomInstruction("");
    }
  }, [opportunityId, fieldPath, onUpdate]);

  const handleRevert = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tailored-profile/${opportunityId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: fieldPath }),
      });

      if (!response.ok) {
        throw new Error("Failed to revert");
      }

      const data = await response.json();
      setEditValue(data.value);
      onRevert(fieldPath);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to revert:", err);
      setError("Failed to revert. Try again.");
    } finally {
      setIsLoading(false);
    }
  }, [opportunityId, fieldPath, onRevert]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  const quickActions = QUICK_ACTIONS[contentType];

  if (!isEditing) {
    return (
      <span className={`group/editable inline ${className}`}>
        <span
          className="cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
          onClick={() => setIsEditing(true)}
        >
          {value}
        </span>
        {isEdited && (
          <Badge variant="outline" className="ml-2 text-xs py-0 px-1 text-muted-foreground">
            edited
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover/editable:opacity-100 ml-1 h-5 w-5 p-0 inline-flex align-middle"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </span>
    );
  }

  return (
    <Popover open={isEditing} onOpenChange={setIsEditing}>
      <PopoverAnchor asChild>
        <div className={`relative ${className}`}>
          {multiline ? (
            <Textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[100px] resize-y"
              disabled={isLoading}
            />
          ) : (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        className="w-auto p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-2">
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-1">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleAiAction(action.instruction)}
                disabled={isLoading}
              >
                {action.icon}
                <span className="ml-1">{action.label}</span>
              </Button>
            ))}

            {/* Emphasize Skill dropdown for bullets */}
            {contentType === "bullet" && skills.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isLoading}>
                    Emphasize
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {skills.slice(0, 5).map((skill) => (
                    <DropdownMenuItem
                      key={skill}
                      onClick={() => handleAiAction(`Emphasize ${skill} skills and experience`)}
                    >
                      {skill}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Custom instruction input */}
          <div className="flex gap-1">
            <Input
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="Custom instruction..."
              className="h-7 text-xs flex-1"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customInstruction.trim()) {
                  handleAiAction(customInstruction);
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleAiAction(customInstruction)}
              disabled={isLoading || !customInstruction.trim()}
            >
              <Sparkles className="h-3 w-3" />
            </Button>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {/* Action buttons */}
          <div className="flex justify-between items-center pt-1 border-t">
            <div>
              {isEdited && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={handleRevert}
                  disabled={isLoading}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Revert
                </Button>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setEditValue(value);
                  setIsEditing(false);
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs"
                onClick={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Done
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
