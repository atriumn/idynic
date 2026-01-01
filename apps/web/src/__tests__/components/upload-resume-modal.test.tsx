import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadResumeModal } from '@/components/upload-resume-modal'

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

vi.mock('@/lib/hooks/use-identity-graph', () => ({
  useInvalidateGraph: () => vi.fn(),
}))

describe('UploadResumeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobId: 'job-123' }),
    })
  })

  it('renders trigger button', () => {
    render(<UploadResumeModal />)

    expect(screen.getByRole('button', { name: /upload resume/i })).toBeInTheDocument()
  })

  it('opens dialog when trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<UploadResumeModal />)

    await user.click(screen.getByRole('button', { name: /upload resume/i }))

    expect(screen.getByText('Upload Resume')).toBeInTheDocument()
    expect(screen.getByText(/upload your resume to extract skills/i)).toBeInTheDocument()
  })

  it('shows drop zone with instructions', async () => {
    const user = userEvent.setup()
    render(<UploadResumeModal />)

    await user.click(screen.getByRole('button', { name: /upload resume/i }))

    expect(screen.getByText(/drag and drop your resume here/i)).toBeInTheDocument()
    expect(screen.getByText(/pdf files only, max 10mb/i)).toBeInTheDocument()
    expect(screen.getByText(/browse files/i)).toBeInTheDocument()
  })

  it('has a file input that accepts PDFs', async () => {
    const user = userEvent.setup()
    render(<UploadResumeModal />)

    await user.click(screen.getByRole('button', { name: /upload resume/i }))

    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('accept', '.pdf,application/pdf')
  })

  it('shows error for non-PDF files', async () => {
    const user = userEvent.setup()
    render(<UploadResumeModal />)

    await user.click(screen.getByRole('button', { name: /upload resume/i }))

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const textFile = new File(['hello'], 'test.txt', { type: 'text/plain' })

    await user.upload(fileInput, textFile)

    await waitFor(() => {
      expect(screen.getByText('Please upload a PDF file')).toBeInTheDocument()
    })
  })

  it('shows error for files over 10MB', async () => {
    const user = userEvent.setup()
    render(<UploadResumeModal />)

    await user.click(screen.getByRole('button', { name: /upload resume/i }))

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    // Create a mock large file (11MB)
    const largeContent = new Array(11 * 1024 * 1024).fill('a').join('')
    const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' })

    Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 })

    await user.upload(fileInput, largeFile)

    await waitFor(() => {
      expect(screen.getByText('File size must be less than 10MB')).toBeInTheDocument()
    })
  })

  it('uploads file and gets jobId', async () => {
    const user = userEvent.setup()
    render(<UploadResumeModal />)

    await user.click(screen.getByRole('button', { name: /upload resume/i }))

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
      json: () => Promise.resolve({ error: 'Upload failed' }),
    })

    const user = userEvent.setup()
    render(<UploadResumeModal />)

    await user.click(screen.getByRole('button', { name: /upload resume/i }))

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

    await user.upload(fileInput, pdfFile)

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })
  })

  it('closes dialog when cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<UploadResumeModal />)

    await user.click(screen.getByRole('button', { name: /upload resume/i }))
    expect(screen.getByText('Upload Resume')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByText(/drag and drop your resume here/i)).not.toBeInTheDocument()
    })
  })

  it('handles drag over state', async () => {
    const user = userEvent.setup()
    render(<UploadResumeModal />)

    await user.click(screen.getByRole('button', { name: /upload resume/i }))

    const dropZone = screen.getByText(/drag and drop/i).closest('div')!

    fireEvent.dragOver(dropZone)
    expect(dropZone).toHaveClass('border-primary')

    fireEvent.dragLeave(dropZone)
    expect(dropZone).not.toHaveClass('border-primary')
  })
})
