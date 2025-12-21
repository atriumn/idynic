# Profile Sharing Implementation Plan

> **Status:** ✅ COMPLETE (2025-12-19)

**Goal:** Enable candidates to share private, tailored profile links with recruiters and hiring managers.

**Architecture:** Public share links use unguessable tokens. Shared profile pages are server-rendered without auth. View tracking logs timestamps. Recruiter waitlist is a simple email capture.

**Tech Stack:** Next.js 14, Supabase (Postgres + RLS), React Server Components, TailwindCSS

## Progress (Last reviewed: 2025-12-21)

| Step | Status | Notes |
|------|--------|-------|
| Task 1: Database Migration | ✅ Complete | 44545709 |
| Task 2: API - Create/List Links | ✅ Complete | 5dbc9aa4 |
| Task 3: API - Update/Delete Links | ✅ Complete | 703f0533 |
| Task 4: Public Shared Access | ✅ Complete | 359d7b1e |
| Task 5: Recruiter Waitlist API | ✅ Complete | 91df6631 |
| Task 6: Share Modal Component | ✅ Complete | 02e7e57d |
| Task 7: Integrate Share Button | ✅ Complete | d8d889b7 |
| Task 8: Shared Links Dashboard | ✅ Complete | 7ba6c1a7 |
| Task 9: Shared Links Table | ✅ Complete | c218e1e9 |
| Task 10: Navigation Update | ✅ Complete | 4ad86c46 |
| Task 11: Public Shared Page | ✅ Complete | 7e7e1274 |
| Task 12: Resume Download | ✅ Complete | b8730ad7 |
| Task 13: Recruiter CTA | ✅ Complete | 424616d8 |
| Task 14: Recruiters Landing | ✅ Complete | 0707fb94 |
| Task 15: Verification | ✅ Complete | UI tested |

### Additional Fixes Applied
- 659c031c: Use SECURITY DEFINER function for shared profile access
- d27b757f: Match shared profile page to main app styling
- 598f3442: Render bold emphasis in resume bullets
- ee965f3f: Move Profile and Shared Links to user dropdown

---

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

---

## Task 1: Database Migration - Core Tables

**Files:**
- Create: `supabase/migrations/20251219200000_shared_links.sql`

**Step 1: Write the migration**

```sql
-- Create shared_links table
CREATE TABLE public.shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tailored_profile_id UUID NOT NULL REFERENCES public.tailored_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token VARCHAR(32) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One link per tailored profile
  CONSTRAINT unique_tailored_profile_link UNIQUE (tailored_profile_id)
);

-- Create shared_link_views table
CREATE TABLE public.shared_link_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_link_id UUID NOT NULL REFERENCES public.shared_links(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create recruiter_waitlist table
CREATE TABLE public.recruiter_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_shared_links_token ON public.shared_links(token);
CREATE INDEX idx_shared_links_user_id ON public.shared_links(user_id);
CREATE INDEX idx_shared_link_views_shared_link_id ON public.shared_link_views(shared_link_id);

-- RLS for shared_links
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

-- Users can manage their own links
CREATE POLICY "Users can view own shared_links"
  ON public.shared_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shared_links"
  ON public.shared_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shared_links"
  ON public.shared_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared_links"
  ON public.shared_links FOR DELETE
  USING (auth.uid() = user_id);

-- Public can read by token (for share page) - non-revoked, non-expired only
CREATE POLICY "Public can read active links by token"
  ON public.shared_links FOR SELECT
  USING (
    revoked_at IS NULL
    AND expires_at > now()
  );

-- RLS for shared_link_views
ALTER TABLE public.shared_link_views ENABLE ROW LEVEL SECURITY;

-- Users can view views for their links
CREATE POLICY "Users can view own link views"
  ON public.shared_link_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_links sl
      WHERE sl.id = shared_link_id AND sl.user_id = auth.uid()
    )
  );

-- Public can insert views (for tracking)
CREATE POLICY "Anyone can insert views"
  ON public.shared_link_views FOR INSERT
  WITH CHECK (true);

-- RLS for recruiter_waitlist
ALTER TABLE public.recruiter_waitlist ENABLE ROW LEVEL SECURITY;

-- Public can insert (no read access)
CREATE POLICY "Anyone can join waitlist"
  ON public.recruiter_waitlist FOR INSERT
  WITH CHECK (true);
```

