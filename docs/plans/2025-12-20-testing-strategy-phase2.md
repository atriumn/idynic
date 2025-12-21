# Testing Strategy Phase 2: AI Core

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve 85% coverage on AI extraction, matching, and generation modules.

**Architecture:** Mock OpenAI SDK, create test fixtures with realistic resumes and job descriptions, test extraction accuracy, matching logic, and generation output structure.

**Tech Stack:** Vitest, OpenAI mock factory from Phase 1

**Design Document:** `docs/plans/2025-12-20-testing-strategy-design.md`

**Prerequisite:** Phase 1 complete

---

## Task 1: Create Test Fixtures

**Files:**
- Create: `src/__fixtures__/resumes/software-engineer.txt`
- Create: `src/__fixtures__/resumes/product-manager.txt`
- Create: `src/__fixtures__/opportunities/senior-engineer.json`
- Create: `src/__fixtures__/openai/extract-resume-response.json`

**Step 1: Create software engineer resume fixture**

```text
JANE DOE
jane.doe@email.com | (555) 123-4567 | linkedin.com/in/janedoe | github.com/janedoe

SUMMARY
Senior Software Engineer with 8+ years of experience building scalable distributed systems. Expert in TypeScript, Python, and cloud infrastructure. Led teams of 5-10 engineers.

EXPERIENCE

Senior Software Engineer | TechCorp Inc. | Jan 2021 - Present
- Architected microservices platform handling 10M requests/day
- Reduced API latency by 40% through caching optimization
- Mentored 5 junior engineers on system design best practices
- Led migration from monolith to microservices architecture

Software Engineer | StartupXYZ | Mar 2018 - Dec 2020
- Built real-time analytics dashboard using React and WebSockets
- Implemented CI/CD pipeline reducing deployment time from 2 hours to 15 minutes
- Designed PostgreSQL schema for multi-tenant SaaS application

Junior Developer | Agency Co | Jun 2016 - Feb 2018
- Developed responsive web applications for 20+ clients
- Created reusable component library used across 15 projects

EDUCATION
B.S. Computer Science | State University | 2016

SKILLS
Languages: TypeScript, Python, Go, SQL
Frameworks: React, Node.js, FastAPI, Next.js
Infrastructure: AWS, Kubernetes, Docker, Terraform
Databases: PostgreSQL, Redis, MongoDB
```

**Step 2: Create opportunity fixture**

```json
{
  "title": "Senior Software Engineer",
  "company": "ExampleTech",
  "url": "https://example.com/jobs/123",
  "description": "We're looking for a Senior Software Engineer to join our platform team...",
  "requirements": [
    "5+ years of software engineering experience",
    "Strong TypeScript and React skills",
    "Experience with distributed systems",
    "Excellent communication skills"
  ],
  "nice_to_have": [
    "Experience with Kubernetes",
    "Background in fintech"
  ]
}
```

**Step 3: Create OpenAI response fixture**

```json
{
  "name": "Jane Doe",
  "email": "jane.doe@email.com",
  "phone": "(555) 123-4567",
  "experience": [
    {
      "company": "TechCorp Inc.",
      "title": "Senior Software Engineer",
      "start_date": "2021-01",
      "end_date": null,
      "highlights": [
        "Architected microservices platform handling 10M requests/day",
        "Reduced API latency by 40%"
      ]
    }
  ],
  "skills": ["TypeScript", "Python", "React", "AWS", "Kubernetes"],
  "education": [
    {
      "institution": "State University",
      "degree": "B.S. Computer Science",
      "year": 2016
    }
  ]
}
```

**Step 4: Commit**

```bash
mkdir -p src/__fixtures__/resumes src/__fixtures__/opportunities src/__fixtures__/openai
git add src/__fixtures__/
git commit -m "test: add resume and opportunity fixtures"
```

---

## Task 2: Test Embeddings Module

**Files:**
- Create: `src/__tests__/unit/lib/ai/embeddings.test.ts`

**Step 1: Read the embeddings module**

Read `src/lib/ai/embeddings.ts` to understand the API.

**Step 2: Create tests**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockOpenAI } from '@/__mocks__/openai'

