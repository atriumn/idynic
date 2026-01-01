import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SmartLinksList } from '@/components/smart-links-list'

const mockLinks = [
  { url: 'https://linkedin.com/jobs/123', label: 'Main posting', type: 'linkedin' as const },
  { url: 'https://careers.acme.com/jobs/456', label: null, type: 'careers' as const },
  { url: 'https://glassdoor.com/job/123', label: 'Glassdoor listing', type: 'glassdoor' as const },
  { url: 'https://indeed.com/job/456', label: 'Indeed post', type: 'indeed' as const },
  { url: 'https://greenhouse.io/jobs/789', label: null, type: 'greenhouse' as const },
  { url: 'https://lever.co/company/job', label: 'Lever', type: 'lever' as const },
  { url: 'https://workday.com/jobs/123', label: 'Workday', type: 'workday' as const },
  { url: 'https://example.com/page', label: 'Generic link', type: 'other' as const },
]

describe('SmartLinksList', () => {
  it('renders list of links', () => {
    render(<SmartLinksList links={mockLinks.slice(0, 2)} onRemove={() => {}} />)

    expect(screen.getByText('Main posting')).toBeInTheDocument()
    expect(screen.getByText(/linkedin.com/)).toBeInTheDocument()
  })

  it('shows URL as label when label is null', () => {
    render(<SmartLinksList links={mockLinks.slice(0, 2)} onRemove={() => {}} />)

    const link = screen.getByRole('link', { name: /careers.acme.com/ })
    expect(link).toBeInTheDocument()
  })

  it('calls onRemove when delete button clicked', () => {
    const onRemove = vi.fn()
    render(<SmartLinksList links={mockLinks.slice(0, 2)} onRemove={onRemove} />)

    const deleteButtons = screen.getAllByRole('button')
    fireEvent.click(deleteButtons[0])

    expect(onRemove).toHaveBeenCalledWith(0)
  })

  it('renders empty state when no links', () => {
    render(<SmartLinksList links={[]} onRemove={() => {}} />)

    expect(screen.getByText(/no links/i)).toBeInTheDocument()
  })

  it('links open in new tab', () => {
    render(<SmartLinksList links={mockLinks.slice(0, 2)} onRemove={() => {}} />)

    const link = screen.getByRole('link', { name: /main posting/i })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  describe('link type icons', () => {
    it('shows LinkedIn icon for linkedin links', () => {
      render(<SmartLinksList links={[mockLinks[0]]} onRemove={() => {}} />)

      // LinkedIn icon has specific color class
      const svg = document.querySelector('svg.text-\\[\\#0A66C2\\]')
      expect(svg).toBeInTheDocument()
    })

    it('shows briefcase icon for job board links', () => {
      const jobBoardLinks = mockLinks.filter(l =>
        ['glassdoor', 'indeed', 'greenhouse', 'lever', 'workday', 'careers'].includes(l.type)
      )
      render(<SmartLinksList links={[jobBoardLinks[0]]} onRemove={() => {}} />)

      const svg = document.querySelector('svg.text-muted-foreground')
      expect(svg).toBeInTheDocument()
    })

    it('shows generic link icon for other links', () => {
      const otherLink = mockLinks.find(l => l.type === 'other')!
      render(<SmartLinksList links={[otherLink]} onRemove={() => {}} />)

      const svg = document.querySelector('svg.text-muted-foreground')
      expect(svg).toBeInTheDocument()
    })
  })

  it('truncates long URLs', () => {
    const longUrlLink = {
      url: 'https://very-long-domain-name.com/this/is/a/very/long/path/that/should/be/truncated',
      label: null,
      type: 'other' as const,
    }
    render(<SmartLinksList links={[longUrlLink]} onRemove={() => {}} />)

    // Should truncate with ...
    const link = screen.getByRole('link')
    expect(link.textContent).toContain('...')
  })

  it('removes correct link when multiple exist', () => {
    const onRemove = vi.fn()
    render(<SmartLinksList links={mockLinks.slice(0, 3)} onRemove={onRemove} />)

    const deleteButtons = screen.getAllByRole('button')
    fireEvent.click(deleteButtons[1]) // Click second delete button

    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it('renders all links in order', () => {
    render(<SmartLinksList links={mockLinks.slice(0, 4)} onRemove={() => {}} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(4)
    expect(links[0]).toHaveTextContent('Main posting')
    expect(links[3]).toHaveTextContent('Indeed post')
  })

  it('handles URLs without paths gracefully', () => {
    const simpleLink = {
      url: 'https://example.com',
      label: null,
      type: 'other' as const,
    }
    render(<SmartLinksList links={[simpleLink]} onRemove={() => {}} />)

    const link = screen.getByRole('link')
    expect(link.textContent).toContain('example.com')
  })

  it('handles malformed URLs', () => {
    const badLink = {
      url: 'not-a-valid-url',
      label: null,
      type: 'other' as const,
    }
    render(<SmartLinksList links={[badLink]} onRemove={() => {}} />)

    const link = screen.getByRole('link')
    expect(link).toBeInTheDocument()
  })

  it('shows full URL on hover', () => {
    render(<SmartLinksList links={mockLinks.slice(0, 1)} onRemove={() => {}} />)

    // The hover URL display element should exist (hidden by CSS)
    const li = screen.getByRole('listitem')
    expect(li).toBeInTheDocument()
    // The hidden URL text exists in the DOM
    expect(li.textContent).toContain('linkedin.com')
  })
})