**Step 2: Apply the migration**

Run: `npx supabase db push` (if using remote) or migration will auto-apply

**Step 3: Regenerate TypeScript types**

Run: `npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts`

**Step 4: Commit**

```bash
git add supabase/migrations/20251219200000_shared_links.sql
git commit -m "feat(db): add shared_links, shared_link_views, recruiter_waitlist tables"
```

---

## Task 2: API Route - Create/List Shared Links

**Files:**
- Create: `src/app/api/shared-links/route.ts`

**Step 1: Create the API route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

// GET - List user's shared links with view counts
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: links, error } = await supabase
    .from("shared_links")
    .select(`
      id,
      token,
      expires_at,
      revoked_at,
      created_at,
      tailored_profile_id,
      tailored_profiles!inner (
        id,
        opportunity_id,
        opportunities!inner (
          id,
          title,
          company
        )
      ),
      shared_link_views (
        id,
        viewed_at
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch shared links:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Transform to include view count and opportunity info
  const transformed = links?.map((link) => ({
    id: link.id,
    token: link.token,
    expiresAt: link.expires_at,
    revokedAt: link.revoked_at,
    createdAt: link.created_at,
    tailoredProfileId: link.tailored_profile_id,
    opportunity: {
      id: link.tailored_profiles.opportunities.id,
      title: link.tailored_profiles.opportunities.title,
      company: link.tailored_profiles.opportunities.company,
    },
    viewCount: link.shared_link_views?.length || 0,
    views: link.shared_link_views?.map((v) => ({
      id: v.id,
      viewedAt: v.viewed_at,
    })) || [],
  }));

  return NextResponse.json({ links: transformed });
}

// POST - Create a new shared link
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tailoredProfileId, expiresInDays = 30 } = body;

    if (!tailoredProfileId) {
      return NextResponse.json(
        { error: "tailoredProfileId is required" },
        { status: 400 }
      );
    }

    // Verify the tailored profile belongs to user
    const { data: profile } = await supabase
      .from("tailored_profiles")
      .select("id")
      .eq("id", tailoredProfileId)
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Tailored profile not found" },
        { status: 404 }
      );
    }

    // Check if link already exists
    const { data: existingLink } = await supabase
      .from("shared_links")
      .select("id")
      .eq("tailored_profile_id", tailoredProfileId)
      .single();

    if (existingLink) {
      return NextResponse.json(
        { error: "Link already exists for this profile" },
        { status: 409 }
      );
    }

    // Calculate expiration
    const expiresAt = new Date();
    if (expiresInDays > 0) {
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    } else {
      // "No expiration" = 10 years
      expiresAt.setFullYear(expiresAt.getFullYear() + 10);
    }

    // Create the link
    const token = generateToken();
    const { data: newLink, error } = await supabase
      .from("shared_links")
      .insert({
        tailored_profile_id: tailoredProfileId,
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create shared link:", error);
      return NextResponse.json({ error: "Failed to create link" }, { status: 500 });
    }

    return NextResponse.json({
      id: newLink.id,
      token: newLink.token,
      expiresAt: newLink.expires_at,
      url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/shared/${token}`,
    });
  } catch (err) {
    console.error("Error creating shared link:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
```

**Step 2: Verify route compiles**

Run: `npx tsc --noEmit src/app/api/shared-links/route.ts` (or rely on build)

**Step 3: Commit**

```bash
git add src/app/api/shared-links/route.ts
git commit -m "feat(api): add shared-links create and list endpoints"
```

---

## Task 3: API Route - Update/Delete Shared Link

**Files:**
- Create: `src/app/api/shared-links/[id]/route.ts`

**Step 1: Create the API route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// PATCH - Update expiration or revoke
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, expiresInDays } = body;

    // Verify ownership
    const { data: link } = await supabase
      .from("shared_links")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (action === "revoke") {
      const { error } = await supabase
        .from("shared_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: "Failed to revoke" }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: "revoked" });
    }

    if (action === "extend" && expiresInDays) {
      const expiresAt = new Date();
      if (expiresInDays > 0) {
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      } else {
        expiresAt.setFullYear(expiresAt.getFullYear() + 10);
      }

      const { error } = await supabase
        .from("shared_links")
        .update({
          expires_at: expiresAt.toISOString(),
          revoked_at: null // Unrevoke if extending
        })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: "Failed to extend" }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: "extended", expiresAt });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Error updating shared link:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

// DELETE - Delete link entirely
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("shared_links")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to delete shared link:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add src/app/api/shared-links/[id]/route.ts
git commit -m "feat(api): add shared-links update and delete endpoints"
```

---

## Task 4: API Route - Public Shared Profile Access

**Files:**
- Create: `src/app/api/shared/[token]/route.ts`

**Step 1: Create the public API route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient();
  const { token } = await params;

  // Fetch the shared link with all necessary data
  const { data: link, error } = await supabase
    .from("shared_links")
    .select(`
      id,
      expires_at,
      revoked_at,
      tailored_profiles!inner (
        id,
        narrative,
        resume_data,
        opportunities!inner (
          id,
          title,
          company
        )
      ),
      profiles!inner (
        id,
        name,
        email,
        phone,
        location,
        linkedin,
        github,
        website,
        logo_url
      )
    `)
    .eq("token", token)
    .single();

  if (error || !link) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Check if expired or revoked
  const now = new Date();
  const expiresAt = new Date(link.expires_at);

  if (link.revoked_at || expiresAt < now) {
    return NextResponse.json({
      error: "expired",
      candidateName: link.profiles.name,
    }, { status: 410 });
  }

  // Log the view
  await supabase.from("shared_link_views").insert({
    shared_link_id: link.id,
  });

  // Return the profile data
  return NextResponse.json({
    candidate: {
      name: link.profiles.name,
      email: link.profiles.email,
      phone: link.profiles.phone,
      location: link.profiles.location,
      linkedin: link.profiles.linkedin,
      github: link.profiles.github,
      website: link.profiles.website,
      logoUrl: link.profiles.logo_url,
    },
    opportunity: {
      title: link.tailored_profiles.opportunities.title,
      company: link.tailored_profiles.opportunities.company,
    },
    narrative: link.tailored_profiles.narrative,
    resumeData: link.tailored_profiles.resume_data,
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/shared/[token]/route.ts
git commit -m "feat(api): add public shared profile endpoint with view tracking"
```

---

## Task 5: API Route - Recruiter Waitlist

**Files:**
- Create: `src/app/api/recruiter-waitlist/route.ts`

**Step 1: Create the waitlist API route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("recruiter_waitlist")
      .insert({ email: email.toLowerCase().trim() });

    if (error) {
      // Ignore duplicate errors silently
      if (error.code === "23505") {
        return NextResponse.json({ success: true });
      }
      console.error("Failed to add to waitlist:", error);
      return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Waitlist error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/recruiter-waitlist/route.ts
git commit -m "feat(api): add recruiter waitlist endpoint"
```

---

## Task 6: Share Modal Component

**Files:**
- Create: `src/components/share-link-modal.tsx`

**Step 1: Create the modal component**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Share2, Copy, Check, Loader2, Link2Off, Clock } from "lucide-react";
import { toast } from "sonner";

interface ShareLinkModalProps {
  tailoredProfileId: string;
  existingLink?: {
    id: string;
    token: string;
    expiresAt: string;
    revokedAt: string | null;
    viewCount: number;
  } | null;
  onLinkCreated?: () => void;
  onLinkRevoked?: () => void;
}

export function ShareLinkModal({
  tailoredProfileId,
  existingLink,
  onLinkCreated,
  onLinkRevoked,
}: ShareLinkModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [link, setLink] = useState(existingLink);

  const shareUrl = link
    ? `${window.location.origin}/shared/${link.token}`
    : null;

  const isExpired = link && new Date(link.expiresAt) < new Date();
  const isRevoked = !!link?.revokedAt;
  const isActive = link && !isExpired && !isRevoked;

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shared-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredProfileId,
          expiresInDays: expiresInDays === "0" ? 0 : parseInt(expiresInDays),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create link");
      }

      const data = await res.json();
      setLink({
        id: data.id,
        token: data.token,
        expiresAt: data.expiresAt,
        revokedAt: null,
        viewCount: 0,
      });
      toast.success("Share link created");
      onLinkCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create link");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!link) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/shared-links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });

      if (!res.ok) throw new Error("Failed to revoke");

      setLink({ ...link, revokedAt: new Date().toISOString() });
      toast.success("Link revoked");
      onLinkRevoked?.();
    } catch (err) {
      toast.error("Failed to revoke link");
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async () => {
    if (!link) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/shared-links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extend",
          expiresInDays: expiresInDays === "0" ? 0 : parseInt(expiresInDays),
        }),
      });

      if (!res.ok) throw new Error("Failed to extend");

      const data = await res.json();
      setLink({ ...link, expiresAt: data.expiresAt, revokedAt: null });
      toast.success("Link extended");
    } catch (err) {
      toast.error("Failed to extend link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatExpiry = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Expired";
    if (diffDays === 0) return "Expires today";
    if (diffDays === 1) return "Expires tomorrow";
    if (diffDays > 365) return "No expiration";
    return `Expires in ${diffDays} days`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Profile</DialogTitle>
          <DialogDescription>
            {!link
              ? "Create a private link to share this tailored profile with recruiters."
              : isActive
              ? "Your share link is active. Anyone with this link can view your profile."
              : "This link is no longer active."}
          </DialogDescription>
        </DialogHeader>

        {!link ? (
          // Create new link
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Link expires in</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="0">No expiration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              Generate Link
            </Button>
          </div>
        ) : isActive ? (
          // Active link
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Share link</Label>
              <div className="flex gap-2">
                <Input value={shareUrl || ""} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatExpiry(link.expiresAt)}
              </div>
              <div>{link.viewCount} view{link.viewCount !== 1 ? "s" : ""}</div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRevoke}
                disabled={loading}
                className="flex-1"
              >
                <Link2Off className="h-4 w-4 mr-2" />
                Revoke
              </Button>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7d</SelectItem>
                  <SelectItem value="30">30d</SelectItem>
                  <SelectItem value="90">90d</SelectItem>
                  <SelectItem value="0">Never</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleExtend} disabled={loading}>
                Extend
              </Button>
            </div>
          </div>
        ) : (
          // Expired or revoked
          <div className="space-y-4">
            <div className="text-center py-4 text-muted-foreground">
              {isRevoked ? "This link has been revoked." : "This link has expired."}
            </div>
            <div className="space-y-2">
              <Label>Create new link expiring in</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="0">No expiration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExtend} disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              Create New Link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/share-link-modal.tsx
