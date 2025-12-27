# Opportunity Notes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to capture personal notes, ratings, and related links for each opportunity.

**Architecture:** New `opportunity_notes` table with API routes for CRUD operations. Client-side Notes tab component with auto-save behavior.

**Tech Stack:** Next.js API routes, Supabase, Vitest, React components with Phosphor icons.

---

## Task 1: Create Database Migration

**Files:**
- Create: `supabase/migrations/20250122200000_opportunity_notes.sql`

**Step 1: Write the migration**

```sql
-- Create opportunity_notes table
create table opportunity_notes (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Ratings (1-5, nullable)
  rating_tech_stack smallint check (rating_tech_stack is null or (rating_tech_stack >= 1 and rating_tech_stack <= 5)),
  rating_company smallint check (rating_company is null or (rating_company >= 1 and rating_company <= 5)),
  rating_industry smallint check (rating_industry is null or (rating_industry >= 1 and rating_industry <= 5)),
  rating_role_fit smallint check (rating_role_fit is null or (rating_role_fit >= 1 and rating_role_fit <= 5)),

  -- Links as JSONB array: [{url: string, label: string | null, type: string}]
  links jsonb not null default '[]'::jsonb,

  -- Free-form notes
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One notes record per opportunity per user
  unique(opportunity_id, user_id)
);

-- RLS policies
alter table opportunity_notes enable row level security;

create policy "Users can view their own notes"
  on opportunity_notes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notes"
  on opportunity_notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notes"
  on opportunity_notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own notes"
  on opportunity_notes for delete
  using (auth.uid() = user_id);

-- Updated_at trigger
create trigger set_updated_at
  before update on opportunity_notes
  for each row
  execute function update_updated_at_column();
```

**Step 2: Apply migration**

Run: `pnpm supabase migration up` (or via MCP tool)

**Step 3: Commit**

```bash
git add supabase/migrations/20250122200000_opportunity_notes.sql
git commit -m "feat: add opportunity_notes table for user ratings and notes"
```

---

## Task 2: Create URL Detection Utility

**Files:**
- Create: `src/lib/utils/url-detection.ts`
- Test: `src/__tests__/lib/utils/url-detection.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/__tests__/lib/utils/url-detection.test.ts
import { describe, it, expect } from 'vitest'
import { detectUrlType, type UrlType } from '@/lib/utils/url-detection'

describe('detectUrlType', () => {
  it('detects LinkedIn URLs', () => {
    expect(detectUrlType('https://www.linkedin.com/jobs/view/123')).toBe('linkedin')
    expect(detectUrlType('https://linkedin.com/in/johndoe')).toBe('linkedin')
  })

  it('detects Glassdoor URLs', () => {
    expect(detectUrlType('https://www.glassdoor.com/job-listing/123')).toBe('glassdoor')
  })

  it('detects Indeed URLs', () => {
    expect(detectUrlType('https://www.indeed.com/viewjob?jk=abc123')).toBe('indeed')
  })

  it('detects Greenhouse URLs', () => {
    expect(detectUrlType('https://boards.greenhouse.io/company/jobs/123')).toBe('greenhouse')
  })

  it('detects Lever URLs', () => {
    expect(detectUrlType('https://jobs.lever.co/company/123')).toBe('lever')
  })

  it('detects Workday URLs', () => {
    expect(detectUrlType('https://company.myworkdayjobs.com/en-US/careers/job/123')).toBe('workday')
  })

  it('detects generic careers subdomains', () => {
    expect(detectUrlType('https://careers.acme.com/jobs/123')).toBe('careers')
    expect(detectUrlType('https://jobs.startup.io/apply')).toBe('careers')
  })

  it('returns link for unknown URLs', () => {
    expect(detectUrlType('https://example.com/something')).toBe('link')
    expect(detectUrlType('https://blog.medium.com/article')).toBe('link')
  })

  it('handles invalid URLs gracefully', () => {
    expect(detectUrlType('not a url')).toBe('link')
    expect(detectUrlType('')).toBe('link')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test src/__tests__/lib/utils/url-detection.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
// src/lib/utils/url-detection.ts
export type UrlType =
  | 'linkedin'
  | 'glassdoor'
  | 'indeed'
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'careers'
  | 'link'

export function detectUrlType(url: string): UrlType {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    // Specific platforms
    if (hostname.includes('linkedin.com')) return 'linkedin'
    if (hostname.includes('glassdoor.com')) return 'glassdoor'
    if (hostname.includes('indeed.com')) return 'indeed'
    if (hostname.includes('greenhouse.io')) return 'greenhouse'
    if (hostname.includes('lever.co')) return 'lever'
    if (hostname.includes('myworkdayjobs.com') || hostname.includes('workday.com')) return 'workday'

    // Generic careers/jobs subdomains
    if (hostname.startsWith('careers.') || hostname.startsWith('jobs.')) return 'careers'

    return 'link'
  } catch {
    return 'link'
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test src/__tests__/lib/utils/url-detection.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/utils/url-detection.ts src/__tests__/lib/utils/url-detection.test.ts
git commit -m "feat: add URL type detection utility for smart links"
```

