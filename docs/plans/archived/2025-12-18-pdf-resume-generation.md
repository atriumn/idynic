# PDF Resume Generation Implementation Plan

> **Status:** ✅ COMPLETE (2025-12-19)

**Goal:** Generate professional PDF resumes with in-browser preview and download capability.

## Progress (Last reviewed: 2025-12-19)

| Step | Status | Notes |
|------|--------|-------|
| Task 1: Install React-PDF | ✅ Complete | Commit `b80564dc` |
| Task 2: Create PDF Resume Template | ✅ Complete | Commit `c44c9021` |
| Task 3: Create PDF Preview Viewer | ✅ Complete | Commit `ad604aad` |
| Task 4: Create PDF Download Button | ✅ Complete | Commit `c94414ff` |
| Task 5: Integrate into TailoredProfile | ✅ Complete | Commit `c48ce858` |
| Task 6: Add User Name/Email to PDF | ✅ Complete | Commit `a8ba076a` |
| Task 7: Next.js Config for React-PDF | ✅ Complete | Commit `19efef3c` |
| Task 8: PDF Download Refactoring | ✅ Complete | Commits `ab04b0e7`, `c9ce58bd` |
| Task 9: Font Fixes | ✅ Complete | Commit `e8139680` |
| Task 10: Contact Info & Company Logos | ✅ Complete | Commit `e8250982` |

### Drift Notes
- Changed from remote Inter fonts to built-in Helvetica (commit `e8139680`) - better reliability
- Added blob generation for PDF download/preview (commits `ab04b0e7`, `c9ce58bd`) - improved approach
- Added contact info extraction from resume (commit `e8250982`) - enhancement

---

**Architecture:** React-PDF (`@react-pdf/renderer`) for PDF generation. Shared document template used by both client-side preview and download. Toggle between HTML view and PDF preview in the Resume tab.

**Tech Stack:** @react-pdf/renderer, Next.js dynamic imports (for SSR compatibility)

---

## Task 1: Install React-PDF

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

```bash
npm install @react-pdf/renderer
```

**Step 2: Verify installation**

```bash
npm ls @react-pdf/renderer
```

Expected: Shows installed version

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @react-pdf/renderer for PDF generation"
```

---

## Task 2: Create PDF Resume Template

**Files:**
- Create: `src/components/resume-pdf/resume-document.tsx`

**Step 1: Create the PDF document component**

```tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Register fonts for better typography
Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff2", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hjp-Ek-_EeA.woff2", fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Inter",
    fontSize: 10,
    lineHeight: 1.4,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 4,
    color: "#111827",
  },
  contactInfo: {
    fontSize: 10,
    color: "#4b5563",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    color: "#1e40af",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summary: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#374151",
  },
  experienceItem: {
    marginBottom: 12,
  },
  experienceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  jobTitle: {
    fontSize: 11,
    fontWeight: 600,
  },
  company: {
    fontSize: 10,
    color: "#4b5563",
  },
  dates: {
    fontSize: 10,
    color: "#6b7280",
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 8,
  },
  bulletPoint: {
    width: 12,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
  },
  skillsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  skillCategory: {
    marginBottom: 6,
  },
  skillCategoryName: {
    fontSize: 10,
    fontWeight: 600,
    marginBottom: 2,
  },
  skillList: {
    fontSize: 10,
    color: "#374151",
  },
  educationItem: {
    marginBottom: 6,
  },
  degree: {
    fontSize: 10,
    fontWeight: 600,
  },
  institution: {
    fontSize: 10,
    color: "#4b5563",
  },
  ventureItem: {
    marginBottom: 8,
  },
  ventureName: {
    fontSize: 11,
    fontWeight: 600,
  },
  ventureRole: {
    fontSize: 10,
    color: "#4b5563",
  },
  ventureDescription: {
    fontSize: 10,
    color: "#374151",
    marginTop: 2,
  },
});

interface SkillCategory {
  category: string;
  skills: string[];
}

