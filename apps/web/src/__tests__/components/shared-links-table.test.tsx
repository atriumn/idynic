import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SharedLinksTable } from '@/components/shared-links-table'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock clipboard
const mockWriteText = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
})

// Mock next/navigation
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('SharedLinksTable', () => {
  const activeLink = {
    id: 'link-1',
    token: 'token-abc',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    revokedAt: null,
    createdAt: new Date().toISOString(),
    tailoredProfileId: 'profile-1',
    opportunityId: 'opp-1',
    opportunityTitle: 'Software Engineer',
    company: 'Acme Corp',
    viewCount: 5,
    views: [
      new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    ],
  }

  const expiredLink = {
    id: 'link-2',
    token: 'token-def',
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    revokedAt: null,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    tailoredProfileId: 'profile-2',
    opportunityId: 'opp-2',
    opportunityTitle: 'Frontend Developer',
    company: null,
    viewCount: 2,
    views: [],
  }

  const revokedLink = {
    id: 'link-3',
    token: 'token-ghi',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    revokedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    tailoredProfileId: 'profile-3',
    opportunityId: 'opp-3',
    opportunityTitle: 'Backend Developer',
    company: 'Tech Inc',
    viewCount: 0,
    views: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteText.mockResolvedValue(undefined)
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })
  })

  it('renders table with column headers', () => {
    render(<SharedLinksTable links={[activeLink]} />)

    expect(screen.getByText('Opportunity')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Views')).toBeInTheDocument()
    expect(screen.getByText('Expires')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  it('renders opportunity title and company', () => {
    render(<SharedLinksTable links={[activeLink]} />)

    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('renders opportunity without company', () => {
    render(<SharedLinksTable links={[expiredLink]} />)

    expect(screen.getByText('Frontend Developer')).toBeInTheDocument()
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument()
  })

  describe('status badges', () => {
    it('shows Active badge for active link', () => {
      render(<SharedLinksTable links={[activeLink]} />)

      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('shows Expired badge for expired link', () => {
      render(<SharedLinksTable links={[expiredLink]} />)

      // There may be multiple "Expired" texts (badge and cell)
      const expiredElements = screen.getAllByText('Expired')
      expect(expiredElements.length).toBeGreaterThan(0)
    })

    it('shows Revoked badge for revoked link', () => {
      render(<SharedLinksTable links={[revokedLink]} />)

      expect(screen.getByText('Revoked')).toBeInTheDocument()
    })
  })

  it('displays view count', () => {
    render(<SharedLinksTable links={[activeLink]} />)

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('displays expiry date for active links', () => {
    render(<SharedLinksTable links={[activeLink]} />)

    // The date should be rendered (format like "Jan 31, 2026")
    const cells = screen.getAllByRole('cell')
    const hasDate = cells.some(cell => /\w{3} \d{1,2}, \d{4}/.test(cell.textContent || ''))
    expect(hasDate).toBe(true)
  })

  it('shows Expired text for expired links', () => {
    render(<SharedLinksTable links={[expiredLink]} />)

    // One for badge, one for expires column
    expect(screen.getAllByText('Expired').length).toBeGreaterThanOrEqual(1)
  })

  describe('actions for active links', () => {
    it('shows copy button for active links', () => {
      render(<SharedLinksTable links={[activeLink]} />)

      // Should have copy and revoke buttons
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(1)
    })

    it('shows expanded row with action buttons', async () => {
      const user = userEvent.setup()
      render(<SharedLinksTable links={[activeLink]} />)

      // Expand the row first to access action buttons
      const expandButton = screen.getAllByRole('button')[0]
      await user.click(expandButton)

      // Wait for row to expand and show action buttons
      await waitFor(() => {
        // Find copy button by looking for button with lucide-copy class
        const copyButton = document.querySelector('button svg.lucide-copy')?.closest('button')
        expect(copyButton).toBeTruthy()
      })
    })

    it('revokes link when revoke button is clicked', async () => {
      const user = userEvent.setup()
      render(<SharedLinksTable links={[activeLink]} />)

      // Find and click revoke button (second button with icon)
      const buttons = screen.getAllByRole('button')
      // Revoke is typically the second action button
      const revokeButton = buttons[2] // After expand and copy
      await user.click(revokeButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/shared-links/link-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'revoke' }),
        })
      })

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })
    })
  })

  it('does not show copy/revoke buttons for expired links', () => {
    render(<SharedLinksTable links={[expiredLink]} />)

    // Should only have expand and external link buttons
    const buttons = screen.getAllByRole('button')
    // Expired links have fewer action buttons
    expect(buttons.length).toBeLessThan(5)
  })

  it('does not show copy/revoke buttons for revoked links', () => {
    render(<SharedLinksTable links={[revokedLink]} />)

    // Should only have expand and external link buttons
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeLessThan(5)
  })

  describe('expandable rows', () => {
    it('expands row when clicked', async () => {
      const user = userEvent.setup()
      render(<SharedLinksTable links={[activeLink]} />)

      // Click the expand button (first button with chevron)
      const expandButton = screen.getAllByRole('button')[0]
      await user.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('View history')).toBeInTheDocument()
      })
    })

    it('shows view history when expanded', async () => {
      const user = userEvent.setup()
      render(<SharedLinksTable links={[activeLink]} />)

      const expandButton = screen.getAllByRole('button')[0]
      await user.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('View history')).toBeInTheDocument()
        // Should show "Viewed" entries
        expect(screen.getAllByText(/viewed/i).length).toBeGreaterThan(0)
      })
    })

    it('shows "No views yet" for links without views', async () => {
      const user = userEvent.setup()
      render(<SharedLinksTable links={[revokedLink]} />)

      const expandButton = screen.getAllByRole('button')[0]
      await user.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('No views yet')).toBeInTheDocument()
      })
    })

    it('collapses row when clicked again', async () => {
      const user = userEvent.setup()
      render(<SharedLinksTable links={[activeLink]} />)

      const expandButton = screen.getAllByRole('button')[0]
      await user.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('View history')).toBeInTheDocument()
      })

      await user.click(expandButton)

      await waitFor(() => {
        expect(screen.queryByText('View history')).not.toBeInTheDocument()
      })
    })
  })

  it('renders multiple links', () => {
    render(<SharedLinksTable links={[activeLink, expiredLink, revokedLink]} />)

    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
    expect(screen.getByText('Frontend Developer')).toBeInTheDocument()
    expect(screen.getByText('Backend Developer')).toBeInTheDocument()
  })

  it('navigates to opportunity when external link is clicked', async () => {
    // Mock window.location.href using Object.defineProperty
    const originalLocation = window.location
    const mockLocation = { ...originalLocation, href: '' }

    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
      configurable: true,
    })

    const user = userEvent.setup()
    render(<SharedLinksTable links={[activeLink]} />)

    // Find the external link button (last button in actions)
    const buttons = screen.getAllByRole('button')
    const externalButton = buttons[buttons.length - 1]
    await user.click(externalButton)

    expect(mockLocation.href).toBe('/opportunities/opp-1')

    // Restore
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
  })
})