---

## Task 3: Create Opportunity Notes API Route

**Files:**
- Create: `src/app/api/opportunity-notes/route.ts`
- Test: `src/__tests__/app/api/opportunity-notes/route.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/__tests__/app/api/opportunity-notes/route.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockSupabaseFrom = vi.fn()
const mockGetUser = vi.fn()

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    from: mockSupabaseFrom,
    auth: {
      getUser: mockGetUser
    }
  }))
}))

function createMockRequest(
  url: string,
  options: { method?: string; body?: unknown } = {}
): NextRequest {
  const { method = 'GET', body } = options
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
}

async function parseJson<T>(response: Response): Promise<T> {
  return JSON.parse(await response.text()) as T
}

describe('Opportunity Notes API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
  })

  describe('GET /api/opportunity-notes', () => {
    it('returns existing notes for an opportunity', async () => {
      const mockNotes = {
        id: 'note-1',
        opportunity_id: 'opp-123',
        rating_tech_stack: 4,
        rating_company: 5,
        rating_industry: 3,
        rating_role_fit: 4,
        links: [{ url: 'https://linkedin.com/jobs/123', label: 'Original posting', type: 'linkedin' }],
        notes: 'Great opportunity!'
      }

      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockNotes, error: null })
            })
          })
        })
      }))

      const { GET } = await import('@/app/api/opportunity-notes/route')
      const request = createMockRequest('/api/opportunity-notes?opportunityId=opp-123')
      const response = await GET(request)
      const body = await parseJson<typeof mockNotes>(response)

      expect(response.status).toBe(200)
      expect(body.rating_tech_stack).toBe(4)
      expect(body.notes).toBe('Great opportunity!')
    })

    it('returns empty defaults when no notes exist', async () => {
      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
            })
          })
        })
      }))

      const { GET } = await import('@/app/api/opportunity-notes/route')
      const request = createMockRequest('/api/opportunity-notes?opportunityId=opp-123')
      const response = await GET(request)
      const body = await parseJson<{ rating_tech_stack: null }>(response)

      expect(response.status).toBe(200)
      expect(body.rating_tech_stack).toBeNull()
    })

    it('returns 400 when opportunityId is missing', async () => {
      const { GET } = await import('@/app/api/opportunity-notes/route')
      const request = createMockRequest('/api/opportunity-notes')
      const response = await GET(request)

      expect(response.status).toBe(400)
    })

    it('returns 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const { GET } = await import('@/app/api/opportunity-notes/route')
      const request = createMockRequest('/api/opportunity-notes?opportunityId=opp-123')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })
  })

  describe('PUT /api/opportunity-notes', () => {
    it('upserts notes for an opportunity', async () => {
      const mockUpsertedNotes = {
        id: 'note-1',
        opportunity_id: 'opp-123',
        rating_tech_stack: 5,
        links: [],
        notes: 'Updated notes'
      }

      mockSupabaseFrom.mockImplementation(() => ({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockUpsertedNotes, error: null })
          })
        })
      }))

      const { PUT } = await import('@/app/api/opportunity-notes/route')
      const request = createMockRequest('/api/opportunity-notes', {
        method: 'PUT',
        body: {
          opportunityId: 'opp-123',
          rating_tech_stack: 5,
          notes: 'Updated notes'
        }
      })
      const response = await PUT(request)
      const body = await parseJson<typeof mockUpsertedNotes>(response)

      expect(response.status).toBe(200)
      expect(body.rating_tech_stack).toBe(5)
    })

    it('returns 400 when opportunityId is missing', async () => {
      const { PUT } = await import('@/app/api/opportunity-notes/route')
      const request = createMockRequest('/api/opportunity-notes', {
        method: 'PUT',
        body: { rating_tech_stack: 5 }
      })
      const response = await PUT(request)

      expect(response.status).toBe(400)
    })

    it('returns 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const { PUT } = await import('@/app/api/opportunity-notes/route')
      const request = createMockRequest('/api/opportunity-notes', {
        method: 'PUT',
        body: { opportunityId: 'opp-123', rating_tech_stack: 5 }
      })
      const response = await PUT(request)

      expect(response.status).toBe(401)
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test src/__tests__/app/api/opportunity-notes/route.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
// src/app/api/opportunity-notes/route.ts
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

interface OpportunityNotes {
  rating_tech_stack: number | null
  rating_company: number | null
  rating_industry: number | null
  rating_role_fit: number | null
  links: Array<{ url: string; label: string | null; type: string }>
  notes: string | null
}

const EMPTY_NOTES: OpportunityNotes = {
  rating_tech_stack: null,
  rating_company: null,
  rating_industry: null,
  rating_role_fit: null,
  links: [],
  notes: null
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const opportunityId = request.nextUrl.searchParams.get("opportunityId")
  if (!opportunityId) {
    return NextResponse.json({ error: "opportunityId is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("opportunity_notes")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .eq("user_id", user.id)
    .single()

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching notes:", error)
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 })
  }

  return NextResponse.json(data || EMPTY_NOTES)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { opportunityId, ...noteData } = body

  if (!opportunityId) {
    return NextResponse.json({ error: "opportunityId is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("opportunity_notes")
    .upsert({
      opportunity_id: opportunityId,
      user_id: user.id,
      ...noteData,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "opportunity_id,user_id"
    })
    .select()
    .single()

  if (error) {
    console.error("Error upserting notes:", error)
    return NextResponse.json({ error: "Failed to save notes" }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test src/__tests__/app/api/opportunity-notes/route.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/app/api/opportunity-notes/route.ts src/__tests__/app/api/opportunity-notes/route.test.ts
git commit -m "feat: add opportunity notes API routes for GET and PUT"
```

