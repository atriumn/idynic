# Editable Tailored Content Implementation Plan

> **Status:** ✅ COMPLETE (2025-12-19)

**Goal:** Enable users to edit AI-generated resume bullets, summaries, and cover letter narratives with both direct text editing and AI-assisted refinement.

**Architecture:** Add original content columns to track pre-edit state, create PATCH endpoint for edits with AI rewriting capability, build reusable EditableText component with floating toolbar for quick actions.

**Tech Stack:** Next.js 14, Supabase (Postgres), OpenAI GPT-4o-mini, shadcn/ui components, React portals for toolbar positioning.

## Progress (Last reviewed: 2025-12-21)

| Step | Status | Notes |
|------|--------|-------|
| Task 1: Database Migration | ✅ Complete | 20251219142319_add_editable_content_columns.sql |
| Task 2: Update Profile Generation | ✅ Complete | Implemented |
| Task 3: AI Rewrite Helper | ✅ Complete | b271b24c |
| Task 4: PATCH API Endpoint | ✅ Complete | src/app/api/tailored-profile/[opportunityId]/route.ts |
| Task 5: Revert API Endpoint | ✅ Complete | POST handler added |
| Task 6: Popover UI Component | ✅ Complete | shadcn/ui added |
| Task 7: Dropdown Menu Component | ✅ Complete | shadcn/ui added |
| Task 8: EditableText Component | ✅ Complete | a80abfd0 |
| Task 9: Regenerate Warning Dialog | ✅ Complete | Component created |
| Task 10: Integrate into TailoredProfile | ✅ Complete | 8f7bbd0c |
| Task 11: Make Summary Editable | ✅ Complete | Integrated |
| Task 12: Make Bullets Editable | ✅ Complete | Integrated |
| Task 13: Make Narrative Editable | ✅ Complete | Integrated |
| Task 14: Final Testing | ✅ Complete | 68918a47 - fixes applied |

---

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

---

## Task 1: Database Migration - Add Original Content Columns

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_editable_content_columns.sql`

**Step 1: Write the migration SQL**

```sql
-- Add columns to track original generated content and edited fields
ALTER TABLE tailored_profiles
ADD COLUMN IF NOT EXISTS resume_data_original jsonb,
ADD COLUMN IF NOT EXISTS narrative_original text,
ADD COLUMN IF NOT EXISTS edited_fields text[] DEFAULT '{}';

-- Backfill existing rows: copy current values to original columns
UPDATE tailored_profiles
SET
  resume_data_original = resume_data,
  narrative_original = narrative
WHERE resume_data_original IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN tailored_profiles.resume_data_original IS 'Snapshot of AI-generated resume at creation time';
COMMENT ON COLUMN tailored_profiles.narrative_original IS 'Snapshot of AI-generated narrative at creation time';
COMMENT ON COLUMN tailored_profiles.edited_fields IS 'Array of field paths that user has modified, e.g. ["summary", "experience.0.bullets.2"]';
```

**Step 2: Apply migration using Supabase MCP**

Use `mcp__supabase__apply_migration` with name `add_editable_content_columns`.

**Step 3: Regenerate TypeScript types**

Use `mcp__supabase__generate_typescript_types` and update `src/lib/supabase/types.ts`.

**Step 4: Commit**

```bash
git add supabase/migrations/ src/lib/supabase/types.ts
git commit -m "feat(db): add columns for tracking original content and edits"
```

---

## Task 2: Update Profile Generation to Populate Original Columns

**Files:**
- Modify: `src/app/api/generate-profile/route.ts:111-122`

**Step 1: Update the insert statement to populate original columns**

Find this code block:
```typescript
const { data: profile, error } = await supabase
  .from("tailored_profiles")
  .insert({
    user_id: user.id,
    opportunity_id: opportunityId,
    talking_points: talkingPoints as unknown as Json,
    narrative,
    resume_data: resumeData as unknown as Json,
  })
```

Replace with:
```typescript
const { data: profile, error } = await supabase
  .from("tailored_profiles")
  .insert({
    user_id: user.id,
    opportunity_id: opportunityId,
    talking_points: talkingPoints as unknown as Json,
    narrative,
    narrative_original: narrative,
    resume_data: resumeData as unknown as Json,
    resume_data_original: resumeData as unknown as Json,
    edited_fields: [],
  })
