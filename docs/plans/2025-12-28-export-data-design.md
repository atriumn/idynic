# Export My Data - Implementation Plan

> Created 2025-12-28

## Overview

GDPR-compliant data export that downloads all user data as a ZIP file containing JSON data and original documents. Must be fast for typical users and handle large exports gracefully.

## Data to Export

### Profile Data
- `profiles` - Contact info, identity headline/bio/archetype/keywords
- `subscriptions` - Plan type, status, billing period
- `usage_tracking` - Current period usage counts

### Documents
- `documents` - Metadata (filename, type, created_at)
- `documents.raw_text` - Extracted text content
- Storage files - Original PDFs from `resumes` bucket

### Career Data
- `work_history` - Jobs, ventures, additional entries
- `evidence` - Accomplishments, skills, traits (exclude embeddings)
- `identity_claims` - Extracted skills, achievements, attributes
- `claims` - Structured claims with evidence

### Opportunities
- `opportunities` - Job postings and research data
- `matches` - Match scores between claims and opportunities
- `opportunity_notes` - Ratings and personal notes
- `tailored_profiles` - Generated talking points, narratives, resume data

### Sharing
- `shared_links` - Token, expiry, revocation status
- `shared_link_views` - View timestamps

### API
- `api_keys` - Key metadata (NOT the actual key hashes)

---

## Export Format

### ZIP Structure
```
idynic-export-2025-12-28/
├── data.json              # All structured data
├── documents/
│   ├── resume-john-doe.pdf
│   ├── story-project-alpha.pdf
│   └── ...
└── README.txt             # Export description
```

### data.json Schema
```typescript
interface ExportData {
  exportedAt: string;  // ISO timestamp
  version: "1.0";

  profile: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    location: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
    identity: {
      headline: string | null;
      bio: string | null;
      archetype: string | null;
      keywords: string[] | null;
    };
    createdAt: string;
  };

  subscription: {
    planType: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  } | null;

  usage: {
    uploadsCount: number;
    tailoredProfilesCount: number;
    billingPeriodStart: string;
    billingPeriodEnd: string;
  } | null;

  documents: Array<{
    id: string;
    type: "resume" | "story";
    filename: string;
    createdAt: string;
    rawText: string | null;
    localPath: string;  // Path within ZIP
  }>;

  workHistory: Array<{
    id: string;
    company: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
    location: string | null;
    summary: string | null;
    entryType: string;
    createdAt: string;
  }>;

  identityClaims: Array<{
    id: string;
    type: string;
    label: string;
    description: string | null;
    confidence: number;
    source: string;
    createdAt: string;
  }>;

  evidence: Array<{
    id: string;
    type: string;
    text: string;
    context: object | null;
    sourceType: string;
    evidenceDate: string | null;
    createdAt: string;
  }>;

  opportunities: Array<{
    id: string;
    title: string;
    company: string | null;
    url: string | null;
    description: string | null;
    requirements: string | null;
    status: string;
    location: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    companyResearch: object | null;
    createdAt: string;
  }>;

  tailoredProfiles: Array<{
    id: string;
    opportunityId: string;
    talkingPoints: object | null;
    narrative: string | null;
    resumeData: object | null;
    createdAt: string;
  }>;

  opportunityNotes: Array<{
    id: string;
    opportunityId: string;
    techStackRating: number | null;
    companyRating: number | null;
    industryRating: number | null;
    roleFitRating: number | null;
    links: string[] | null;
    notes: string | null;
    createdAt: string;
  }>;

  sharedLinks: Array<{
    id: string;
    tailoredProfileId: string;
    token: string;
    expiresAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    viewCount: number;
  }>;

  apiKeys: Array<{
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    lastUsedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    createdAt: string;
  }>;
}
```

### README.txt Content
```
Idynic Data Export
==================
Exported: {timestamp}
User: {email}

This archive contains all your data from Idynic.

Contents:
- data.json: All your structured data in JSON format
- documents/: Your uploaded documents (PDFs)

For questions about this export, visit: https://idynic.com/help
To delete your account, visit: https://idynic.com/settings/account
```

---

## API Endpoint

### `POST /api/v1/account/export`

**Authentication:** Bearer token (JWT or API key)

**Request Body:** None required

**Response:**
- `200 OK` with ZIP file download
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Export failed

**Headers:**
```
Content-Type: application/zip
Content-Disposition: attachment; filename="idynic-export-2025-12-28.zip"
```

**Implementation:**

