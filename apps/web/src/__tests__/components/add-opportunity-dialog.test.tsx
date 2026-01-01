import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddOpportunityDialog } from '@/components/add-opportunity-dialog'

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

// Mock hooks
vi.mock('@/lib/hooks/use-document-job', () => ({
  useDocumentJob: vi.fn(() => ({
    job: null,
    displayMessages: [],
  })),
}))

describe('AddOpportunityDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobId: 'job-123' }),
    })
  })

  it('renders trigger button', () => {
    render(<AddOpportunityDialog />)

    expect(screen.getByRole('button', { name: /add opportunity/i })).toBeInTheDocument()
  })

  it('opens dialog when trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityDialog />)

    await user.click(screen.getByRole('button', { name: /add opportunity/i }))

    expect(screen.getByText('Add Opportunity')).toBeInTheDocument()
    expect(screen.getByText(/add a job posting to track/i)).toBeInTheDocument()
  })

  it('shows form fields', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityDialog />)

    await user.click(screen.getByRole('button', { name: /add opportunity/i }))

    expect(screen.getByLabelText(/job url/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/job description/i)).toBeInTheDocument()
  })

  it('detects LinkedIn job URLs', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityDialog />)

    await user.click(screen.getByRole('button', { name: /add opportunity/i }))

    const urlInput = screen.getByLabelText(/job url/i)
    await user.type(urlInput, 'https://linkedin.com/jobs/view/12345')

    expect(screen.getByText(/linkedin job detected/i)).toBeInTheDocument()
  })

  it('detects generic job URLs', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityDialog />)

    await user.click(screen.getByRole('button', { name: /add opportunity/i }))

    const urlInput = screen.getByLabelText(/job url/i)
    await user.type(urlInput, 'https://careers.google.com/jobs/123')

    expect(screen.getByText(/job url detected/i)).toBeInTheDocument()
  })

  it('requires description when no job URL is detected', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityDialog />)

    await user.click(screen.getByRole('button', { name: /add opportunity/i }))

    const urlInput = screen.getByLabelText(/job url/i)
    await user.type(urlInput, 'https://example.com')

    const descriptionLabel = screen.getByText('Job Description *')
    expect(descriptionLabel).toBeInTheDocument()
  })

  it('makes description optional when job URL is detected', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityDialog />)

    await user.click(screen.getByRole('button', { name: /add opportunity/i }))

    const urlInput = screen.getByLabelText(/job url/i)
    await user.type(urlInput, 'https://linkedin.com/jobs/view/12345')

    // The description label should not have asterisk
    const descriptionLabel = screen.getByText('Job Description')
    expect(descriptionLabel).toBeInTheDocument()
  })

  it('submits form and calls API', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityDialog />)

    await user.click(screen.getByRole('button', { name: /add opportunity/i }))

    const urlInput = screen.getByLabelText(/job url/i)
    const descriptionInput = screen.getByLabelText(/job description/i)

    await user.type(urlInput, 'https://example.com/job/123')
    await user.type(descriptionInput, 'Software Engineer position')

    await user.click(screen.getByRole('button', { name: /^add opportunity$/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/process-opportunity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      })
    })
  })

  it('shows error on submission failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Failed to add opportunity' }),
    })

    const user = userEvent.setup()
    render(<AddOpportunityDialog />)

    await user.click(screen.getByRole('button', { name: /add opportunity/i }))

    const urlInput = screen.getByLabelText(/job url/i)
    const descriptionInput = screen.getByLabelText(/job description/i)

    await user.type(urlInput, 'https://example.com/job/123')
    await user.type(descriptionInput, 'Software Engineer position')

    await user.click(screen.getByRole('button', { name: /^add opportunity$/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to add opportunity')).toBeInTheDocument()
    })
  })

  it('closes dialog when cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityDialog />)

    await user.click(screen.getByRole('button', { name: /add opportunity/i }))
    expect(screen.getByText('Add Opportunity')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByLabelText(/job url/i)).not.toBeInTheDocument()
    })
  })

  it('shows loading state during submission', async () => {
    mockFetch.mockImplementationOnce(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-123' }),
      }), 100))
    )

    const user = userEvent.setup()
    render(<AddOpportunityDialog />)

    await user.click(screen.getByRole('button', { name: /add opportunity/i }))

    const urlInput = screen.getByLabelText(/job url/i)
    const descriptionInput = screen.getByLabelText(/job description/i)

    await user.type(urlInput, 'https://example.com/job/123')
    await user.type(descriptionInput, 'Software Engineer position')

    await user.click(screen.getByRole('button', { name: /^add opportunity$/i }))

    expect(screen.getByText(/starting/i)).toBeInTheDocument()
  })
})
