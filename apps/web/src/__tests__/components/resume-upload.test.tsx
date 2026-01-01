import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResumeUpload } from '@/components/resume-upload'

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

// Mock hooks
vi.mock('@/lib/hooks/use-document-job', () => ({
  useDocumentJob: vi.fn(() => ({
    job: null,
    displayMessages: [],
  })),
}))

// Mock shared types
vi.mock('@idynic/shared/types', () => ({
  RESUME_PHASES: ['extracting', 'analyzing', 'embedding', 'updating'],
  PHASE_LABELS: {
    extracting: 'Extracting text from document',
    analyzing: 'Analyzing content with AI',
    embedding: 'Creating semantic embeddings',
    updating: 'Updating your identity graph',
  },
}))

describe('ResumeUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    const user = userEvent.setup()
    render(<ResumeUpload />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const textFile = new File(['hello'], 'test.txt', { type: 'text/plain' })

    await user.upload(fileInput, textFile)

    await waitFor(() => {
      expect(screen.getByText('Please upload a PDF file')).toBeInTheDocument()
    })
  })

  it('shows error for files over 10MB', async () => {
    const user = userEvent.setup()
    render(<ResumeUpload />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const largeFile = new File([''], 'large.pdf', { type: 'application/pdf' })
    Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 })

    await user.upload(fileInput, largeFile)

    await waitFor(() => {
      expect(screen.getByText('File size must be less than 10MB')).toBeInTheDocument()
    })
  })

  it('uploads file and calls API', async () => {
    const user = userEvent.setup()
    render(<ResumeUpload />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

    await user.upload(fileInput, pdfFile)

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

    const user = userEvent.setup()
    render(<ResumeUpload />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

    await user.upload(fileInput, pdfFile)

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })
  })

  it('calls onUploadComplete callback when job completes', async () => {
    const { useDocumentJob } = await import('@/lib/hooks/use-document-job')
    vi.mocked(useDocumentJob).mockReturnValue({
      job: { status: 'completed', phase: null, progress: null, error: null, warning: null },
      displayMessages: [],
    })

    const onUploadComplete = vi.fn()
    render(<ResumeUpload onUploadComplete={onUploadComplete} />)

    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalled()
    })
  })

  describe('drag and drop', () => {
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
      const { useDocumentJob } = await import('@/lib/hooks/use-document-job')
      vi.mocked(useDocumentJob).mockReturnValue({
        job: { status: 'processing', phase: 'analyzing', progress: null, error: null, warning: null },
        displayMessages: [],
      })

      // Need to trigger upload first to set jobId
      const user = userEvent.setup()
      render(<ResumeUpload />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const pdfFile = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

      await user.upload(fileInput, pdfFile)

      await waitFor(() => {
        expect(screen.getByText('Extracting text from document')).toBeInTheDocument()
        expect(screen.getByText('Analyzing content with AI')).toBeInTheDocument()
      })
    })

    it('shows completed phases with checkmarks', async () => {
      const { useDocumentJob } = await import('@/lib/hooks/use-document-job')
      vi.mocked(useDocumentJob).mockReturnValue({
        job: { status: 'processing', phase: 'embedding', progress: null, error: null, warning: null },
        displayMessages: [],
      })

      const user = userEvent.setup()
      render(<ResumeUpload />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const pdfFile = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

      await user.upload(fileInput, pdfFile)

      await waitFor(() => {
        // Completed phases should show checkmarks (✓)
        expect(screen.getByText('✓')).toBeInTheDocument()
      })
    })

    it('shows display messages during processing', async () => {
      const { useDocumentJob } = await import('@/lib/hooks/use-document-job')
      vi.mocked(useDocumentJob).mockReturnValue({
        job: { status: 'processing', phase: 'analyzing', progress: null, error: null, warning: null },
        displayMessages: [
          { id: '1', text: 'Found React experience' },
          { id: '2', text: 'Detected TypeScript skills' },
        ],
      })

      const user = userEvent.setup()
      render(<ResumeUpload />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const pdfFile = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

      await user.upload(fileInput, pdfFile)

      await waitFor(() => {
        expect(screen.getByText('Found React experience')).toBeInTheDocument()
        expect(screen.getByText('Detected TypeScript skills')).toBeInTheDocument()
      })
    })

    it('shows processing complete message', async () => {
      const { useDocumentJob } = await import('@/lib/hooks/use-document-job')
      vi.mocked(useDocumentJob).mockReturnValue({
        job: { status: 'completed', phase: null, progress: null, error: null, warning: null },
        displayMessages: [],
      })

      const user = userEvent.setup()
      render(<ResumeUpload />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const pdfFile = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

      await user.upload(fileInput, pdfFile)

      await waitFor(() => {
        expect(screen.getByText('Processing complete!')).toBeInTheDocument()
      })
    })

    it('shows warning message if present', async () => {
      const { useDocumentJob } = await import('@/lib/hooks/use-document-job')
      vi.mocked(useDocumentJob).mockReturnValue({
        job: {
          status: 'completed',
          phase: null,
          progress: null,
          error: null,
          warning: 'Some content could not be extracted',
        },
        displayMessages: [],
      })

      const user = userEvent.setup()
      render(<ResumeUpload />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const pdfFile = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

      await user.upload(fileInput, pdfFile)

      await waitFor(() => {
        expect(screen.getByText('Some content could not be extracted')).toBeInTheDocument()
      })
    })

    it('shows batch progress when available', async () => {
      const { useDocumentJob } = await import('@/lib/hooks/use-document-job')
      vi.mocked(useDocumentJob).mockReturnValue({
        job: { status: 'processing', phase: 'extracting', progress: '2/5', error: null, warning: null },
        displayMessages: [],
      })

      const user = userEvent.setup()
      render(<ResumeUpload />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const pdfFile = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

      await user.upload(fileInput, pdfFile)

      await waitFor(() => {
        expect(screen.getByText(/batch 2\/5/i)).toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('shows error from job failure', async () => {
      const { useDocumentJob } = await import('@/lib/hooks/use-document-job')
      vi.mocked(useDocumentJob).mockReturnValue({
        job: { status: 'failed', phase: null, progress: null, error: 'Document parsing failed', warning: null },
        displayMessages: [],
      })

      render(<ResumeUpload />)

      await waitFor(() => {
        expect(screen.getByText('Document parsing failed')).toBeInTheDocument()
      })
    })

    it('shows generic error when job fails without message', async () => {
      const { useDocumentJob } = await import('@/lib/hooks/use-document-job')
      vi.mocked(useDocumentJob).mockReturnValue({
        job: { status: 'failed', phase: null, progress: null, error: null, warning: null },
        displayMessages: [],
      })

      render(<ResumeUpload />)

      await waitFor(() => {
        expect(screen.getByText('Processing failed')).toBeInTheDocument()
      })
    })
  })
})
