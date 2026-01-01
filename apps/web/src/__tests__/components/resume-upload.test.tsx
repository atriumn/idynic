import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ResumeUpload } from '@/components/resume-upload'
import type { DocumentJob } from '@idynic/shared/types'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}))

// Mock hooks - default mock that returns no job
type DisplayMessage = { id: number; text: string }
const mockUseDocumentJob = vi.fn<[], {
  job: DocumentJob | null;
  isLoading: boolean;
  error: Error | null;
  displayMessages: DisplayMessage[];
}>(() => ({
  job: null,
  isLoading: false,
  error: null,
  displayMessages: [],
}))

vi.mock('@/lib/hooks/use-document-job', () => ({
  useDocumentJob: () => mockUseDocumentJob(),
}))

// Mock shared types
vi.mock('@idynic/shared/types', () => ({
  RESUME_PHASES: ['extracting', 'synthesis', 'embeddings', 'evaluation'],
  PHASE_LABELS: {
    extracting: 'Extracting text from document',
    synthesis: 'Analyzing content with AI',
    embeddings: 'Creating semantic embeddings',
    evaluation: 'Updating your identity graph',
  },
}))

// Helper to create a partial mock job
function createMockJob(overrides: Partial<DocumentJob>): DocumentJob {
  return {
    id: 'job-123',
    user_id: 'user-123',
    document_id: null,
    opportunity_id: null,
    job_type: 'resume',
    filename: 'resume.pdf',
    content_hash: null,
    status: 'pending',
    phase: null,
    progress: null,
    highlights: [],
    error: null,
    warning: null,
    summary: null,
    created_at: '2024-01-01T00:00:00Z',
    started_at: null,
    completed_at: null,
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('ResumeUpload', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Reset the mock to return no job (initial state)
    mockUseDocumentJob.mockReturnValue({
      job: null,
      isLoading: false,
      error: null,
      displayMessages: [],
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobId: 'job-123' }),
    })
  })

  it('renders upload card with instructions', () => {
    render(<ResumeUpload />)

    expect(screen.getByText(/drag and drop your resume here/i)).toBeInTheDocument()
    expect(screen.getByText(/pdf files only, max 10mb/i)).toBeInTheDocument()
    expect(screen.getByText(/browse files/i)).toBeInTheDocument()
  })

  it('has a file input that accepts PDFs', () => {
    render(<ResumeUpload />)

    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('accept', '.pdf,application/pdf')
  })

  it('shows error for non-PDF files', async () => {
    render(<ResumeUpload />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const textFile = new File(['hello'], 'test.txt', { type: 'text/plain' })

    // Use fireEvent.change since userEvent.upload may not work with hidden inputs
    fireEvent.change(fileInput, { target: { files: [textFile] } })

    await waitFor(() => {
      expect(screen.getByText(/please upload a pdf file/i)).toBeInTheDocument()
    })
  })

  it('shows error for files over 10MB', async () => {
    render(<ResumeUpload />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const largeFile = new File([''], 'large.pdf', { type: 'application/pdf' })
    Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 })

    // Use fireEvent.change since userEvent.upload may not work with hidden inputs
    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      expect(screen.getByText('File size must be less than 10MB')).toBeInTheDocument()
    })
  })

  it('uploads file and calls API', async () => {
    render(<ResumeUpload />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

    // Use fireEvent.change since userEvent.upload may not work with hidden inputs
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/process-resume', {
        method: 'POST',
        body: expect.any(FormData),
      })
    })
  })

  it('shows error on upload failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'Upload failed' }),
    })

    render(<ResumeUpload />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

    // Use fireEvent.change since userEvent.upload may not work with hidden inputs
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })
  })

  it('calls onUploadComplete callback when job completes', async () => {
    mockUseDocumentJob.mockReturnValue({
      job: createMockJob({ status: 'completed' }),
      isLoading: false,
      error: null,
      displayMessages: [],
    })

    const onUploadComplete = vi.fn()
    render(<ResumeUpload onUploadComplete={onUploadComplete} />)

    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalled()
    })
  })

  describe('drag and drop', () => {
    beforeEach(() => {
      // Ensure we're in the initial upload state (no job)
      mockUseDocumentJob.mockReturnValue({
        job: null,
        isLoading: false,
        error: null,
        displayMessages: [],
      })
    })

    it('highlights on drag over', () => {
      render(<ResumeUpload />)

      const card = screen.getByText(/drag and drop/i).closest('.border-dashed')!

      fireEvent.dragOver(card)
      expect(card).toHaveClass('border-primary')
    })

    it('removes highlight on drag leave', () => {
      render(<ResumeUpload />)

      const card = screen.getByText(/drag and drop/i).closest('.border-dashed')!

      fireEvent.dragOver(card)
      expect(card).toHaveClass('border-primary')

      fireEvent.dragLeave(card)
      expect(card).not.toHaveClass('border-primary')
    })

    it('handles file drop', async () => {
      render(<ResumeUpload />)

      const card = screen.getByText(/drag and drop/i).closest('.border-dashed')!
      const pdfFile = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

      const dataTransfer = {
        files: [pdfFile],
      }

      fireEvent.drop(card, { dataTransfer })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/process-resume', {
          method: 'POST',
          body: expect.any(FormData),
        })
      })
    })
  })

  describe('processing state', () => {
    it('shows processing phases when job is processing', async () => {
      mockUseDocumentJob.mockReturnValue({
        job: createMockJob({ status: 'processing', phase: 'synthesis' }),
        isLoading: false,
        error: null,
        displayMessages: [],
      })

      render(<ResumeUpload />)

      await waitFor(() => {
        expect(screen.getByText('Extracting text from document')).toBeInTheDocument()
        expect(screen.getByText('Analyzing content with AI')).toBeInTheDocument()
      })
    })

    it('shows completed phases with checkmarks', async () => {
      mockUseDocumentJob.mockReturnValue({
        job: createMockJob({ status: 'processing', phase: 'embeddings' }),
        isLoading: false,
        error: null,
        displayMessages: [],
      })

      render(<ResumeUpload />)

      await waitFor(() => {
        // Completed phases should show checkmarks (✓)
        expect(screen.getByText('✓')).toBeInTheDocument()
      })
    })

    it('shows display messages during processing', async () => {
      mockUseDocumentJob.mockReturnValue({
        job: createMockJob({ status: 'processing', phase: 'synthesis' }),
        isLoading: false,
        error: null,
        displayMessages: [
          { id: 1, text: 'Found React experience' },
          { id: 2, text: 'Detected TypeScript skills' },
        ],
      })

      render(<ResumeUpload />)

      await waitFor(() => {
        expect(screen.getByText('Found React experience')).toBeInTheDocument()
        expect(screen.getByText('Detected TypeScript skills')).toBeInTheDocument()
      })
    })

    it('shows processing complete message', async () => {
      mockUseDocumentJob.mockReturnValue({
        job: createMockJob({ status: 'completed' }),
        isLoading: false,
        error: null,
        displayMessages: [],
      })

      render(<ResumeUpload />)

      await waitFor(() => {
        expect(screen.getByText('Processing complete!')).toBeInTheDocument()
      })
    })

    it('shows warning message if present', async () => {
      mockUseDocumentJob.mockReturnValue({
        job: createMockJob({
          status: 'completed',
          warning: 'Some content could not be extracted',
        }),
        isLoading: false,
        error: null,
        displayMessages: [],
      })

      render(<ResumeUpload />)

      await waitFor(() => {
        expect(screen.getByText('Some content could not be extracted')).toBeInTheDocument()
      })
    })

    it('shows batch progress when available', async () => {
      mockUseDocumentJob.mockReturnValue({
        job: createMockJob({ status: 'processing', phase: 'extracting', progress: '2/5' }),
        isLoading: false,
        error: null,
        displayMessages: [],
      })

      render(<ResumeUpload />)

      await waitFor(() => {
        expect(screen.getByText(/batch 2\/5/i)).toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('shows error from job failure', async () => {
      mockUseDocumentJob.mockReturnValue({
        job: createMockJob({ status: 'failed', error: 'Document parsing failed' }),
        isLoading: false,
        error: null,
        displayMessages: [],
      })

      render(<ResumeUpload />)

      await waitFor(() => {
        expect(screen.getByText('Document parsing failed')).toBeInTheDocument()
      })
    })

    it('shows generic error when job fails without message', async () => {
      mockUseDocumentJob.mockReturnValue({
        job: createMockJob({ status: 'failed' }),
        isLoading: false,
        error: null,
        displayMessages: [],
      })

      render(<ResumeUpload />)

      await waitFor(() => {
        expect(screen.getByText('Processing failed')).toBeInTheDocument()
      })
    })
  })
})