interface Experience {
  company: string;
  title: string;
  dates: string;
  location: string | null;
  bullets: string[];
}

interface Venture {
  name: string;
  role: string;
  status: string | null;
  description: string | null;
}

interface Education {
  institution: string;
  degree: string;
  year: string | null;
}

export interface ResumeDocumentProps {
  name: string;
  email?: string;
  phone?: string;
  summary: string;
  skills: SkillCategory[];
  experience: Experience[];
  additionalExperience?: Experience[];
  ventures?: Venture[];
  education: Education[];
}

// Parse **bold** text into segments
function parseBoldText(text: string): Array<{ text: string; bold: boolean }> {
  const segments: Array<{ text: string; bold: boolean }> = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  return segments.length > 0 ? segments : [{ text, bold: false }];
}

function BulletText({ text }: { text: string }) {
  const segments = parseBoldText(text);
  return (
    <Text style={styles.bulletText}>
      {segments.map((segment, i) => (
        <Text key={i} style={segment.bold ? { fontWeight: 600 } : {}}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}

export function ResumeDocument({
  name,
  email,
  phone,
  summary,
  skills,
  experience,
  additionalExperience = [],
  ventures = [],
  education,
}: ResumeDocumentProps) {
  const contactParts = [email, phone].filter(Boolean).join(" | ");

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{name}</Text>
          {contactParts && <Text style={styles.contactInfo}>{contactParts}</Text>}
        </View>

        {/* Summary */}
        {summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Summary</Text>
            <Text style={styles.summary}>{summary}</Text>
          </View>
        )}

        {/* Experience */}
        {experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {experience.map((job, idx) => (
              <View key={idx} style={styles.experienceItem}>
                <View style={styles.experienceHeader}>
                  <View>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    <Text style={styles.company}>{job.company}{job.location ? ` - ${job.location}` : ""}</Text>
                  </View>
                  <Text style={styles.dates}>{job.dates}</Text>
                </View>
                {job.bullets.map((bullet, bIdx) => (
                  <View key={bIdx} style={styles.bullet}>
                    <Text style={styles.bulletPoint}>•</Text>
                    <BulletText text={bullet} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Additional Experience */}
        {additionalExperience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Experience</Text>
            {additionalExperience.map((job, idx) => (
              <View key={idx} style={styles.experienceItem}>
                <View style={styles.experienceHeader}>
                  <View>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    <Text style={styles.company}>{job.company}</Text>
                  </View>
                  <Text style={styles.dates}>{job.dates}</Text>
                </View>
                {job.bullets.map((bullet, bIdx) => (
                  <View key={bIdx} style={styles.bullet}>
                    <Text style={styles.bulletPoint}>•</Text>
                    <BulletText text={bullet} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Ventures */}
        {ventures.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ventures & Projects</Text>
            {ventures.map((venture, idx) => (
              <View key={idx} style={styles.ventureItem}>
                <Text style={styles.ventureName}>
                  {venture.name}
                  {venture.status && ` (${venture.status})`}
                </Text>
                <Text style={styles.ventureRole}>{venture.role}</Text>
                {venture.description && (
                  <Text style={styles.ventureDescription}>{venture.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            {skills.map((cat, idx) => (
              <View key={idx} style={styles.skillCategory}>
                <Text style={styles.skillCategoryName}>{cat.category}:</Text>
                <Text style={styles.skillList}>{cat.skills.join(", ")}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((edu, idx) => (
              <View key={idx} style={styles.educationItem}>
                <Text style={styles.degree}>{edu.degree}</Text>
                <Text style={styles.institution}>
                  {edu.institution}
                  {edu.year && ` - ${edu.year}`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
```

**Step 2: Verify file created**

```bash
ls -la src/components/resume-pdf/resume-document.tsx
```

**Step 3: Commit**

```bash
git add src/components/resume-pdf/resume-document.tsx
git commit -m "feat: add PDF resume document template"
```

---

## Task 3: Create PDF Preview Component

**Files:**
- Create: `src/components/resume-pdf/resume-pdf-viewer.tsx`

**Step 1: Create the viewer component with dynamic import**

```tsx
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { ResumeDocumentProps } from "./resume-document";

// Dynamic import to avoid SSR issues with react-pdf
const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <LoadingState /> }
);

const ResumeDocument = dynamic(
  () => import("./resume-document").then((mod) => mod.ResumeDocument),
  { ssr: false }
);

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-[600px] bg-muted/30 rounded-lg">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading PDF preview...</p>
      </div>
    </div>
  );
}

interface ResumePDFViewerProps {
  data: ResumeDocumentProps;
}

export function ResumePDFViewer({ data }: ResumePDFViewerProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <LoadingState />;
  }

  return (
    <div className="w-full h-[700px] border rounded-lg overflow-hidden bg-gray-100">
      <PDFViewer width="100%" height="100%" showToolbar={true}>
        <ResumeDocument {...data} />
      </PDFViewer>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/resume-pdf/resume-pdf-viewer.tsx
git commit -m "feat: add PDF preview viewer component"
```

---

## Task 4: Create PDF Download Component

**Files:**
- Create: `src/components/resume-pdf/resume-pdf-download.tsx`

**Step 1: Create the download button component**

```tsx
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import type { ResumeDocumentProps } from "./resume-document";

// Dynamic imports
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

const ResumeDocument = dynamic(
  () => import("./resume-document").then((mod) => mod.ResumeDocument),
  { ssr: false }
);

interface ResumePDFDownloadProps {
  data: ResumeDocumentProps;
  filename?: string;
}

export function ResumePDFDownload({ data, filename = "resume.pdf" }: ResumePDFDownloadProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  return (
    <PDFDownloadLink
      document={<ResumeDocument {...data} />}
      fileName={filename}
    >
      {({ loading }) => (
        <Button variant="outline" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Preparing...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
```

**Step 2: Create barrel export**

Create `src/components/resume-pdf/index.ts`:

```tsx
export { ResumeDocument } from "./resume-document";
export type { ResumeDocumentProps } from "./resume-document";
export { ResumePDFViewer } from "./resume-pdf-viewer";
export { ResumePDFDownload } from "./resume-pdf-download";
```

**Step 3: Commit**

```bash
git add src/components/resume-pdf/
git commit -m "feat: add PDF download button component"
```

---

## Task 5: Integrate PDF into Tailored Profile

**Files:**
- Modify: `src/components/tailored-profile.tsx`

**Step 1: Add imports at the top of the file (after existing imports)**

Add after line 8:

```tsx
import dynamic from "next/dynamic";
import { FileText, Eye } from "lucide-react";

// Dynamic import PDF components to avoid SSR issues
const ResumePDFViewer = dynamic(
  () => import("@/components/resume-pdf").then((mod) => mod.ResumePDFViewer),
  { ssr: false }
);

const ResumePDFDownload = dynamic(
  () => import("@/components/resume-pdf").then((mod) => mod.ResumePDFDownload),
  { ssr: false }
);
```

**Step 2: Add state for PDF view toggle**

Inside the `TailoredProfile` component, add after other useState declarations:

```tsx
const [showPDFPreview, setShowPDFPreview] = useState(false);
```

**Step 3: Create helper to build PDF data**

Add this function inside the component (before the return statement):

```tsx
// Build PDF document data from resume
const pdfData = profile?.resume_data ? {
  name: "Your Name", // TODO: Get from user profile
  email: undefined,
  phone: undefined,
  summary: (profile.resume_data as ResumeData).summary || "",
  skills: (profile.resume_data as ResumeData).skills || [],
  experience: (profile.resume_data as ResumeData).experience || [],
  additionalExperience: (profile.resume_data as ResumeData).additionalExperience || [],
  ventures: (profile.resume_data as ResumeData).ventures || [],
  education: (profile.resume_data as ResumeData).education || [],
} : null;
```

**Step 4: Update the Resume tab content**

Find the Resume TabsContent section and update it to include the PDF toggle and preview. Replace the Resume tab's CardHeader with:

```tsx
<CardHeader className="flex flex-row items-center justify-between">
  <div className="flex items-center gap-2">
    <CardTitle>Resume</CardTitle>
    {pdfData && (
      <div className="flex gap-2 ml-4">
        <Button
          variant={showPDFPreview ? "default" : "outline"}
          size="sm"
          onClick={() => setShowPDFPreview(!showPDFPreview)}
        >
          <Eye className="h-4 w-4 mr-1" />
          {showPDFPreview ? "HTML View" : "PDF Preview"}
        </Button>
        <ResumePDFDownload
          data={pdfData}
          filename={`resume-${opportunity?.company?.toLowerCase().replace(/\s+/g, "-") || "tailored"}.pdf`}
        />
      </div>
    )}
  </div>
  {!showPDFPreview && (
    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(resumeData?.summary || "")}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  )}
</CardHeader>
```

**Step 5: Add conditional rendering for PDF preview**

Wrap the existing resume content in a conditional, and add PDF preview option:

```tsx
<CardContent>
  {showPDFPreview && pdfData ? (
    <ResumePDFViewer data={pdfData} />
  ) : (
    // ... existing resume HTML content ...
  )}
</CardContent>
```

**Step 6: Commit**

```bash
git add src/components/tailored-profile.tsx
git commit -m "feat: integrate PDF preview and download into tailored profile"
```

---

## Task 6: Add User Name to PDF

**Files:**
- Modify: `src/components/tailored-profile.tsx`
- Modify: `src/app/opportunities/[id]/page.tsx`

**Step 1: Pass user info to TailoredProfile**

In `src/app/opportunities/[id]/page.tsx`, add user metadata fetch and pass to component:

```tsx
// After getting user, fetch their metadata
const { data: userProfile } = await supabase
  .from("profiles")
  .select("full_name, email")
  .eq("id", user.id)
  .single();

// Pass to TailoredProfile
<TailoredProfile
  opportunityId={opportunity.id}
  requirementMatches={matches.requirementMatches}
  userName={userProfile?.full_name || user.email?.split("@")[0] || "Your Name"}
  userEmail={user.email}
/>
```

**Step 2: Update TailoredProfile props**

Add new props to the component interface and update pdfData:

```tsx
interface TailoredProfileProps {
  opportunityId: string;
  requirementMatches: RequirementMatch[];
  userName?: string;
  userEmail?: string;
}

// Update pdfData to use real name
const pdfData = profile?.resume_data ? {
  name: userName || "Your Name",
  email: userEmail,
  // ... rest unchanged
} : null;
```

**Step 3: Commit**

```bash
git add src/components/tailored-profile.tsx src/app/opportunities/[id]/page.tsx
git commit -m "feat: add user name and email to PDF resume"
```

---

## Task 7: Test and Verify

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Manual test**

1. Navigate to an opportunity with a generated profile
2. Go to the Resume tab
3. Click "PDF Preview" - should show embedded PDF
4. Click "Download PDF" - should download file
5. Click "HTML View" - should toggle back
6. Open downloaded PDF - verify formatting

**Step 3: Build verification**

```bash
npm run build
```

Expected: Build succeeds without errors

**Step 4: Final commit**

```bash
git add -A
git commit -m "test: verify PDF generation works end-to-end"
```

---

## Summary

| Task | Files | Commits |
|------|-------|---------|
| 1 | package.json | chore: add @react-pdf/renderer |
| 2 | resume-document.tsx | feat: PDF resume template |
| 3 | resume-pdf-viewer.tsx | feat: PDF preview viewer |
| 4 | resume-pdf-download.tsx, index.ts | feat: PDF download button |
| 5 | tailored-profile.tsx | feat: integrate PDF into profile |
| 6 | tailored-profile.tsx, page.tsx | feat: add user name to PDF |
| 7 | Manual testing | test: verify end-to-end |

Total: 6 new files, 2 modified files, ~400 lines of code