```

**Step 2: Verify dev server starts without errors**

Run: `npm run dev`
Expected: Server starts on port 3001

**Step 3: Commit**

```bash
git add src/app/api/generate-profile/route.ts
git commit -m "feat(api): populate original columns on profile generation"
```

---

## Task 3: Create AI Rewrite Helper Function

**Files:**
- Create: `src/lib/ai/rewrite-content.ts`

**Step 1: Create the rewrite function**

```typescript
import OpenAI from "openai";

const openai = new OpenAI();

export type ContentType = "bullet" | "summary" | "narrative";

interface RewriteOptions {
  content: string;
  contentType: ContentType;
  instruction: string;
  selection?: { start: number; end: number };
}

const CONTENT_TYPE_CONTEXT: Record<ContentType, string> = {
  bullet: "a resume bullet point describing a professional achievement",
  summary: "a professional summary for the top of a resume",
  narrative: "a cover letter paragraph",
};

export async function rewriteContent({
  content,
  contentType,
  instruction,
  selection,
}: RewriteOptions): Promise<string> {
  const context = CONTENT_TYPE_CONTEXT[contentType];

  let prompt: string;

  if (selection) {
    // Highlight-to-instruct: only rewrite selected portion
    const before = content.slice(0, selection.start);
    const selected = content.slice(selection.start, selection.end);
    const after = content.slice(selection.end);

    prompt = `You are editing ${context}.

The full text is:
"${content}"

The user has selected this portion:
"${selected}"

Instruction: ${instruction}

Rewrite ONLY the selected portion according to the instruction. Return the complete text with the rewritten portion in place. Do not change anything outside the selection.`;
  } else {
    // Full rewrite
    prompt = `You are editing ${context}.

Current text:
"${content}"

Instruction: ${instruction}

Rewrite the text according to the instruction. Keep similar length unless the instruction specifies otherwise. Return ONLY the rewritten text, no quotes or explanation.`;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content: "You are a professional resume and cover letter editor. Make precise edits as instructed. Preserve the original voice and style unless told otherwise.",
      },
      { role: "user", content: prompt },
    ],
  });

  const result = response.choices[0]?.message?.content;
  if (!result) {
    throw new Error("No response from OpenAI");
  }

  return result.trim();
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/ai/rewrite-content.ts
git commit -m "feat(ai): add content rewrite helper for editing"
```

---

## Task 4: Create PATCH API Endpoint for Edits

**Files:**
- Create: `src/app/api/tailored-profile/[opportunityId]/route.ts`

**Step 1: Create the API route with PATCH handler**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { rewriteContent, type ContentType } from "@/lib/ai/rewrite-content";
import type { Json } from "@/lib/supabase/types";

// Helper to get/set nested value in object using dot notation path
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current, key) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj as unknown);
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[key] as Record<string, unknown>;
    }
    return current;
  }, obj as Record<string, unknown>);

  if (target && typeof target === "object") {
    target[lastKey] = value;
  }
}

function inferContentType(field: string): ContentType {
  if (field === "narrative") return "narrative";
  if (field === "summary") return "summary";
  if (field.includes("bullets")) return "bullet";
  return "bullet"; // default
}

interface PatchBody {
  field: string;
  value?: string;
  instruction?: string;
  selection?: { start: number; end: number };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  const supabase = await createClient();
  const { opportunityId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: PatchBody = await request.json();
    const { field, value, instruction, selection } = body;

    if (!field) {
      return NextResponse.json({ error: "field is required" }, { status: 400 });
    }

    if (!value && !instruction) {
      return NextResponse.json(
        { error: "Either value or instruction is required" },
        { status: 400 }
      );
    }

    // Fetch current profile
    const { data: profile, error: fetchError } = await supabase
      .from("tailored_profiles")
      .select("*")
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunityId)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    let newValue: string;
    let wasAiGenerated = false;

    if (value !== undefined) {
      // Direct edit
      newValue = value;
    } else {
      // AI-assisted edit
      let currentContent: string;

      if (field === "narrative") {
        currentContent = profile.narrative || "";
      } else {
        // Field is in resume_data (e.g., "summary", "experience.0.bullets.2")
        const resumeData = profile.resume_data as Record<string, unknown>;
        currentContent = String(getNestedValue(resumeData, field) || "");
      }

      newValue = await rewriteContent({
        content: currentContent,
        contentType: inferContentType(field),
        instruction: instruction!,
        selection,
      });
      wasAiGenerated = true;
    }

    // Build update payload
    const editedFields = [...(profile.edited_fields || [])];
    if (!editedFields.includes(field)) {
      editedFields.push(field);
    }

    let updatePayload: Record<string, unknown> = { edited_fields: editedFields };

    if (field === "narrative") {
      updatePayload.narrative = newValue;
    } else {
      // Update nested field in resume_data
      const resumeData = { ...(profile.resume_data as Record<string, unknown>) };
      setNestedValue(resumeData, field, newValue);
      updatePayload.resume_data = resumeData as Json;
    }

    const { error: updateError } = await supabase
      .from("tailored_profiles")
      .update(updatePayload)
      .eq("id", profile.id);

    if (updateError) {
      console.error("Failed to update profile:", updateError);
      return NextResponse.json({ error: "Failed to save edit" }, { status: 500 });
    }

    return NextResponse.json({
      field,
      value: newValue,
      wasAiGenerated,
    });
  } catch (err) {
    console.error("Edit error:", err);
    return NextResponse.json({ error: "Failed to process edit" }, { status: 500 });
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/tailored-profile/
git commit -m "feat(api): add PATCH endpoint for editing tailored content"
```