---

## Task 4: Create RatingInput Component

**Files:**
- Create: `src/components/rating-input.tsx`
- Test: `src/__tests__/components/rating-input.test.tsx`

**Step 1: Write the failing tests**

```typescript
// src/__tests__/components/rating-input.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RatingInput } from '@/components/rating-input'

describe('RatingInput', () => {
  it('renders label and 5 rating buttons', () => {
    render(<RatingInput label="Tech Stack" value={null} onChange={() => {}} />)

    expect(screen.getByText('Tech Stack')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('highlights selected rating', () => {
    render(<RatingInput label="Tech Stack" value={3} onChange={() => {}} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons[2]).toHaveAttribute('data-selected', 'true')
  })

  it('calls onChange when rating is clicked', () => {
    const onChange = vi.fn()
    render(<RatingInput label="Tech Stack" value={null} onChange={onChange} />)

    fireEvent.click(screen.getByText('4'))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('clears rating when same value is clicked', () => {
    const onChange = vi.fn()
    render(<RatingInput label="Tech Stack" value={3} onChange={onChange} />)

    fireEvent.click(screen.getByText('3'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('shows unrated state when value is null', () => {
    render(<RatingInput label="Tech Stack" value={null} onChange={() => {}} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).not.toHaveAttribute('data-selected', 'true')
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test src/__tests__/components/rating-input.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
// src/components/rating-input.tsx
"use client"

interface RatingInputProps {
  label: string
  value: number | null
  onChange: (value: number | null) => void
}

export function RatingInput({ label, value, onChange }: RatingInputProps) {
  const handleClick = (rating: number) => {
    // Toggle off if clicking the same rating
    if (value === rating) {
      onChange(null)
    } else {
      onChange(rating)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => handleClick(rating)}
            data-selected={value === rating}
            className={`
              w-8 h-8 rounded-md text-sm font-medium transition-colors
              ${value === rating
                ? 'bg-primary text-primary-foreground'
                : value !== null && rating <= value
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }
            `}
          >
            {rating}
          </button>
        ))}
      </div>
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test src/__tests__/components/rating-input.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/rating-input.tsx src/__tests__/components/rating-input.test.tsx
git commit -m "feat: add RatingInput component for 1-5 ratings"
```