```typescript
// apps/web/src/app/api/v1/account/export/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/response";
import JSZip from "jszip";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return apiError("unauthorized", "Authentication required", 401);
  }

  try {
    const zip = new JSZip();
    const documentsFolder = zip.folder("documents");
    const exportDate = new Date().toISOString().split("T")[0];

    // Fetch all user data in parallel
    const [
      profileResult,
      subscriptionResult,
      usageResult,
      documentsResult,
      workHistoryResult,
      identityClaimsResult,
      evidenceResult,
      opportunitiesResult,
      tailoredProfilesResult,
      opportunityNotesResult,
      sharedLinksResult,
      apiKeysResult,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("subscriptions").select("*").eq("user_id", user.id).single(),
      supabase.from("usage_tracking").select("*").eq("user_id", user.id).order("billing_period_start", { ascending: false }).limit(1).single(),
      supabase.from("documents").select("*").eq("user_id", user.id),
      supabase.from("work_history").select("*").eq("user_id", user.id),
      supabase.from("identity_claims").select("*").eq("user_id", user.id),
      supabase.from("evidence").select("id, evidence_type, text, context, source_type, evidence_date, created_at").eq("user_id", user.id),
      supabase.from("opportunities").select("*").eq("user_id", user.id),
      supabase.from("tailored_profiles").select("*").eq("user_id", user.id),
      supabase.from("opportunity_notes").select("*").eq("user_id", user.id),
      supabase.from("shared_links").select("*, shared_link_views(count)").eq("user_id", user.id),
      supabase.from("api_keys").select("id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at").eq("user_id", user.id),
    ]);

    const profile = profileResult.data;
    const subscription = subscriptionResult.data;
    const usage = usageResult.data;
    const documents = documentsResult.data || [];
    const workHistory = workHistoryResult.data || [];
    const identityClaims = identityClaimsResult.data || [];
    const evidence = evidenceResult.data || [];
    const opportunities = opportunitiesResult.data || [];
    const tailoredProfiles = tailoredProfilesResult.data || [];
    const opportunityNotes = opportunityNotesResult.data || [];
    const sharedLinks = sharedLinksResult.data || [];
    const apiKeys = apiKeysResult.data || [];

    // Download and add document files to ZIP
    const documentExports = await Promise.all(
      documents.map(async (doc) => {
        const localPath = `documents/${doc.filename}`;

        if (doc.storage_path) {
          const { data: fileData } = await supabase.storage
            .from("resumes")
            .download(doc.storage_path);

          if (fileData) {
            const arrayBuffer = await fileData.arrayBuffer();
            documentsFolder?.file(doc.filename, arrayBuffer);
          }
        }

        return {
          id: doc.id,
          type: doc.document_type,
          filename: doc.filename,
          createdAt: doc.created_at,
          rawText: doc.raw_text,
          localPath,
        };
      })
    );

    // Build export data object
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: "1.0",

      profile: profile ? {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        location: profile.location,
        linkedin: profile.linkedin,
        github: profile.github,
        website: profile.website,
        identity: {
          headline: profile.identity_headline,
          bio: profile.identity_bio,
          archetype: profile.identity_archetype,
          keywords: profile.identity_keywords,
        },
        createdAt: profile.created_at,
      } : null,

      subscription: subscription ? {
        planType: subscription.plan_type,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
      } : null,

      usage: usage ? {
        uploadsCount: usage.uploads_count,
        tailoredProfilesCount: usage.tailored_profiles_count,
        billingPeriodStart: usage.billing_period_start,
        billingPeriodEnd: usage.billing_period_end,
      } : null,

      documents: documentExports,

      workHistory: workHistory.map((wh) => ({
        id: wh.id,
        company: wh.company,
        title: wh.title,
        startDate: wh.start_date,
        endDate: wh.end_date,
        location: wh.location,
        summary: wh.summary,
        entryType: wh.entry_type,
        createdAt: wh.created_at,
      })),

      identityClaims: identityClaims.map((ic) => ({
        id: ic.id,
        type: ic.claim_type,
        label: ic.label,
        description: ic.description,
        confidence: ic.confidence,
        source: ic.source,
        createdAt: ic.created_at,
      })),

      evidence: evidence.map((e) => ({
        id: e.id,
        type: e.evidence_type,
        text: e.text,
        context: e.context,
        sourceType: e.source_type,
        evidenceDate: e.evidence_date,
        createdAt: e.created_at,
      })),

      opportunities: opportunities.map((o) => ({
        id: o.id,
        title: o.title,
        company: o.company,
        url: o.url,
        description: o.description,
        requirements: o.requirements,
        status: o.status,
        location: o.location,
        salaryMin: o.salary_min,
        salaryMax: o.salary_max,
        companyResearch: {
          url: o.company_url,
          industry: o.company_industry,
          size: o.company_size,
          about: o.company_about,
        },
        createdAt: o.created_at,
      })),

      tailoredProfiles: tailoredProfiles.map((tp) => ({
        id: tp.id,
        opportunityId: tp.opportunity_id,
        talkingPoints: tp.talking_points,
        narrative: tp.narrative,
        resumeData: tp.resume_data,
        createdAt: tp.created_at,
      })),

      opportunityNotes: opportunityNotes.map((on) => ({
        id: on.id,
        opportunityId: on.opportunity_id,
        techStackRating: on.tech_stack_rating,
        companyRating: on.company_rating,
        industryRating: on.industry_rating,
        roleFitRating: on.role_fit_rating,
        links: on.links,
        notes: on.notes,
        createdAt: on.created_at,
      })),

      sharedLinks: sharedLinks.map((sl) => ({
        id: sl.id,
        tailoredProfileId: sl.tailored_profile_id,
        token: sl.token,
        expiresAt: sl.expires_at,
        revokedAt: sl.revoked_at,
        createdAt: sl.created_at,
        viewCount: sl.shared_link_views?.[0]?.count || 0,
      })),

      apiKeys: apiKeys.map((ak) => ({
        id: ak.id,
        name: ak.name,
        keyPrefix: ak.key_prefix,
        scopes: ak.scopes,
        lastUsedAt: ak.last_used_at,
        expiresAt: ak.expires_at,
        revokedAt: ak.revoked_at,
        createdAt: ak.created_at,
      })),
    };

    // Add data.json to ZIP
    zip.file("data.json", JSON.stringify(exportData, null, 2));

    // Add README.txt
    const readme = `Idynic Data Export