---

## Task 5: Create Revert API Endpoint

**Files:**
- Modify: `src/app/api/tailored-profile/[opportunityId]/route.ts`

**Step 1: Add POST handler for revert**

Add this after the PATCH handler in the same file:

```typescript
interface RevertBody {
  field: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  const supabase = await createClient();
  const { opportunityId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: RevertBody = await request.json();
    const { field } = body;

    if (!field) {
      return NextResponse.json({ error: "field is required" }, { status: 400 });
    }

    // Fetch current profile with originals
    const { data: profile, error: fetchError } = await supabase
      .from("tailored_profiles")
      .select("*")
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunityId)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    let originalValue: string;
    let updatePayload: Record<string, unknown>;

    if (field === "narrative") {
      originalValue = profile.narrative_original || "";
      updatePayload = { narrative: originalValue };
    } else {
      // Get from resume_data_original
      const originalData = profile.resume_data_original as Record<string, unknown>;
      originalValue = String(getNestedValue(originalData, field) || "");

      // Update resume_data with original value
      const resumeData = { ...(profile.resume_data as Record<string, unknown>) };
      setNestedValue(resumeData, field, originalValue);
      updatePayload = { resume_data: resumeData as Json };
    }

    // Remove field from edited_fields
    const editedFields = (profile.edited_fields || []).filter((f: string) => f !== field);
    updatePayload.edited_fields = editedFields;

    const { error: updateError } = await supabase
      .from("tailored_profiles")
      .update(updatePayload)
      .eq("id", profile.id);

    if (updateError) {
      console.error("Failed to revert:", updateError);
      return NextResponse.json({ error: "Failed to revert" }, { status: 500 });
    }

    return NextResponse.json({
      field,
      value: originalValue,
    });
  } catch (err) {
    console.error("Revert error:", err);
    return NextResponse.json({ error: "Failed to revert" }, { status: 500 });
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/tailored-profile/
git commit -m "feat(api): add POST endpoint for reverting edits"
```

---

## Task 6: Create Popover UI Component

**Files:**
- Create: `src/components/ui/popover.tsx`

**Step 1: Install Radix popover**

Run: `npx shadcn@latest add popover`

If that doesn't work, create manually:

```typescript
"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
```

**Step 2: Install dependency if needed**

Run: `npm install @radix-ui/react-popover`

**Step 3: Commit**

```bash
git add src/components/ui/popover.tsx package.json package-lock.json
git commit -m "feat(ui): add popover component"
```

---

## Task 7: Create Dropdown Menu UI Component

**Files:**
- Create: `src/components/ui/dropdown-menu.tsx`

**Step 1: Install dropdown menu**

Run: `npx shadcn@latest add dropdown-menu`

**Step 2: Install dependency if needed**

Run: `npm install @radix-ui/react-dropdown-menu`