---

## Task 5: Create SmartLinkInput Component

**Files:**
- Create: `src/components/smart-link-input.tsx`
- Test: `src/__tests__/components/smart-link-input.test.tsx`

**Step 1: Write the failing tests**

```typescript
// src/__tests__/components/smart-link-input.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SmartLinkInput } from '@/components/smart-link-input'

describe('SmartLinkInput', () => {
  it('renders URL input and label input', () => {
    render(<SmartLinkInput onAdd={() => {}} />)

    expect(screen.getByPlaceholderText(/paste.*url/i)).toBeInTheDocument()
  })

  it('shows detected type when URL is entered', async () => {
    const user = userEvent.setup()
    render(<SmartLinkInput onAdd={() => {}} />)

    const input = screen.getByPlaceholderText(/paste.*url/i)
    await user.type(input, 'https://linkedin.com/jobs/123')

    expect(screen.getByText(/linkedin/i)).toBeInTheDocument()
  })

  it('calls onAdd with link data when Add button clicked', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<SmartLinkInput onAdd={onAdd} />)

    await user.type(screen.getByPlaceholderText(/paste.*url/i), 'https://linkedin.com/jobs/123')
    await user.type(screen.getByPlaceholderText(/label/i), 'Main posting')
    await user.click(screen.getByRole('button', { name: /add/i }))

    expect(onAdd).toHaveBeenCalledWith({
      url: 'https://linkedin.com/jobs/123',
      label: 'Main posting',
      type: 'linkedin'
    })
  })

  it('clears inputs after adding', async () => {
    const user = userEvent.setup()
    render(<SmartLinkInput onAdd={() => {}} />)

    const urlInput = screen.getByPlaceholderText(/paste.*url/i)
    await user.type(urlInput, 'https://example.com')
    await user.click(screen.getByRole('button', { name: /add/i }))

    expect(urlInput).toHaveValue('')
  })

  it('disables Add button when URL is empty', () => {
    render(<SmartLinkInput onAdd={() => {}} />)

    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test src/__tests__/components/smart-link-input.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
// src/components/smart-link-input.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus } from "@phosphor-icons/react"
import { detectUrlType, type UrlType } from "@/lib/utils/url-detection"

interface LinkData {
  url: string
  label: string | null
  type: UrlType
}

interface SmartLinkInputProps {
  onAdd: (link: LinkData) => void
}

export function SmartLinkInput({ onAdd }: SmartLinkInputProps) {
  const [url, setUrl] = useState("")
  const [label, setLabel] = useState("")
  const [detectedType, setDetectedType] = useState<UrlType>("link")

  const handleUrlChange = (value: string) => {
    setUrl(value)
    setDetectedType(detectUrlType(value))
  }

  const handleAdd = () => {
    if (!url.trim()) return

    onAdd({
      url: url.trim(),
      label: label.trim() || null,
      type: detectedType
    })

    setUrl("")
    setLabel("")
    setDetectedType("link")
  }

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1 space-y-1">
        <Input
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="Paste a URL..."
          className="text-sm"
        />
        {url && detectedType !== "link" && (
          <span className="text-xs text-muted-foreground capitalize">
            Detected: {detectedType}
          </span>
        )}
      </div>
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label (optional)"
        className="w-32 text-sm"
      />
      <Button
        type="button"
        size="sm"
        onClick={handleAdd}
        disabled={!url.trim()}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add
      </Button>
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test src/__tests__/components/smart-link-input.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/smart-link-input.tsx src/__tests__/components/smart-link-input.test.tsx
git commit -m "feat: add SmartLinkInput component with URL type detection"
```