vi.mock('openai')

describe('lib/ai/embeddings', () => {
  let mockOpenAI: ReturnType<typeof createMockOpenAI>

  beforeEach(async () => {
    vi.resetModules()
    mockOpenAI = createMockOpenAI({
      embeddingVector: new Array(1536).fill(0.5)
    })
    const OpenAI = (await import('openai')).default
    vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any)
  })

  describe('generateEmbedding', () => {
    it('returns embedding vector for text', async () => {
      const { generateEmbedding } = await import('@/lib/ai/embeddings')
      const embedding = await generateEmbedding('test text')

      expect(embedding).toBeInstanceOf(Array)
      expect(embedding.length).toBe(1536)
    })

    it('calls OpenAI with correct model', async () => {
      const { generateEmbedding } = await import('@/lib/ai/embeddings')
      await generateEmbedding('test')

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'text-embedding-3-small'
        })
      )
    })

    it('throws on empty text', async () => {
      const { generateEmbedding } = await import('@/lib/ai/embeddings')
      await expect(generateEmbedding('')).rejects.toThrow()
    })

    it('handles OpenAI errors gracefully', async () => {
      mockOpenAI = createMockOpenAI({ shouldFail: true, failureMessage: 'API error' })
      const OpenAI = (await import('openai')).default
      vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any)

      const { generateEmbedding } = await import('@/lib/ai/embeddings')
      await expect(generateEmbedding('test')).rejects.toThrow('API error')
    })
  })

  describe('generateEmbeddings (batch)', () => {
    it('returns embeddings for multiple texts', async () => {
      const { generateEmbeddings } = await import('@/lib/ai/embeddings')
      const texts = ['text1', 'text2', 'text3']
      const embeddings = await generateEmbeddings(texts)

      expect(embeddings.length).toBe(texts.length)
    })

    it('handles empty array', async () => {
      const { generateEmbeddings } = await import('@/lib/ai/embeddings')
      const embeddings = await generateEmbeddings([])

      expect(embeddings).toEqual([])
    })
  })
})
```

**Step 3: Run tests**

```bash
pnpm test embeddings
```

**Step 4: Commit**

```bash
mkdir -p src/__tests__/unit/lib/ai
git add src/__tests__/unit/lib/ai/embeddings.test.ts
git commit -m "test: add embeddings module tests"
```

---

## Task 3: Test Resume Extraction Module

**Files:**
- Create: `src/__tests__/unit/lib/ai/extract-resume.test.ts`

**Step 1: Read the extract-resume module**

Read `src/lib/ai/extract-resume.ts` to understand the API.

**Step 2: Create tests**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createMockOpenAI } from '@/__mocks__/openai'

vi.mock('openai')

describe('lib/ai/extract-resume', () => {
  let mockOpenAI: ReturnType<typeof createMockOpenAI>
  const fixturesPath = join(__dirname, '../../../../__fixtures__')

  beforeEach(async () => {
    vi.resetModules()
  })

  describe('extractResumeData', () => {
    it('extracts structured data from resume text', async () => {
      const expectedOutput = JSON.parse(
        readFileSync(join(fixturesPath, 'openai/extract-resume-response.json'), 'utf-8')
      )
      mockOpenAI = createMockOpenAI({
        chatResponse: JSON.stringify(expectedOutput)
      })
      const OpenAI = (await import('openai')).default
      vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any)

      const { extractResumeData } = await import('@/lib/ai/extract-resume')
      const resumeText = readFileSync(
        join(fixturesPath, 'resumes/software-engineer.txt'),
        'utf-8'
      )

      const result = await extractResumeData(resumeText)

      expect(result.name).toBeDefined()
      expect(result.experience).toBeInstanceOf(Array)
      expect(result.skills).toBeInstanceOf(Array)
    })

    it('handles resume with minimal information', async () => {
      mockOpenAI = createMockOpenAI({
        chatResponse: JSON.stringify({
          name: 'John',
          email: null,
          experience: [],
          skills: []
        })
      })
      const OpenAI = (await import('openai')).default
      vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any)

      const { extractResumeData } = await import('@/lib/ai/extract-resume')
      const result = await extractResumeData('John\nLooking for work')

      expect(result.name).toBe('John')
      expect(result.experience).toEqual([])
    })

    it('throws on empty input', async () => {
      const { extractResumeData } = await import('@/lib/ai/extract-resume')
      await expect(extractResumeData('')).rejects.toThrow()
    })

    it('handles malformed JSON response gracefully', async () => {
      mockOpenAI = createMockOpenAI({
        chatResponse: 'not valid json'
      })
      const OpenAI = (await import('openai')).default
      vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any)

      const { extractResumeData } = await import('@/lib/ai/extract-resume')
      await expect(extractResumeData('test resume')).rejects.toThrow()
    })

    it('uses correct prompt structure', async () => {
      mockOpenAI = createMockOpenAI({
        chatResponse: JSON.stringify({ name: 'Test' })
      })
      const OpenAI = (await import('openai')).default
      vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any)

      const { extractResumeData } = await import('@/lib/ai/extract-resume')
      await extractResumeData('test resume')

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' })
          ])
        })
      )
    })
  })
})
```