==================
Exported: ${exportData.exportedAt}
User: ${profile?.email || user.email}

This archive contains all your data from Idynic.

Contents:
- data.json: All your structured data in JSON format
- documents/: Your uploaded documents (PDFs)

For questions about this export, visit: https://idynic.com/help
To delete your account, visit: https://idynic.com/settings/account
`;
    zip.file("README.txt", readme);

    // Generate ZIP
    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="idynic-export-${exportDate}.zip"`,
      },
    });

  } catch (error) {
    console.error("Data export failed:", error);
    return apiError("export_failed", "Failed to export data", 500);
  }
}
```

---

## UI Component

### Export Data Button

Create `apps/web/src/app/settings/account/export-data-button.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ExportDataButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/account/export", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to export data");
      }

      // Download the ZIP file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")
        ?.split("filename=")[1]
        ?.replace(/"/g, "") || "idynic-export.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Data exported successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      {loading ? "Preparing export..." : "Export My Data"}
    </Button>
  );
}
```

---

## Edge Cases

### 1. Large Exports (>100MB)
- Timeout risk for synchronous download
- Options:
  - **Simple**: Increase timeout, accept occasional failures
  - **Better**: Generate ZIP in background, email download link
  - **Best**: Stream ZIP generation (complex)
- Recommendation: Start simple, add email fallback if needed

### 2. Storage Files Missing
- Document record exists but file deleted from storage
- Include document metadata in JSON, skip missing file
- Note in README which files couldn't be downloaded

### 3. Concurrent Export Requests
- Allow concurrent requests (read-only operation)
- Rate limit to 1 export per 5 minutes (prevent abuse)

### 4. Embeddings
- Exclude vector embeddings from export (large, not useful to user)
- Include text/description that embeddings were derived from

### 5. Partial Data
- If any query fails, still export what we have
- Log failures, continue with partial data
- Note in README what couldn't be exported

---

## Dependencies

Add to `apps/web/package.json`:
```json
{
  "dependencies": {
    "jszip": "^3.10.1"
  }
}
```

---

## Security Considerations

1. **Authentication Required** - Only export own data
2. **No Service Role Needed** - RLS ensures user only sees own data
3. **Exclude Sensitive Fields** - No password hashes, no API key hashes
4. **Rate Limiting** - Prevent export spam (1 per 5 minutes)
5. **Logging** - Log export events for audit trail

---

## Testing

### Unit Tests
- Export includes all expected fields
- ZIP structure is correct
- Missing storage files handled gracefully

### Integration Tests
- Export with multiple documents
- Export with no data (new user)
- Export with all data types populated

### Manual Testing
- Download and extract ZIP
- Verify data.json is valid JSON
- Verify PDFs are intact
- Verify README is present

---

## Files to Create/Modify

### New Files
- `apps/web/src/app/api/v1/account/export/route.ts`
- `apps/web/src/app/settings/account/export-data-button.tsx`

### Modified Files
- `apps/web/package.json` - Add jszip dependency
- Account settings page (created in delete-account plan)

---

## Implementation Checklist

- [ ] Add `jszip` dependency
- [ ] Create `POST /api/v1/account/export` endpoint
- [ ] Implement parallel data fetching
- [ ] Implement document file downloading
- [ ] Build export data structure
- [ ] Generate ZIP with data.json, documents/, README.txt
- [ ] Create ExportDataButton component
- [ ] Add rate limiting (1 per 5 minutes)
- [ ] Write tests
- [ ] Test with various data scenarios
