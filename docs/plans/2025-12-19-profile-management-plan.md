# Profile Management Implementation Plan

> **Status:** 🔄 In Progress

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Profile page where users can view and edit their persistent career data (contact info, work history, ventures, skills, certifications, education).

**Architecture:** Server-side page that fetches profile data, with client-side section components for editing. Each section uses collapsible panels with inline edit mode. API routes handle CRUD operations with optimistic UI updates.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres), React Server Components for initial load, Client Components for interactivity, shadcn/ui (Collapsible, Card, Input, Button, Badge).

---

## Progress (Last reviewed: 2025-12-20)

| Step | Status | Notes |
|------|--------|-------|
| Task 1: Database Migration - Add New Columns | ✅ Complete | Commit 56b98ee1 |
| Task 2: Create GET /api/profile Endpoint | ⏳ Not Started | |
| Task 3: Create PATCH /api/profile/contact Endpoint | ⏳ Not Started | |
| Task 4: Create Work History CRUD Endpoints | ⏳ Not Started | |
| Task 5: Create Profile Page Shell | ✅ Complete | Profile page exists |
| Task 6: Implement Contact Info Section | ⏳ Not Started | |
| Task 7: Implement Work History Section | ⏳ Not Started | |
| Task 8: Implement Ventures Section | ✅ Complete | Commit 3a321a76 |
| Task 9: Implement Skills Section | ✅ Complete | Commit 755483b5 |
| Task 10: Implement Certifications Section | ✅ Complete | Commit e5d1a5d2 |
| Task 11: Implement Education Section | ✅ Complete | Commit 454ac212 |
| Task 12: Final Polish and Testing | 🔄 In Progress | UX improvements applied (dc2d6a6e) |

### Drift Notes
- Implementation order differed from plan - UI sections were built before some API routes
- Ventures, Skills, Certifications, and Education sections completed ahead of Contact Info and Work History
- UX improvements applied (commit dc2d6a6e)

---

## Task 1: Database Migration - Add New Columns

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_profile_management_columns.sql`

**Step 1: Write the migration SQL**

```sql
-- Add logo_url to profiles for personal branding
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url text;
COMMENT ON COLUMN profiles.logo_url IS 'URL to user personal logo/branding image for resume header';

-- Add source tracking to identity_claims
ALTER TABLE identity_claims ADD COLUMN IF NOT EXISTS source text DEFAULT 'extracted'
  CHECK (source IN ('extracted', 'manual'));
COMMENT ON COLUMN identity_claims.source IS 'Whether claim was extracted from documents or manually added by user';
```

**Step 2: Apply migration using Supabase MCP**

Use `mcp__supabase__apply_migration` with name `profile_management_columns`.

**Step 3: Regenerate TypeScript types**

Use `mcp__supabase__generate_typescript_types` and update `src/lib/supabase/types.ts`.

**Step 4: Commit**

```bash
git add supabase/migrations/ src/lib/supabase/types.ts
git commit -m "feat(db): add logo_url and source columns for profile management"
```

---

## Task 2: Create GET /api/profile Endpoint

**Files:**
- Create: `src/app/api/profile/route.ts`

**Step 1: Create the API route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all profile data in parallel
  const [
    { data: profile },
    { data: workHistory },
    { data: ventures },
    { data: skills },
    { data: certifications },
    { data: education },
  ] = await Promise.all([
    // Contact info from profiles
    supabase
      .from("profiles")
      .select("name, email, phone, location, linkedin, github, website, logo_url")
      .eq("id", user.id)
      .single(),

    // Work history (excluding ventures)
    supabase
      .from("work_history")
      .select("id, company, title, start_date, end_date, location, summary, company_domain, order_index")
      .eq("user_id", user.id)
      .or("entry_type.is.null,entry_type.in.(work,additional)")
      .order("order_index", { ascending: true }),

    // Ventures
    supabase
      .from("work_history")
      .select("id, company, title, start_date, end_date, location, summary, company_domain, order_index")
      .eq("user_id", user.id)
      .eq("entry_type", "venture")
      .order("order_index", { ascending: true }),

    // Skills from identity_claims
    supabase
      .from("identity_claims")
      .select("id, label, description, confidence, source")
      .eq("user_id", user.id)
      .eq("type", "skill")
      .order("confidence", { ascending: false }),

    // Certifications from evidence
    supabase
      .from("evidence")
      .select("id, text, context")
      .eq("user_id", user.id)
      .eq("evidence_type", "certification")
      .order("created_at", { ascending: false }),

    // Education from evidence
    supabase
      .from("evidence")
      .select("id, text, context")
      .eq("user_id", user.id)
      .eq("evidence_type", "education")
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    contact: profile || {},
    workHistory: workHistory || [],
    ventures: ventures || [],
    skills: skills || [],
    certifications: certifications || [],
    education: education || [],
  });
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Test endpoint manually**

Run: `npm run dev`
Then: `curl http://localhost:3001/api/profile` (with auth cookie)