**Step 3: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx package.json package-lock.json
git commit -m "feat(ui): add dropdown menu component"
```

---

## Task 8: Create EditableText Component

**Files:**
- Create: `src/components/editable-text.tsx`

**Step 1: Create the EditableText component**

```typescript
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
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
    } catch {
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
    } catch {
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
    } catch {
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
      <div className={`group relative ${className}`}>
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
          className="opacity-0 group-hover:opacity-100 absolute -right-8 top-0 h-6 w-6 p-0"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
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
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/editable-text.tsx
git commit -m "feat(ui): add EditableText component with AI assistance"
```

---

## Task 9: Create Regenerate Warning Dialog

**Files:**
- Create: `src/components/regenerate-warning-dialog.tsx`

**Step 1: Create the dialog component**

```typescript
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
            You have {editedFieldCount} edited {editedFieldCount === 1 ? "field" : "fields"} that will be lost if you regenerate. This action cannot be undone.
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
```

**Step 2: Commit**

```bash
git add src/components/regenerate-warning-dialog.tsx
git commit -m "feat(ui): add regenerate warning dialog"
```

---

## Task 10: Integrate EditableText into TailoredProfile - Summary

**Files:**
- Modify: `src/components/tailored-profile.tsx`

**Step 1: Add imports at top of file**

Add after existing imports:
```typescript
import { EditableText } from "@/components/editable-text";
import { RegenerateWarningDialog } from "@/components/regenerate-warning-dialog";
```

**Step 2: Add state for edited fields and regenerate dialog**

Add after the `copied` state (around line 123):
```typescript
const [editedFields, setEditedFields] = useState<string[]>([]);
const [showRegenerateWarning, setShowRegenerateWarning] = useState(false);
```

**Step 3: Sync editedFields when profile loads**

Update the useEffect that fetches the profile (around line 126-144). After `setProfile(data.profile)` add:
```typescript
if (data.profile?.edited_fields) {
  setEditedFields(data.profile.edited_fields);
}
```

Also update generateProfile function to reset editedFields after regeneration. After `setProfile(data.profile)` add:
```typescript
setEditedFields([]);
```

**Step 4: Add handler functions**

Add after the `copyToClipboard` function:
```typescript
const handleContentUpdate = (newValue: string, field: string) => {
  if (!profile) return;

  if (field === "narrative") {
    setProfile({ ...profile, narrative: newValue });
  } else {
    const resumeData = { ...profile.resume_data };
    // Handle nested updates using the field path
    const keys = field.split(".");
    let current: Record<string, unknown> = resumeData as Record<string, unknown>;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = newValue;
    setProfile({ ...profile, resume_data: resumeData });
  }

  if (!editedFields.includes(field)) {
    setEditedFields([...editedFields, field]);
  }
};

const handleRevert = (field: string) => {
  setEditedFields(editedFields.filter((f) => f !== field));
};

const handleRegenerateClick = () => {
  if (editedFields.length > 0) {
    setShowRegenerateWarning(true);
  } else {
    generateProfile(true);
  }
};
```

**Step 5: Update the Regenerate button to use the warning**

Find the Regenerate button (around line 258-273) and change `onClick={() => generateProfile(true)}` to `onClick={handleRegenerateClick}`.

**Step 6: Add the warning dialog before the closing `</div>`**

Add before the final `</div>` of the component:
```tsx
<RegenerateWarningDialog
  open={showRegenerateWarning}
  onOpenChange={setShowRegenerateWarning}
  editedFieldCount={editedFields.length}
  onConfirm={() => generateProfile(true)}
/>
```

**Step 7: Commit**

```bash
git add src/components/tailored-profile.tsx
git commit -m "feat(ui): integrate EditableText setup and regenerate warning"
```

---

## Task 11: Make Professional Summary Editable

**Files:**
- Modify: `src/components/tailored-profile.tsx`

**Step 1: Replace the summary paragraph**

Find this code (around line 502-503):
```tsx
<p className="text-sm">{resume_data.summary}</p>
```

Replace with:
```tsx
<EditableText
  value={resume_data.summary}
  fieldPath="summary"
  contentType="summary"
  isEdited={editedFields.includes("summary")}
  opportunityId={opportunityId}
  onUpdate={handleContentUpdate}
  onRevert={handleRevert}
  className="text-sm"
  multiline
/>
```

**Step 2: Verify the UI displays correctly**

Run: `npm run dev`
Navigate to an opportunity with a generated profile and verify the summary is clickable.

**Step 3: Commit**

```bash
git add src/components/tailored-profile.tsx
git commit -m "feat(ui): make professional summary editable"
```

---

## Task 12: Make Experience Bullets Editable

**Files:**
- Modify: `src/components/tailored-profile.tsx`

**Step 1: Replace the bullet rendering in main experience**

Find this code (around line 535-544):
```tsx
{job.bullets.map((bullet, j) => (
  <li
    key={j}
    className="text-sm"
    dangerouslySetInnerHTML={{
      __html: bullet.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
    }}
  />
))}
```

Replace with:
```tsx
{job.bullets.map((bullet, j) => (
  <li key={j} className="text-sm">
    <EditableText
      value={bullet.replace(/\*\*(.*?)\*\*/g, "")}
      fieldPath={`experience.${i}.bullets.${j}`}
      contentType="bullet"
      isEdited={editedFields.includes(`experience.${i}.bullets.${j}`)}
      opportunityId={opportunityId}
      onUpdate={handleContentUpdate}
      onRevert={handleRevert}
    />
  </li>
))}
```

Note: We strip the bold markdown for editing since the EditableText handles plain text.

**Step 2: Do the same for additional experience bullets**

Find the similar code in additional experience section (around line 578-589) and make the same replacement, but use `additionalExperience.${i}.bullets.${j}` as the fieldPath.

**Step 3: Verify bullets are editable**

Run: `npm run dev`
Click on a bullet point and verify the edit popover appears.

**Step 4: Commit**

```bash
git add src/components/tailored-profile.tsx
git commit -m "feat(ui): make experience bullets editable"
```

---

## Task 13: Make Cover Letter Narrative Editable

**Files:**
- Modify: `src/components/tailored-profile.tsx`

**Step 1: Replace the narrative paragraph**

Find this code (around line 455-457):
```tsx
<p className="whitespace-pre-wrap text-sm leading-relaxed">
  {narrative}
</p>
```

Replace with:
```tsx
<EditableText
  value={narrative}
  fieldPath="narrative"
  contentType="narrative"
  isEdited={editedFields.includes("narrative")}
  opportunityId={opportunityId}
  onUpdate={handleContentUpdate}
  onRevert={handleRevert}
  className="whitespace-pre-wrap text-sm leading-relaxed"
  multiline
/>
```

**Step 2: Verify narrative is editable**

Run: `npm run dev`
Navigate to the Narrative tab and verify it's clickable.

**Step 3: Commit**

```bash
git add src/components/tailored-profile.tsx
git commit -m "feat(ui): make cover letter narrative editable"
```

---

## Task 14: Final Testing and Polish

**Files:**
- Various files for any fixes

**Step 1: Test complete editing flow**

1. Navigate to an opportunity with generated profile
2. Click on a bullet point - verify popover appears
3. Try direct editing - change text, click Done
4. Verify "edited" badge appears
5. Try AI action (e.g., "Shorten") - verify content updates
6. Try custom instruction
7. Try "Revert to Original" - verify content reverts and badge disappears
8. Make an edit, then click Regenerate - verify warning appears
9. Confirm regenerate - verify edits are lost and content regenerates

**Step 2: Test edge cases**

1. Empty content handling
2. Very long content
3. Rapid clicking between edit modes
4. Network error simulation (disable network, try save)

**Step 3: Fix any issues found during testing**

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete editable tailored content implementation"
```

---

## Summary

This plan implements:

1. **Database changes** - New columns for tracking original content and edit history
2. **API endpoints** - PATCH for edits (direct + AI), POST for revert
3. **AI helper** - Rewrite function with support for full and partial edits
4. **EditableText component** - Reusable editing UI with floating toolbar
5. **Quick actions** - Shorten, Expand, Add Metrics, etc.
6. **Custom instructions** - Free-form AI editing
7. **Revert capability** - Return to original AI-generated content
8. **Regenerate warning** - Protect users from losing edits

The implementation follows TDD principles where practical, commits frequently, and maintains a clean separation of concerns.
