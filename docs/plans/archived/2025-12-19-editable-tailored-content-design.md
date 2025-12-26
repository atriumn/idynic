# Editable Tailored Content Design

**Date:** 2025-12-19
**Status:** ✅ Implemented (2025-12-19)
**Last reviewed:** 2025-12-19

## Overview

Enable users to edit and refine AI-generated resumes, cover letters, and talking points for specific opportunities. Combines direct text editing with AI-assisted refinement through quick actions and natural language instructions.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Content scope | All content (bullets, summary, narrative) | Once editing pattern exists, extending to all types is low effort |
| Editing paradigm | Hybrid: direct + AI assist | Power users get control, others get AI help |
| AI invocation | Quick actions + highlight-to-instruct | Quick actions handle 80% of edits, highlight covers nuanced requests |
| Edit persistence | Local only (per opportunity) | Simpler architecture, avoids claim/evidence complexity |
| Regenerate behavior | Warn and replace | Simple, predictable, avoids merge complexity |
| Undo capability | Single undo per field | Safety net without version history complexity |
| Visual UX | Inline editing with floating toolbar | Fluid experience, well-understood pattern |

## Core Interaction Model

### View Mode (default)

Content displays as today - read-only with existing card/section styling. Each editable element (bullet, summary, narrative paragraph) shows a subtle edit icon on hover.

### Entering Edit Mode

Click any editable text or its edit icon. The text becomes an editable textarea/contenteditable, and a floating toolbar appears above or below the selection.

### Floating Toolbar Contents

- **Quick Actions** (icon buttons): Context-specific actions based on content type
- **AI Input**: Small text field for custom instructions
- **Actions**: "Apply" (for AI changes), "Revert to Original" (if modified), "Done"

### Direct Editing

User can simply type in the editable area. Changes are auto-saved on blur or when clicking "Done".

### AI-Assisted Editing

User either clicks a quick action OR types a custom instruction and clicks Apply. The content updates in place with a brief loading state. If they don't like it, they can undo, try another action, or manually edit the result.

### Visual Feedback

- Fields modified from original show a small "edited" indicator
- "Revert to Original" only appears for modified fields
- Subtle border/highlight on the active editable field

## Quick Actions by Content Type

### Resume Bullets

- **Shorten** - Condense without losing impact
- **Add Metrics** - Prompt to quantify achievements
- **Stronger Verbs** - Replace weak verbs with action verbs
- **Emphasize [Skill]** - Dropdown of skills from job requirements

### Professional Summary

- **Shorten / Expand** - Adjust length
- **More Confident** - Remove hedging language
- **Emphasize Fit** - Lean harder into requirement alignment

### Cover Letter Narrative

- **Shorten / Expand**
- **More Conversational / More Formal** - Adjust tone
- **Strengthen Opening** - Punch up the hook

## Highlight-to-Instruct

When user selects a portion of text within an editable field:

1. A mini toolbar appears near the selection
2. Shows: text input + "Apply" button
3. User types instruction ("make this more specific", "rephrase without jargon")
4. AI rewrites just the selected portion, preserving surrounding text

## Data Model

### Schema Changes

Add columns to `tailored_profiles` table:

```sql
ALTER TABLE tailored_profiles
ADD COLUMN resume_data_original jsonb,
ADD COLUMN narrative_original text,
ADD COLUMN edited_fields text[] DEFAULT '{}';
```

### How It Works

- **On generation**: `resume_data` and `resume_data_original` are identical
- **On edit**: Update `resume_data`, add field path to `edited_fields`
- **On revert**: Copy value from `_original` back to main field, remove from `edited_fields`
- **On regenerate**: Warn if `edited_fields` is non-empty, then overwrite everything

## API Design

### Edit Endpoint: `PATCH /api/tailored-profile/[opportunityId]`

```typescript
// Request body
{
  field: "summary" | "narrative" | "experience.0.bullets.2" | ...,
  value: string,           // for direct edits
  // OR
  instruction: string,     // for AI-assisted edits
  selection?: {            // for highlight-to-instruct
    start: number,
    end: number
  }
}

// Response
{
  field: string,
  value: string,
  wasAiGenerated: boolean
}
```

### Revert Endpoint: `POST /api/tailored-profile/[opportunityId]/revert`

```typescript
// Request
{ field: string }

// Response
{ field: string, value: string }
```

### AI Processing

- Lightweight prompt: "Rewrite the following [type] according to this instruction: {instruction}. Keep similar length unless told otherwise. Return only the rewritten text."
- For highlight-to-instruct: Only rewrites selected portion, returns full field with edit spliced in

## Frontend Components

### EditableText

Core building block wrapping any editable text.

**Props:**
- `value: string`
- `fieldPath: string` - e.g., "experience.0.bullets.2"
- `contentType: "bullet" | "summary" | "narrative"`
- `isEdited: boolean`
- `onSave: (value: string) => void`
- `onRevert: () => void`

**Responsibilities:**
- Manages view/edit state
- Renders textarea or contenteditable
- Shows "edited" badge when modified

### FloatingToolbar

Appears when editing is active.

**Responsibilities:**
- Positioned above/below active EditableText
- Contains quick action buttons filtered by contentType
- Contains AI instruction input field
- Handles loading state during AI calls
- Uses portal to avoid z-index issues

### SelectionToolbar

Appears on text selection within editable field.

**Responsibilities:**
- Smaller toolbar near selection
- Instruction input + Apply button
- Detects selection via onSelect event

### Integration Example

Current:
```tsx
<li>{bullet}</li>
```

Becomes:
```tsx
<EditableText
  value={bullet}
  fieldPath={`experience.${expIdx}.bullets.${bulletIdx}`}
  contentType="bullet"
  isEdited={editedFields.includes(`experience.${expIdx}.bullets.${bulletIdx}`)}
  onSave={handleSave}
  onRevert={handleRevert}
/>
```

## PDF Synchronization

- PDF generated client-side from `resume_data` - automatically reflects edits
- Editing only available in HTML view, not PDF preview
- Clicking "Edit" while in PDF view switches to HTML view
- No inline PDF editing - HTML is the editing surface, PDF is output

## Edge Cases

### Empty States

- User deletes all text → show "Empty bullet - add content or revert"
- Revert button always available as escape hatch

### Loading States

- While AI processing: spinner in toolbar, disable input, dim text
- No optimistic UI - wait for AI response

### Keyboard Shortcuts

- `Escape` - Cancel edit, revert to pre-edit state
- `Cmd+Enter` - Save and exit edit mode
- `Tab` - Move to next editable field (nice-to-have)

### Error Handling

- AI call fails → inline error in toolbar, keep user's text, allow retry
- Save fails → toast notification, keep edit mode open

### Mobile

- Floating toolbar fixed to bottom of screen
- Touch-and-hold to enter edit mode
- Selection toolbar optional on mobile initially