**Step 4: Commit**

```bash
git add src/app/api/profile/route.ts
git commit -m "feat(api): add GET /api/profile endpoint for aggregated profile data"
```

---

## Task 3: Create PATCH /api/profile/contact Endpoint

**Files:**
- Create: `src/app/api/profile/contact/route.ts`

**Step 1: Create the contact update route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface ContactUpdateBody {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  logo_url?: string;
}

const ALLOWED_FIELDS = ["name", "email", "phone", "location", "linkedin", "github", "website", "logo_url"];

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: ContactUpdateBody = await request.json();

    // Filter to only allowed fields
    const updates: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.includes(key)) {
        updates[key] = value ?? null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Validate URL fields
    const urlFields = ["linkedin", "github", "website", "logo_url"];
    for (const field of urlFields) {
      if (updates[field]) {
        try {
          new URL(updates[field]!);
        } catch {
          return NextResponse.json({ error: `Invalid URL for ${field}` }, { status: 400 });
        }
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update contact:", error);
      return NextResponse.json({ error: "Failed to update contact info" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Contact update error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/profile/contact/route.ts
git commit -m "feat(api): add PATCH /api/profile/contact for contact info updates"
```

---

## Task 4: Create Work History CRUD Endpoints

**Files:**
- Create: `src/app/api/profile/work-history/route.ts`
- Create: `src/app/api/profile/work-history/[id]/route.ts`

**Step 1: Create the list/create route**

```typescript
// src/app/api/profile/work-history/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface WorkHistoryCreateBody {
  company: string;
  title: string;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  summary?: string | null;
  company_domain?: string | null;
  entry_type?: "work" | "venture" | "additional";
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: WorkHistoryCreateBody = await request.json();

    if (!body.company || !body.title || !body.start_date) {
      return NextResponse.json(
        { error: "company, title, and start_date are required" },
        { status: 400 }
      );
    }

    // Get max order_index for this user
    const { data: maxOrder } = await supabase
      .from("work_history")
      .select("order_index")
      .eq("user_id", user.id)
      .order("order_index", { ascending: false })
      .limit(1)
      .single();

    const nextOrderIndex = (maxOrder?.order_index ?? -1) + 1;

    // Need document_id - use the most recent resume document
    const { data: document } = await supabase
      .from("documents")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "resume")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!document) {
      return NextResponse.json(
        { error: "No resume document found. Upload a resume first." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("work_history")
      .insert({
        user_id: user.id,
        document_id: document.id,
        company: body.company,
        title: body.title,
        start_date: body.start_date,
        end_date: body.end_date || null,
        location: body.location || null,
        summary: body.summary || null,
        company_domain: body.company_domain || null,
        entry_type: body.entry_type || "work",
        order_index: nextOrderIndex,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create work history:", error);
      return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Work history create error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
```

**Step 2: Create the update/delete route**

```typescript
// src/app/api/profile/work-history/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface WorkHistoryUpdateBody {
  company?: string;
  title?: string;
  start_date?: string;
  end_date?: string | null;
  location?: string | null;
  summary?: string | null;
  company_domain?: string | null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: WorkHistoryUpdateBody = await request.json();

    const { data, error } = await supabase
      .from("work_history")
      .update(body)
      .eq("id", id)
      .eq("user_id", user.id) // Security: only update own records
      .select()
      .single();

    if (error) {
      console.error("Failed to update work history:", error);
      return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Work history update error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Note: We do NOT cascade delete evidence - it's still valid career data
  const { error } = await supabase
    .from("work_history")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to delete work history:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/profile/work-history/
git commit -m "feat(api): add CRUD endpoints for work history"
```

---

## Task 5: Create Skills CRUD Endpoints

**Files:**
- Create: `src/app/api/profile/skills/route.ts`
- Create: `src/app/api/profile/skills/[id]/route.ts`

**Step 1: Create the list/create route**

```typescript
// src/app/api/profile/skills/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface SkillCreateBody {
  label: string;
  description?: string | null;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: SkillCreateBody = await request.json();

    if (!body.label || body.label.trim() === "") {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }

    const normalizedLabel = body.label.trim();

    // Check for duplicate
    const { data: existing } = await supabase
      .from("identity_claims")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "skill")
      .ilike("label", normalizedLabel)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Skill already exists" }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("identity_claims")
      .insert({
        user_id: user.id,
        type: "skill",
        label: normalizedLabel,
        description: body.description || null,
        confidence: 1.0, // User-added = high confidence
        source: "manual",
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create skill:", error);
      return NextResponse.json({ error: "Failed to create skill" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Skill create error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
```

**Step 2: Create the update/delete route**

```typescript
// src/app/api/profile/skills/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface SkillUpdateBody {
  label?: string;
  description?: string | null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: SkillUpdateBody = await request.json();

    if (body.label !== undefined && body.label.trim() === "") {
      return NextResponse.json({ error: "label cannot be empty" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.label) updates.label = body.label.trim();
    if (body.description !== undefined) updates.description = body.description;

    const { data, error } = await supabase
      .from("identity_claims")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("type", "skill")
      .select()
      .single();

    if (error) {
      console.error("Failed to update skill:", error);
      return NextResponse.json({ error: "Failed to update skill" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Skill update error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // First delete any claim_evidence links
  await supabase.from("claim_evidence").delete().eq("claim_id", id);

  const { error } = await supabase
    .from("identity_claims")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("type", "skill");

  if (error) {
    console.error("Failed to delete skill:", error);
    return NextResponse.json({ error: "Failed to delete skill" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/profile/skills/
git commit -m "feat(api): add CRUD endpoints for skills"
```

---

## Task 6: Create Certifications CRUD Endpoints

**Files:**
- Create: `src/app/api/profile/certifications/route.ts`
- Create: `src/app/api/profile/certifications/[id]/route.ts`

**Step 1: Create the list/create route**

```typescript
// src/app/api/profile/certifications/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";

interface CertificationCreateBody {
  name: string;
  issuer?: string | null;
  date?: string | null;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: CertificationCreateBody = await request.json();

    if (!body.name || body.name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const context: Json = {
      issuer: body.issuer || null,
      date: body.date || null,
      source: "manual",
    };

    const { data, error } = await supabase
      .from("evidence")
      .insert({
        user_id: user.id,
        evidence_type: "certification",
        text: body.name.trim(),
        context,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create certification:", error);
      return NextResponse.json({ error: "Failed to create certification" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Certification create error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
```

**Step 2: Create the update/delete route**

```typescript
// src/app/api/profile/certifications/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";

interface CertificationUpdateBody {
  name?: string;
  issuer?: string | null;
  date?: string | null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: CertificationUpdateBody = await request.json();

    // First get existing to merge context
    const { data: existing } = await supabase
      .from("evidence")
      .select("text, context")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("evidence_type", "certification")
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    const existingContext = (existing.context as Record<string, unknown>) || {};
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updates.text = body.name.trim();
    }

    const newContext: Json = {
      ...existingContext,
      ...(body.issuer !== undefined && { issuer: body.issuer }),
      ...(body.date !== undefined && { date: body.date }),
    };
    updates.context = newContext;

    const { data, error } = await supabase
      .from("evidence")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("evidence_type", "certification")
      .select()
      .single();

    if (error) {
      console.error("Failed to update certification:", error);
      return NextResponse.json({ error: "Failed to update certification" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Certification update error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("evidence")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("evidence_type", "certification");

  if (error) {
    console.error("Failed to delete certification:", error);
    return NextResponse.json({ error: "Failed to delete certification" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/profile/certifications/
git commit -m "feat(api): add CRUD endpoints for certifications"
```

---

## Task 7: Create Education CRUD Endpoints

**Files:**
- Create: `src/app/api/profile/education/route.ts`
- Create: `src/app/api/profile/education/[id]/route.ts`

**Step 1: Create the list/create route**

```typescript
// src/app/api/profile/education/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";

interface EducationCreateBody {
  school: string;
  degree?: string | null;
  field?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: EducationCreateBody = await request.json();

    if (!body.school || body.school.trim() === "") {
      return NextResponse.json({ error: "school is required" }, { status: 400 });
    }

    // Build display text
    const parts = [body.school.trim()];
    if (body.degree) parts.push(body.degree);
    if (body.field) parts.push(`in ${body.field}`);
    const text = parts.join(", ");

    const context: Json = {
      school: body.school.trim(),
      degree: body.degree || null,
      field: body.field || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      source: "manual",
    };

    const { data, error } = await supabase
      .from("evidence")
      .insert({
        user_id: user.id,
        evidence_type: "education",
        text,
        context,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create education:", error);
      return NextResponse.json({ error: "Failed to create education entry" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Education create error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
```

**Step 2: Create the update/delete route**

```typescript
// src/app/api/profile/education/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";

interface EducationUpdateBody {
  school?: string;
  degree?: string | null;
  field?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: EducationUpdateBody = await request.json();

    // First get existing to merge context
    const { data: existing } = await supabase
      .from("evidence")
      .select("context")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("evidence_type", "education")
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Education entry not found" }, { status: 404 });
    }

    const existingContext = (existing.context as Record<string, unknown>) || {};

    const newContext: Record<string, unknown> = {
      ...existingContext,
      ...(body.school !== undefined && { school: body.school }),
      ...(body.degree !== undefined && { degree: body.degree }),
      ...(body.field !== undefined && { field: body.field }),
      ...(body.start_date !== undefined && { start_date: body.start_date }),
      ...(body.end_date !== undefined && { end_date: body.end_date }),
    };

    // Rebuild display text
    const school = (newContext.school as string) || "";
    const parts = [school];
    if (newContext.degree) parts.push(newContext.degree as string);
    if (newContext.field) parts.push(`in ${newContext.field}`);
    const text = parts.join(", ");

    const { data, error } = await supabase
      .from("evidence")
      .update({ text, context: newContext as Json })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("evidence_type", "education")
      .select()
      .single();

    if (error) {
      console.error("Failed to update education:", error);
      return NextResponse.json({ error: "Failed to update education entry" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Education update error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("evidence")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("evidence_type", "education");

  if (error) {
    console.error("Failed to delete education:", error);
    return NextResponse.json({ error: "Failed to delete education entry" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/profile/education/
git commit -m "feat(api): add CRUD endpoints for education"
```

---

## Task 8: Add Profile Link to Navigation

**Files:**
- Modify: `src/components/nav.tsx:40-53`

**Step 1: Add Profile nav link**

Find this code block:
```typescript
{user && (
  <div className="flex items-center gap-4">
    <Link
      href="/identity"
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      Identity
    </Link>
    <Link
      href="/opportunities"
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      Opportunities
    </Link>
  </div>
)}
```

Replace with:
```typescript
{user && (
  <div className="flex items-center gap-4">
    <Link
      href="/profile"
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      Profile
    </Link>
    <Link
      href="/identity"
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      Identity
    </Link>
    <Link
      href="/opportunities"
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      Opportunities
    </Link>
  </div>
)}
```

**Step 2: Verify the nav renders correctly**

Run: `npm run dev`
Expected: "Profile" link appears in navigation

**Step 3: Commit**

```bash
git add src/components/nav.tsx
git commit -m "feat(ui): add Profile link to navigation"
```

---

## Task 9: Create Profile Page Shell

**Files:**
- Create: `src/app/profile/page.tsx`

**Step 1: Create the page component**

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileContent } from "@/components/profile/profile-content";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Your Profile</h1>
        <p className="text-muted-foreground">
          Your Profile is the source of truth about your career. This data feeds into every
          tailored resume. Edit your work history, contact info, skills, and certifications here.
          Changes apply to all future resumes.
        </p>
      </div>

      <ProfileContent />
    </div>
  );
}
```

**Step 2: Create the client-side wrapper component**

```typescript
// src/components/profile/profile-content.tsx
"use client";

import { useEffect, useState } from "react";
import { ContactSection } from "@/components/profile/contact-section";
import { WorkHistorySection } from "@/components/profile/work-history-section";
import { VenturesSection } from "@/components/profile/ventures-section";
import { SkillsSection } from "@/components/profile/skills-section";
import { CertificationsSection } from "@/components/profile/certifications-section";
import { EducationSection } from "@/components/profile/education-section";
import { Skeleton } from "@/components/ui/skeleton";

interface ProfileData {
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
    logo_url?: string;
  };
  workHistory: Array<{
    id: string;
    company: string;
    title: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
    summary: string | null;
    company_domain: string | null;
    order_index: number;
  }>;
  ventures: Array<{
    id: string;
    company: string;
    title: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
    summary: string | null;
    company_domain: string | null;
    order_index: number;
  }>;
  skills: Array<{
    id: string;
    label: string;
    description: string | null;
    confidence: number;
    source: string;
  }>;
  certifications: Array<{
    id: string;
    text: string;
    context: { issuer?: string; date?: string } | null;
  }>;
  education: Array<{
    id: string;
    text: string;
    context: { school?: string; degree?: string; field?: string; start_date?: string; end_date?: string } | null;
  }>;
}

export function ProfileContent() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch("/api/profile");
        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }
        const data = await response.json();
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="space-y-6">
      <ContactSection
        contact={profile.contact}
        onUpdate={(contact) => setProfile({ ...profile, contact })}
      />
      <WorkHistorySection
        items={profile.workHistory}
        onUpdate={(workHistory) => setProfile({ ...profile, workHistory })}
      />
      <VenturesSection
        items={profile.ventures}
        onUpdate={(ventures) => setProfile({ ...profile, ventures })}
      />
      <SkillsSection
        items={profile.skills}
        onUpdate={(skills) => setProfile({ ...profile, skills })}
      />
      <CertificationsSection
        items={profile.certifications}
        onUpdate={(certifications) => setProfile({ ...profile, certifications })}
      />
      <EducationSection
        items={profile.education}
        onUpdate={(education) => setProfile({ ...profile, education })}
      />
    </div>
  );
}
```

**Step 3: Create placeholder section components**

Create empty placeholder files that we'll implement in subsequent tasks:

```typescript
// src/components/profile/contact-section.tsx
"use client";

export function ContactSection({ contact, onUpdate }: { contact: Record<string, string | undefined>; onUpdate: (contact: Record<string, string | undefined>) => void }) {
  return <div className="border rounded-lg p-4">Contact Section (placeholder)</div>;
}
```

Create similar placeholders for:
- `work-history-section.tsx`
- `ventures-section.tsx`
- `skills-section.tsx`
- `certifications-section.tsx`
- `education-section.tsx`

**Step 4: Verify the page renders**

Run: `npm run dev`
Navigate to `/profile`
Expected: Page loads with header text and placeholder sections

**Step 5: Commit**

```bash
git add src/app/profile/ src/components/profile/
git commit -m "feat(ui): add profile page shell with section placeholders"
```

---

## Task 10: Implement Contact Section

**Files:**
- Modify: `src/components/profile/contact-section.tsx`

**Step 1: Implement the full component**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ContactData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  logo_url?: string;
}

interface ContactSectionProps {
  contact: ContactData;
  onUpdate: (contact: ContactData) => void;
}

const FIELD_LABELS: Record<keyof ContactData, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  location: "Location",
  linkedin: "LinkedIn",
  github: "GitHub",
  website: "Website",
  logo_url: "Logo URL",
};

export function ContactSection({ contact, onUpdate }: ContactSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ContactData>(contact);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/profile/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      const updated = await response.json();
      onUpdate(updated);
      setIsEditing(false);
      toast.success("Contact info updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData(contact);
    setIsEditing(false);
  };

  const fields: (keyof ContactData)[] = ["name", "email", "phone", "location", "linkedin", "github", "website", "logo_url"];

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:text-foreground transition-colors">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle className="text-lg">Contact Info</CardTitle>
            </CollapsibleTrigger>
            {!isEditing && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={field}>{FIELD_LABELS[field]}</Label>
                      <Input
                        id={field}
                        type={field === "email" ? "email" : field.includes("url") || field === "linkedin" || field === "github" || field === "website" ? "url" : "text"}
                        value={editData[field] || ""}
                        onChange={(e) => setEditData({ ...editData, [field]: e.target.value || undefined })}
                        placeholder={`Enter ${FIELD_LABELS[field].toLowerCase()}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <dl className="grid gap-2 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field}>
                    <dt className="text-sm font-medium text-muted-foreground">{FIELD_LABELS[field]}</dt>
                    <dd className="text-sm">
                      {contact[field] ? (
                        field.includes("url") || field === "linkedin" || field === "github" || field === "website" ? (
                          <a href={contact[field]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {contact[field]}
                          </a>
                        ) : (
                          contact[field]
                        )
                      ) : (
                        <span className="text-muted-foreground/50">Not set</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
```

**Step 2: Verify the component renders and edits work**

Run: `npm run dev`
Navigate to `/profile`
Test: Click Edit, change a field, click Save

**Step 3: Commit**

```bash
git add src/components/profile/contact-section.tsx
git commit -m "feat(ui): implement contact info section with edit functionality"
```

---

## Task 11: Implement Work History Section

**Files:**
- Modify: `src/components/profile/work-history-section.tsx`

**Step 1: Implement the full component**

```typescript
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
```

**Step 2: Add alert-dialog component if not present**

Run: `npx shadcn@latest add alert-dialog`

**Step 3: Verify TypeScript compilation and functionality**

Run: `npm run dev`
Navigate to `/profile`
Test: Edit mode, add/edit/delete work history items

**Step 4: Commit**

```bash
git add src/components/profile/work-history-section.tsx src/components/ui/
git commit -m "feat(ui): implement work history section with full CRUD"
```

---

## Task 12: Implement Ventures Section

**Files:**
- Modify: `src/components/profile/ventures-section.tsx`

**Step 1: Implement the component (reuses Work History pattern)**

Copy the work-history-section.tsx and modify:
- Change title to "Ventures & Projects"
- Change API endpoint to pass `entry_type: "venture"`
- Change empty state icon and text
- Change labels from "Work History" to "Venture"

```typescript
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
  Rocket
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

interface VentureItem {
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

interface VenturesSectionProps {
  items: VentureItem[];
  onUpdate: (items: VentureItem[]) => void;
}

const EMPTY_ITEM: Omit<VentureItem, "id" | "order_index"> = {
  company: "",
  title: "",
  start_date: "",
  end_date: null,
  location: null,
  summary: null,
  company_domain: null,
};

export function VenturesSection({ items, onUpdate }: VenturesSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<VentureItem>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (item: VentureItem) => {
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
      toast.success("Venture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newItem.company || !newItem.title || !newItem.start_date) {
      toast.error("Name, role, and start date are required");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/profile/work-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newItem, entry_type: "venture" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add");
      }

      const added = await response.json();
      onUpdate([...items, added]);
      setIsAdding(false);
      setNewItem(EMPTY_ITEM);
      toast.success("Venture added");
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
      toast.success("Venture deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsSaving(false);
      setDeleteId(null);
    }
  };

  const renderForm = (
    data: Partial<VentureItem>,
    setData: (data: Partial<VentureItem>) => void,
    onSave: () => void,
    onCancel: () => void
  ) => (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            value={data.company || ""}
            onChange={(e) => setData({ ...data, company: e.target.value })}
            placeholder="Venture/project name"
          />
        </div>
        <div className="space-y-2">
          <Label>Role *</Label>
          <Input
            value={data.title || ""}
            onChange={(e) => setData({ ...data, title: e.target.value })}
            placeholder="Your role (e.g., Founder)"
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
          <Label>End Date / Status</Label>
          <Input
            value={data.end_date || ""}
            onChange={(e) => setData({ ...data, end_date: e.target.value || null })}
            placeholder="e.g., Active, Acquired, Dec 2023"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Website Domain (for logo)</Label>
          <Input
            value={data.company_domain || ""}
            onChange={(e) => setData({ ...data, company_domain: e.target.value || null })}
            placeholder="e.g., myproject.com"
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
                <CardTitle className="text-lg">Ventures & Projects ({items.length})</CardTitle>
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
                  <Rocket className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No ventures or side projects yet. Add one?</p>
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
                          <img
                            src={`https://logo.clearbit.com/${item.company_domain}`}
                            alt=""
                            className="w-10 h-10 rounded object-contain bg-white"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        )}
                        <div>
                          <h4 className="font-medium">{item.company}</h4>
                          <p className="text-sm text-muted-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.start_date} - {item.end_date || "Active"}
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
                  Add Venture
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete venture?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this entry from your profile.
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
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/profile/ventures-section.tsx
git commit -m "feat(ui): implement ventures section with full CRUD"
```

---

## Task 13: Implement Skills Section

**Files:**
- Modify: `src/components/profile/skills-section.tsx`

**Step 1: Implement the component (tag-based UI)**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Pencil, Plus, X, Loader2, Sparkles } from "lucide-react";
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
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle className="text-lg">Skills ({items.length})</CardTitle>
            </CollapsibleTrigger>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
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
                    <p className="text-xs text-muted-foreground mb-2">From your resume</p>
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
                    <p className="text-xs text-muted-foreground mb-2">Manually added</p>
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
                <Button onClick={handleAdd} disabled={!newSkill.trim() || isAdding}>
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/profile/skills-section.tsx
git commit -m "feat(ui): implement skills section with add/delete"
```

---

## Task 14: Implement Certifications Section

**Files:**
- Modify: `src/components/profile/certifications-section.tsx`

**Step 1: Implement the component**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Check, X, Loader2, Award } from "lucide-react";
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

export function CertificationsSection({ items, onUpdate }: CertificationsSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name: string; issuer: string; date: string }>({ name: "", issuer: "", date: "" });
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
    onCancel: () => void
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
                <CardTitle className="text-lg">Certifications ({items.length})</CardTitle>
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
                  <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No certifications yet. Add one?</p>
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
                          setEditData({ name: "", issuer: "", date: "" });
                        }
                      )}
                    </div>
                  ) : (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{item.text}</p>
                        <p className="text-sm text-muted-foreground">
                          {[item.context?.issuer, item.context?.date].filter(Boolean).join(" · ") || "No details"}
                        </p>
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
                  setNewItem,
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
                  Add Certification
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
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
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/profile/certifications-section.tsx
git commit -m "feat(ui): implement certifications section with full CRUD"
```

---

## Task 15: Implement Education Section

**Files:**
- Modify: `src/components/profile/education-section.tsx`

**Step 1: Implement the component (similar to certifications)**

```typescript
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
  const [isEditing, setIsEditing] = useState(false);
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
                  setNewItem,
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
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/profile/education-section.tsx
git commit -m "feat(ui): implement education section with full CRUD"
```

---

## Task 16: Final Integration and Testing

**Files:**
- Various files for any fixes

**Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors (or only warnings)

**Step 3: Test the complete flow**

1. Navigate to `/profile`
2. Verify all sections load with data
3. Test Contact Info: Edit, change fields, save
4. Test Work History: Add new entry, edit existing, delete one
5. Test Ventures: Add new venture, edit, delete
6. Test Skills: Add new skill, delete skills
7. Test Certifications: Add, edit, delete
8. Test Education: Add, edit, delete
9. Verify changes persist after page refresh

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete profile management implementation"
```

---

## Summary

This plan implements:

1. **Database changes** - `logo_url` on profiles, `source` on identity_claims
2. **API endpoints** - GET /api/profile, PATCH/POST/DELETE for each entity type
3. **Navigation** - Profile link added to main nav
4. **Profile page** - Server component with client-side sections
5. **Six section components** - Contact, Work History, Ventures, Skills, Certifications, Education
6. **Full CRUD** - Create, read, update, delete for all entity types
7. **Consistent UX** - Collapsible sections, edit mode toggle, inline forms, confirmation dialogs

Total: 16 tasks, approximately 15-20 files created/modified.