**Step 3: Run tests**

```bash
pnpm test extract-resume
```

**Step 4: Commit**

```bash
git add src/__tests__/unit/lib/ai/extract-resume.test.ts
git commit -m "test: add resume extraction tests"
```

---

## Task 4: Test Work History Extraction

**Files:**
- Create: `src/__tests__/unit/lib/ai/extract-work-history.test.ts`

**Step 1: Read the module and create tests following the same pattern as Task 3**

Key test cases:
- Extracts multiple work entries
- Handles current positions (no end date)
- Parses date formats correctly
- Handles missing fields gracefully
- Validates output structure

**Step 2: Commit**

```bash
git add src/__tests__/unit/lib/ai/extract-work-history.test.ts
git commit -m "test: add work history extraction tests"
```

---

## Task 5: Test Opportunity Matching

**Files:**
- Create: `src/__tests__/unit/lib/ai/match-opportunity.test.ts`

**Step 1: Create tests**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockOpenAI } from '@/__mocks__/openai'
import { createMockSupabaseClient } from '@/__mocks__/supabase'

vi.mock('openai')
vi.mock('@/lib/supabase/service-role')

describe('lib/ai/match-opportunity', () => {
  let mockOpenAI: ReturnType<typeof createMockOpenAI>
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(async () => {
    vi.resetModules()
    mockSupabase = createMockSupabaseClient()

    const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
    vi.mocked(createServiceRoleClient).mockReturnValue(mockSupabase as any)
  })

  describe('matchOpportunity', () => {
    it('returns match scores for each requirement', async () => {
      mockOpenAI = createMockOpenAI({
        embeddingVector: new Array(1536).fill(0.5)
      })
      const OpenAI = (await import('openai')).default
      vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any)

      // Mock claims data
      mockSupabase.__setMockData([
        { id: 'claim-1', type: 'skill', value: 'TypeScript', embedding: new Array(1536).fill(0.5) },
        { id: 'claim-2', type: 'experience', value: '5 years React', embedding: new Array(1536).fill(0.4) }
      ])

      const { matchOpportunity } = await import('@/lib/ai/match-opportunity')
      const result = await matchOpportunity('user-1', {
        requirements: ['TypeScript experience', 'React skills']
      })

      expect(result.matches).toBeInstanceOf(Array)
      expect(result.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.overallScore).toBeLessThanOrEqual(1)
    })

    it('identifies gaps when claims dont match', async () => {
      mockOpenAI = createMockOpenAI({
        embeddingVector: new Array(1536).fill(0.1) // Low similarity
      })
      const OpenAI = (await import('openai')).default
      vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any)

      mockSupabase.__setMockData([]) // No matching claims

      const { matchOpportunity } = await import('@/lib/ai/match-opportunity')
      const result = await matchOpportunity('user-1', {
        requirements: ['10 years Rust experience']
      })

      expect(result.gaps.length).toBeGreaterThan(0)
    })

    it('handles empty requirements', async () => {
      const { matchOpportunity } = await import('@/lib/ai/match-opportunity')
      const result = await matchOpportunity('user-1', { requirements: [] })

      expect(result.matches).toEqual([])
      expect(result.overallScore).toBe(0)
    })
  })

  describe('calculateSimilarity', () => {
    it('returns 1 for identical vectors', async () => {
      const { calculateSimilarity } = await import('@/lib/ai/match-opportunity')
      const vec = new Array(1536).fill(0.5)
      const similarity = calculateSimilarity(vec, vec)

      expect(similarity).toBeCloseTo(1, 5)
    })

    it('returns 0 for orthogonal vectors', async () => {
      const { calculateSimilarity } = await import('@/lib/ai/match-opportunity')
      const vec1 = [1, 0, 0]
      const vec2 = [0, 1, 0]
      const similarity = calculateSimilarity(vec1, vec2)

      expect(similarity).toBeCloseTo(0, 5)
    })
  })
})
```

**Step 2: Run tests**

```bash
pnpm test match-opportunity
```

**Step 3: Commit**

```bash
git add src/__tests__/unit/lib/ai/match-opportunity.test.ts
git commit -m "test: add opportunity matching tests"
```

---

## Task 6: Test Claims Synthesis

**Files:**
- Create: `src/__tests__/unit/lib/ai/synthesize-claims.test.ts`

Key test cases:
- Synthesizes claims from extracted data
- Assigns appropriate confidence scores
- Handles different claim types (skill, experience, education)
- Validates claim structure
- Handles empty input gracefully

**Step 1: Create tests following established patterns**

**Step 2: Commit**

```bash
git add src/__tests__/unit/lib/ai/synthesize-claims.test.ts
git commit -m "test: add claims synthesis tests"
```

---

## Task 7: Test Evidence Extraction

**Files:**
- Create: `src/__tests__/unit/lib/ai/extract-evidence.test.ts`

Key test cases:
- Extracts evidence statements from documents
- Links evidence to source document
- Handles different evidence types
- Validates evidence structure

**Step 1: Create tests**

**Step 2: Commit**

```bash
git add src/__tests__/unit/lib/ai/extract-evidence.test.ts
git commit -m "test: add evidence extraction tests"
```

---

## Task 8: Test Generation Modules

**Files:**
- Create: `src/__tests__/unit/lib/ai/generate-narrative.test.ts`
- Create: `src/__tests__/unit/lib/ai/generate-resume.test.ts`
- Create: `src/__tests__/unit/lib/ai/generate-talking-points.test.ts`

Key test cases for each:
- Generates appropriate content structure
- Uses provided context (claims, opportunity)
- Handles missing data gracefully
- Output is valid format (text, bullet points, etc.)

**Step 1: Create tests for each module**

**Step 2: Commit each**

```bash
git add src/__tests__/unit/lib/ai/generate-*.test.ts
git commit -m "test: add generation module tests"
```

---

## Task 9: Run Coverage Report and Fill Gaps

**Step 1: Run coverage**

```bash
pnpm test:coverage
```

**Step 2: Review coverage for `/lib/ai/` modules**

Target: 85% for each AI module

**Step 3: Add tests for uncovered branches**

Common gaps:
- Error handling branches
- Edge cases (null, undefined, empty)
- Retry logic
- Timeout handling

**Step 4: Final commit**

```bash
git add -A
git commit -m "test: complete Phase 2 - AI core tests at 85% coverage"
```

---

## Phase 2 Completion Checklist

- [ ] Test fixtures created (resumes, opportunities, OpenAI responses)
- [ ] embeddings.ts tests complete
- [ ] extract-resume.ts tests complete
- [ ] extract-work-history.ts tests complete
- [ ] match-opportunity.ts tests complete
- [ ] synthesize-claims.ts tests complete
- [ ] extract-evidence.ts tests complete
- [ ] generate-narrative.ts tests complete
- [ ] generate-resume.ts tests complete
- [ ] generate-talking-points.ts tests complete
- [ ] All AI modules at 85%+ coverage
- [ ] All tests pass

**Next:** Phase 3 - API Surface Tests