git commit -m "feat(ui): add share link modal component"
```

---

## Task 7: Integrate Share Button into Tailored Profile Page

**Files:**
- Modify: `src/app/opportunities/[id]/page.tsx`

**Step 1: Add share link data fetching and modal**

Find the existing page and add:
1. Fetch existing shared link for this opportunity
2. Import and render ShareLinkModal component
3. Pass the existingLink prop

Add after the opportunity fetch (around line 60):

```typescript
// After fetching opportunity, add:

// Fetch existing shared link for this opportunity's tailored profile
const { data: tailoredProfile } = await supabase
  .from("tailored_profiles")
  .select("id")
  .eq("opportunity_id", id)
  .eq("user_id", user.id)
  .single();

let existingSharedLink = null;
if (tailoredProfile) {
  const { data: sharedLink } = await supabase
    .from("shared_links")
    .select(`
      id,
      token,
      expires_at,
      revoked_at,
      shared_link_views (id)
    `)
    .eq("tailored_profile_id", tailoredProfile.id)
    .single();

  if (sharedLink) {
    existingSharedLink = {
      id: sharedLink.id,
      token: sharedLink.token,
      expiresAt: sharedLink.expires_at,
      revokedAt: sharedLink.revoked_at,
      viewCount: sharedLink.shared_link_views?.length || 0,
    };
  }
}
```

Add the import at the top:
```typescript
import { ShareLinkModal } from "@/components/share-link-modal";
```

Add the modal in the JSX (next to the "View posting" button, around line 96):
```typescript
{tailoredProfile && (
  <ShareLinkModal
    tailoredProfileId={tailoredProfile.id}
    existingLink={existingSharedLink}
  />
)}
```

**Step 2: Commit**

```bash
git add src/app/opportunities/[id]/page.tsx
git commit -m "feat(ui): integrate share button into opportunity page"
```

---

## Task 8: Shared Links Dashboard Page

**Files:**
- Create: `src/app/shared-links/page.tsx`

**Step 1: Create the dashboard page**

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Link2, Eye, Clock, Building2 } from "lucide-react";
import Link from "next/link";
import { SharedLinksTable } from "@/components/shared-links-table";

export default async function SharedLinksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: links } = await supabase
    .from("shared_links")
    .select(`
      id,
      token,
      expires_at,
      revoked_at,
      created_at,
      tailored_profile_id,
      tailored_profiles!inner (
        id,
        opportunity_id,
        opportunities!inner (
          id,
          title,
          company
        )
      ),
      shared_link_views (
        id,
        viewed_at
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const transformedLinks = links?.map((link) => ({
    id: link.id,
    token: link.token,
    expiresAt: link.expires_at,
    revokedAt: link.revoked_at,
    createdAt: link.created_at,
    tailoredProfileId: link.tailored_profile_id,
    opportunityId: link.tailored_profiles.opportunities.id,
    opportunityTitle: link.tailored_profiles.opportunities.title,
    company: link.tailored_profiles.opportunities.company,
    viewCount: link.shared_link_views?.length || 0,
    views: link.shared_link_views?.map((v) => v.viewed_at).sort().reverse() || [],
  })) || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Shared Links</h1>
          <p className="text-muted-foreground mt-1">
            Manage links you&apos;ve shared with recruiters and hiring managers
          </p>
        </div>
      </div>

      {transformedLinks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No shared links yet</h3>
            <p className="text-muted-foreground mb-4">
              Share your tailored profiles from the opportunities page to track views here.
            </p>
            <Link
              href="/opportunities"
              className="text-primary hover:underline"
            >
              Go to Opportunities
            </Link>
          </CardContent>
        </Card>
      ) : (
        <SharedLinksTable links={transformedLinks} />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/shared-links/page.tsx
git commit -m "feat(ui): add shared links dashboard page"
```

---

## Task 9: Shared Links Table Component

**Files:**
- Create: `src/components/shared-links-table.tsx`

**Step 1: Create the table component**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Link2Off,
  ExternalLink,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

interface SharedLink {
  id: string;
  token: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  tailoredProfileId: string;
  opportunityId: string;
  opportunityTitle: string;
  company: string | null;
  viewCount: number;
  views: string[];
}

interface SharedLinksTableProps {
  links: SharedLink[];
}

export function SharedLinksTable({ links }: SharedLinksTableProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const getStatus = (link: SharedLink) => {
    if (link.revokedAt) return "revoked";
    if (new Date(link.expiresAt) < new Date()) return "expired";
    return "active";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "expired":
        return <Badge className="bg-gray-100 text-gray-800">Expired</Badge>;
      case "revoked":
        return <Badge className="bg-red-100 text-red-800">Revoked</Badge>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleCopy = async (token: string, id: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Link copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (id: string) => {
    setLoading(id);
    try {
      const res = await fetch(`/api/shared-links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Link revoked");
      router.refresh();
    } catch {
      toast.error("Failed to revoke link");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Opportunity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Views</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link) => {
            const status = getStatus(link);
            const isExpanded = expandedId === link.id;

            return (
              <Collapsible
                key={link.id}
                open={isExpanded}
                onOpenChange={(open) => setExpandedId(open ? link.id : null)}
                asChild
              >
                <>
                  <TableRow className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-0 h-auto">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{link.opportunityTitle}</div>
                        {link.company && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {link.company}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(status)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        {link.viewCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      {status === "active"
                        ? formatDate(link.expiresAt)
                        : status === "expired"
                        ? "Expired"
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {status === "active" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(link.token, link.id);
                              }}
                            >
                              {copiedId === link.id ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRevoke(link.id);
                              }}
                              disabled={loading === link.id}
                            >
                              <Link2Off className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/opportunities/${link.opportunityId}`;
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={6} className="py-4">
                        {link.views.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center">
                            No views yet
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-sm font-medium mb-2">View history</p>
                            {link.views.slice(0, 10).map((viewedAt, i) => (
                              <p key={i} className="text-sm text-muted-foreground">
                                Viewed {formatDateTime(viewedAt)}
                              </p>
                            ))}
                            {link.views.length > 10 && (
                              <p className="text-sm text-muted-foreground">
                                ... and {link.views.length - 10} more
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </>
              </Collapsible>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/shared-links-table.tsx
git commit -m "feat(ui): add shared links table component"
```

---

## Task 10: Add Shared Links to Navigation

**Files:**
- Modify: `src/components/nav.tsx`

**Step 1: Add the Shared Links nav item**

Find the nav links section (around line 40-58) and add after "Opportunities":

```typescript
<Link
  href="/shared-links"
  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
>
  Shared Links
</Link>
```

**Step 2: Commit**

```bash
git add src/components/nav.tsx
git commit -m "feat(ui): add shared links to navigation"
```

---

## Task 11: Public Shared Profile Page

**Files:**
- Create: `src/app/shared/[token]/page.tsx`

**Step 1: Create the public page**

```typescript
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Mail, Phone, MapPin, Linkedin, Github, Globe, Building2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { SharedProfileResume } from "@/components/shared-profile-resume";
import { RecruiterWaitlistCTA } from "@/components/recruiter-waitlist-cta";

interface SharedProfileData {
  candidate: {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
    logoUrl: string | null;
  };
  opportunity: {
    title: string;
    company: string | null;
  };
  narrative: string | null;
  resumeData: Record<string, unknown>;
}

async function getSharedProfile(token: string): Promise<{
  data?: SharedProfileData;
  error?: "not_found" | "expired";
  candidateName?: string;
}> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/shared/${token}`,
    { cache: "no-store" }
  );

  if (res.status === 404) {
    return { error: "not_found" };
  }

  if (res.status === 410) {
    const data = await res.json();
    return { error: "expired", candidateName: data.candidateName };
  }

  if (!res.ok) {
    return { error: "not_found" };
  }

  return { data: await res.json() };
}

export default async function SharedProfilePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getSharedProfile(token);

  if (result.error === "not_found") {
    notFound();
  }

  if (result.error === "expired") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-semibold mb-2">Link Expired</h1>
            <p className="text-muted-foreground mb-4">
              This link has expired. Please reach out to{" "}
              <strong>{result.candidateName || "the candidate"}</strong> for a fresh link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { candidate, opportunity, narrative, resumeData } = result.data!;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {candidate.logoUrl && (
                <Image
                  src={candidate.logoUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="rounded-full"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">{candidate.name || "Candidate"}</h1>
                <p className="text-muted-foreground flex items-center gap-1">
                  {opportunity.title}
                  {opportunity.company && (
                    <>
                      <span className="mx-1">at</span>
                      <Building2 className="h-4 w-4" />
                      {opportunity.company}
                    </>
                  )}
                </p>
              </div>
            </div>
            <SharedProfileResume
              resumeData={resumeData}
              candidateName={candidate.name}
              candidateContact={{
                email: candidate.email,
                phone: candidate.phone,
                location: candidate.location,
                linkedin: candidate.linkedin,
                github: candidate.github,
                website: candidate.website,
              }}
            />
          </div>

          {/* Contact info */}
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
            {candidate.email && (
              <a href={`mailto:${candidate.email}`} className="flex items-center gap-1 hover:text-foreground">
                <Mail className="h-4 w-4" />
                {candidate.email}
              </a>
            )}
            {candidate.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {candidate.phone}
              </span>
            )}
            {candidate.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {candidate.location}
              </span>
            )}
            {candidate.linkedin && (
              <a
                href={candidate.linkedin.startsWith("http") ? candidate.linkedin : `https://${candidate.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </a>
            )}
            {candidate.github && (
              <a
                href={candidate.github.startsWith("http") ? candidate.github : `https://${candidate.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Narrative */}
        {narrative && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">About</h2>
            <Card>
              <CardContent className="pt-4">
                <p className="whitespace-pre-wrap">{narrative}</p>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Resume */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Resume</h2>
          <SharedProfileResumeInline resumeData={resumeData} />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background py-6 mt-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Image src="/logo.svg" alt="Idynic" width={20} height={20} />
              Powered by Idynic
            </div>
            <RecruiterWaitlistCTA />
          </div>
        </div>
      </footer>
    </div>
  );
}

// Inline resume component (simplified view)
function SharedProfileResumeInline({ resumeData }: { resumeData: Record<string, unknown> }) {
  const data = resumeData as {
    summary?: string;
    skills?: Array<{ category: string; skills: string[] }>;
    experience?: Array<{
      company: string;
      title: string;
      dates: string;
      location?: string;
      bullets: string[];
    }>;
    education?: Array<{
      institution: string;
      degree: string;
      year?: string;
    }>;
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-6">
        {/* Summary */}
        {data.summary && (
          <div>
            <h3 className="font-semibold mb-2">Summary</h3>
            <p className="text-muted-foreground">{data.summary}</p>
          </div>
        )}

        {/* Skills */}
        {data.skills && data.skills.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Skills</h3>
            <div className="space-y-2">
              {data.skills.map((cat, i) => (
                <div key={i}>
                  <span className="text-sm font-medium">{cat.category}: </span>
                  <span className="text-sm text-muted-foreground">{cat.skills.join(", ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Experience */}
        {data.experience && data.experience.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Experience</h3>
            <div className="space-y-4">
              {data.experience.map((exp, i) => (
                <div key={i}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{exp.title}</div>
                      <div className="text-sm text-muted-foreground">{exp.company}</div>
                    </div>
                    <div className="text-sm text-muted-foreground text-right">
                      {exp.dates}
                      {exp.location && <div>{exp.location}</div>}
                    </div>
                  </div>
                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {exp.bullets.map((bullet, j) => (
                        <li key={j} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-muted-foreground/50">•</span>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {data.education && data.education.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Education</h3>
            <div className="space-y-2">
              {data.education.map((edu, i) => (
                <div key={i} className="flex justify-between">
                  <div>
                    <div className="font-medium">{edu.degree}</div>
                    <div className="text-sm text-muted-foreground">{edu.institution}</div>
                  </div>
                  {edu.year && <div className="text-sm text-muted-foreground">{edu.year}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/shared/[token]/page.tsx
git commit -m "feat(ui): add public shared profile page"
```

---

## Task 12: Shared Profile Resume Download Component

**Files:**
- Create: `src/components/shared-profile-resume.tsx`

**Step 1: Create the PDF download component**

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ResumePDFDownload } from "@/components/resume-pdf";
import type { ResumeDocumentProps } from "@/components/resume-pdf";

interface SharedProfileResumeProps {
  resumeData: Record<string, unknown>;
  candidateName: string | null;
  candidateContact: {
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
  };
}

export function SharedProfileResume({
  resumeData,
  candidateName,
  candidateContact,
}: SharedProfileResumeProps) {
  const data = resumeData as ResumeDocumentProps;

  // Merge contact info into resume data
  const resumeWithContact: ResumeDocumentProps = {
    ...data,
    name: candidateName || data.name || "Candidate",
    email: candidateContact.email || data.email,
    phone: candidateContact.phone || data.phone,
    location: candidateContact.location || data.location,
    linkedin: candidateContact.linkedin || data.linkedin,
    github: candidateContact.github || data.github,
    website: candidateContact.website || data.website,
  };

  return (
    <ResumePDFDownload
      {...resumeWithContact}
      fileName={`${candidateName || "resume"}.pdf`}
    >
      <Button variant="outline" size="sm">
        <Download className="h-4 w-4 mr-2" />
        Download PDF
      </Button>
    </ResumePDFDownload>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/shared-profile-resume.tsx
git commit -m "feat(ui): add shared profile resume download component"
```

---

## Task 13: Recruiter Waitlist CTA Component

**Files:**
- Create: `src/components/recruiter-waitlist-cta.tsx`

**Step 1: Create the CTA component**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export function RecruiterWaitlistCTA() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch("/api/recruiter-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error();

      setSuccess(true);
      toast.success("You're on the list!");
    } catch {
      toast.error("Failed to join waitlist");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Hiring? Get early access
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join the Waitlist</DialogTitle>
          <DialogDescription>
            Be the first to know when we launch tools for recruiters and hiring managers.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center">
            <Check className="h-12 w-12 mx-auto text-green-600 mb-3" />
            <p className="font-medium">You&apos;re on the list!</p>
            <p className="text-sm text-muted-foreground mt-1">
              We&apos;ll reach out when we launch.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Get Early Access"
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/recruiter-waitlist-cta.tsx
git commit -m "feat(ui): add recruiter waitlist CTA component"
```

---

## Task 14: Recruiters Landing Page

**Files:**
- Create: `src/app/recruiters/page.tsx`

**Step 1: Create the landing page**

```typescript
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import Image from "next/image";
import { RecruiterWaitlistForm } from "@/components/recruiter-waitlist-form";

export default function RecruitersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <Image src="/logo.svg" alt="Idynic" width={48} height={48} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Idynic for Recruiters &amp; Hiring Managers
          </h1>
          <p className="text-lg text-muted-foreground">
            Coming soon: Post your roles and discover pre-qualified candidates
            with tailored profiles matched to your needs.
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <RecruiterWaitlistForm />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Feature>View candidate profiles tailored to your role</Feature>
          <Feature>See verified skills and work history</Feature>
          <Feature>Direct connection to candidates</Feature>
          <Feature>Skip the resume pile - find the right fit faster</Feature>
        </div>
      </div>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
        <Check className="h-4 w-4 text-green-600" />
      </div>
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}
```

**Step 2: Create the form component**

Create: `src/components/recruiter-waitlist-form.tsx`

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export function RecruiterWaitlistForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch("/api/recruiter-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error();

      setSuccess(true);
      toast.success("You're on the list!");
    } catch {
      toast.error("Failed to join waitlist");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="py-8 text-center">
        <Check className="h-16 w-16 mx-auto text-green-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">You&apos;re on the list!</h3>
        <p className="text-muted-foreground">
          We&apos;ll reach out when we launch.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="text-lg h-12"
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          "Get Early Access"
        )}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        We&apos;ll never share your email. Unsubscribe anytime.
      </p>
    </form>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/recruiters/page.tsx src/components/recruiter-waitlist-form.tsx
git commit -m "feat(ui): add recruiters landing page with waitlist"
```

---

## Task 15: Verification and Final Cleanup

**Step 1: Run the build to verify compilation**

Run: `npm run build`

Expected: Build completes (may have pre-existing ESLint warnings)

**Step 2: Verify pages render**

Run: `npm run dev`

Test these URLs:
- `/shared-links` - Should show empty state or list
- `/recruiters` - Should show waitlist landing page
- `/opportunities/[id]` - Should have Share button
- `/shared/[any-token]` - Should show 404

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address build issues and cleanup"
```

---

## Summary

This plan implements:
1. Database tables with proper RLS
2. API routes for CRUD operations
3. Share modal on tailored profile page
4. Shared links dashboard with view tracking
5. Public shared profile page
6. Recruiter waitlist landing page

All changes are isolated to the `feature/profile-sharing` branch in `.worktrees/profile-sharing`.