---

## Task 6: Create SmartLinksList Component

**Files:**
- Create: `src/components/smart-links-list.tsx`
- Test: `src/__tests__/components/smart-links-list.test.tsx`

**Step 1: Write the failing tests**

```typescript
// src/__tests__/components/smart-links-list.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SmartLinksList } from '@/components/smart-links-list'

const mockLinks = [
  { url: 'https://linkedin.com/jobs/123', label: 'Main posting', type: 'linkedin' as const },
  { url: 'https://careers.acme.com/jobs/456', label: null, type: 'careers' as const }
]

describe('SmartLinksList', () => {
  it('renders list of links', () => {
    render(<SmartLinksList links={mockLinks} onRemove={() => {}} />)

    expect(screen.getByText('Main posting')).toBeInTheDocument()
    expect(screen.getByText(/linkedin.com/)).toBeInTheDocument()
  })

  it('shows URL as label when label is null', () => {
    render(<SmartLinksList links={mockLinks} onRemove={() => {}} />)

    expect(screen.getByText(/careers.acme.com/)).toBeInTheDocument()
  })

  it('calls onRemove when delete button clicked', () => {
    const onRemove = vi.fn()
    render(<SmartLinksList links={mockLinks} onRemove={onRemove} />)

    const deleteButtons = screen.getAllByRole('button')
    fireEvent.click(deleteButtons[0])

    expect(onRemove).toHaveBeenCalledWith(0)
  })

  it('renders empty state when no links', () => {
    render(<SmartLinksList links={[]} onRemove={() => {}} />)

    expect(screen.getByText(/no links/i)).toBeInTheDocument()
  })

  it('links open in new tab', () => {
    render(<SmartLinksList links={mockLinks} onRemove={() => {}} />)

    const link = screen.getByRole('link', { name: /main posting/i })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test src/__tests__/components/smart-links-list.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
// src/components/smart-links-list.tsx
"use client"

import { Button } from "@/components/ui/button"
import { X, LinkedinLogo, Briefcase, Link as LinkIcon } from "@phosphor-icons/react"
import type { UrlType } from "@/lib/utils/url-detection"

interface LinkData {
  url: string
  label: string | null
  type: UrlType
}

interface SmartLinksListProps {
  links: LinkData[]
  onRemove: (index: number) => void
}

function getIconForType(type: UrlType) {
  switch (type) {
    case 'linkedin':
      return <LinkedinLogo className="h-4 w-4 text-[#0A66C2]" weight="fill" />
    case 'glassdoor':
    case 'indeed':
    case 'greenhouse':
    case 'lever':
    case 'workday':
    case 'careers':
      return <Briefcase className="h-4 w-4 text-muted-foreground" />
    default:
      return <LinkIcon className="h-4 w-4 text-muted-foreground" />
  }
}

function getDisplayUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace('www.', '') + (parsed.pathname !== '/' ? parsed.pathname.slice(0, 20) + '...' : '')
  } catch {
    return url.slice(0, 30) + '...'
  }
}

export function SmartLinksList({ links, onRemove }: SmartLinksListProps) {
  if (links.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No links added yet</p>
    )
  }

  return (
    <ul className="space-y-2">
      {links.map((link, index) => (
        <li key={index} className="flex items-center gap-2 group">
          {getIconForType(link.type)}
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-sm hover:underline truncate"
          >
            {link.label || getDisplayUrl(link.url)}
          </a>
          <span className="text-xs text-muted-foreground hidden group-hover:inline">
            {getDisplayUrl(link.url)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </Button>
        </li>
      ))}
    </ul>
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test src/__tests__/components/smart-links-list.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/smart-links-list.tsx src/__tests__/components/smart-links-list.test.tsx
git commit -m "feat: add SmartLinksList component with icons and delete"
```

---

## Task 7: Create OpportunityNotes Component

