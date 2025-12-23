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

    const link = screen.getByRole('link', { name: /careers.acme.com/ })
    expect(link).toBeInTheDocument()
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