**Files:**
- Create: `src/components/opportunity-notes.tsx`
- Test: `src/__tests__/components/opportunity-notes.test.tsx`

**Step 1: Write the failing tests**

```typescript
// src/__tests__/components/opportunity-notes.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OpportunityNotes } from '@/components/opportunity-notes'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('OpportunityNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        rating_tech_stack: null,
        rating_company: null,
        rating_industry: null,
        rating_role_fit: null,
        links: [],
        notes: null
      })
    })
  })

  it('fetches notes on mount', async () => {
    render(<OpportunityNotes opportunityId="opp-123" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/opportunity-notes?opportunityId=opp-123')
    })
  })

  it('renders rating inputs', async () => {
    render(<OpportunityNotes opportunityId="opp-123" />)

    await waitFor(() => {
      expect(screen.getByText('Tech Stack')).toBeInTheDocument()
      expect(screen.getByText('Company')).toBeInTheDocument()
      expect(screen.getByText('Industry')).toBeInTheDocument()
      expect(screen.getByText('Role Fit')).toBeInTheDocument()
    })
  })

  it('renders links section', async () => {
    render(<OpportunityNotes opportunityId="opp-123" />)

    await waitFor(() => {
      expect(screen.getByText('Links')).toBeInTheDocument()
    })
  })

  it('renders notes textarea', async () => {
    render(<OpportunityNotes opportunityId="opp-123" />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add your thoughts/i)).toBeInTheDocument()
    })
  })

  it('auto-saves when rating changes', async () => {
    const user = userEvent.setup()
    render(<OpportunityNotes opportunityId="opp-123" />)

    await waitFor(() => screen.getByText('Tech Stack'))

    // Click rating button
    const techStackButtons = screen.getAllByRole('button').filter(b => b.textContent === '4')
    await user.click(techStackButtons[0])

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/opportunity-notes', expect.objectContaining({
        method: 'PUT'
      }))
    })
  })

  it('shows saving indicator', async () => {
    const user = userEvent.setup()
    mockFetch.mockImplementation(() => new Promise(resolve =>
      setTimeout(() => resolve({ ok: true, json: () => Promise.resolve({}) }), 100)
    ))

    render(<OpportunityNotes opportunityId="opp-123" />)

    await waitFor(() => screen.getByText('Tech Stack'))

    const buttons = screen.getAllByRole('button').filter(b => b.textContent === '4')
    await user.click(buttons[0])

    expect(screen.getByText(/saving/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test src/__tests__/components/opportunity-notes.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
// src/components/opportunity-notes.tsx
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { RatingInput } from "@/components/rating-input"
import { SmartLinkInput } from "@/components/smart-link-input"
import { SmartLinksList } from "@/components/smart-links-list"
import { SpinnerGap, Check } from "@phosphor-icons/react"
import type { UrlType } from "@/lib/utils/url-detection"

interface LinkData {
  url: string
  label: string | null
  type: UrlType
}

interface NotesData {
  rating_tech_stack: number | null
  rating_company: number | null
  rating_industry: number | null
  rating_role_fit: number | null
  links: LinkData[]
  notes: string | null
}

interface OpportunityNotesProps {
  opportunityId: string
}

export function OpportunityNotes({ opportunityId }: OpportunityNotesProps) {
  const [data, setData] = useState<NotesData>({
    rating_tech_stack: null,
    rating_company: null,
    rating_industry: null,
    rating_role_fit: null,
    links: [],
    notes: null
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Fetch notes on mount
  useEffect(() => {
    async function fetchNotes() {
      try {
        const response = await fetch(`/api/opportunity-notes?opportunityId=${opportunityId}`)
        if (response.ok) {
          const notes = await response.json()
          setData(notes)
        }
      } catch (error) {
        console.error("Failed to fetch notes:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchNotes()
  }, [opportunityId])

  // Save function
  const saveNotes = useCallback(async (newData: NotesData) => {
    setSaving(true)
    setSaved(false)
    try {
      await fetch("/api/opportunity-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId,
          ...newData
        })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error("Failed to save notes:", error)
    } finally {
      setSaving(false)
    }
  }, [opportunityId])

  // Update and save immediately (for ratings and links)
  const updateAndSave = (updates: Partial<NotesData>) => {
    const newData = { ...data, ...updates }
    setData(newData)
    saveNotes(newData)
  }

  // Update with debounce (for notes text)
  const updateWithDebounce = (updates: Partial<NotesData>) => {
    const newData = { ...data, ...updates }
    setData(newData)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      saveNotes(newData)
    }, 500)
  }

  const handleAddLink = (link: LinkData) => {
    updateAndSave({ links: [...data.links, link] })
  }

  const handleRemoveLink = (index: number) => {
    updateAndSave({ links: data.links.filter((_, i) => i !== index) })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <SpinnerGap className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Your Notes</CardTitle>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {saving && (
              <>
                <SpinnerGap className="h-3 w-3 animate-spin" />
                Saving...
              </>
            )}
            {saved && !saving && (
              <>
                <Check className="h-3 w-3 text-green-500" />
                Saved
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ratings */}
        <div>
          <h4 className="text-sm font-medium mb-3">Ratings</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <RatingInput
              label="Tech Stack"
              value={data.rating_tech_stack}
              onChange={(v) => updateAndSave({ rating_tech_stack: v })}
            />
            <RatingInput
              label="Company"
              value={data.rating_company}
              onChange={(v) => updateAndSave({ rating_company: v })}
            />
            <RatingInput
              label="Industry"
              value={data.rating_industry}
              onChange={(v) => updateAndSave({ rating_industry: v })}
            />
            <RatingInput
              label="Role Fit"
              value={data.rating_role_fit}
              onChange={(v) => updateAndSave({ rating_role_fit: v })}
            />
          </div>
        </div>

        {/* Links */}
        <div>
          <h4 className="text-sm font-medium mb-3">Links</h4>
          <div className="space-y-3">
            <SmartLinksList links={data.links} onRemove={handleRemoveLink} />
            <SmartLinkInput onAdd={handleAddLink} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <h4 className="text-sm font-medium mb-2">Notes</h4>
          <Textarea
            value={data.notes || ""}
            onChange={(e) => updateWithDebounce({ notes: e.target.value || null })}
            placeholder="Add your thoughts about this opportunity..."
            className="min-h-[120px] resize-y"
          />
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test src/__tests__/components/opportunity-notes.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/opportunity-notes.tsx src/__tests__/components/opportunity-notes.test.tsx
git commit -m "feat: add OpportunityNotes component with auto-save"
```

---

## Task 8: Add Notes Tab to Opportunity Detail Page

**Files:**
- Modify: `src/app/opportunities/[id]/page.tsx`

**Step 1: Import OpportunityNotes component**

Add import at top of file:
```typescript
import { OpportunityNotes } from "@/components/opportunity-notes";
```

**Step 2: Add Notes section after Company Insights**

Find the `{/* Company Insights */}` section and add after it:

```typescript
      {/* Your Notes */}
      <OpportunityNotes opportunityId={id} />
```

**Step 3: Verify the page loads**

Run: `pnpm dev`
Navigate to an opportunity detail page and verify Notes section appears.

**Step 4: Commit**

```bash
git add src/app/opportunities/[id]/page.tsx
git commit -m "feat: add Notes section to opportunity detail page"
```

---

## Task 9: Run Full Test Suite

**Step 1: Run all tests**

Run: `pnpm test:run`
Expected: All tests PASS

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No errors

**Step 3: Verify build**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve any test or build issues"
```

---

## Summary

| Task | Description | Files | Tests |
|------|-------------|-------|-------|
| 1 | Database migration | 1 new | - |
| 2 | URL detection utility | 1 new | 9 tests |
| 3 | API routes | 1 new | 8 tests |
| 4 | RatingInput component | 1 new | 5 tests |
| 5 | SmartLinkInput component | 1 new | 5 tests |
| 6 | SmartLinksList component | 1 new | 5 tests |
| 7 | OpportunityNotes component | 1 new | 6 tests |
| 8 | Page integration | 1 modified | - |
| 9 | Full test suite | - | All pass |

**Total: 8 new files, 1 modified, ~38 unit tests**
