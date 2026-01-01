import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditableText } from '@/components/editable-text'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('EditableText', () => {
  const defaultProps = {
    value: 'Test content',
    fieldPath: 'summary',
    contentType: 'summary' as const,
    isEdited: false,
    opportunityId: 'opp-123',
    onUpdate: vi.fn(),
    onRevert: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ value: 'Updated content' }),
    })
  })

  it('renders text content in view mode', () => {
    render(<EditableText {...defaultProps} />)

    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('shows pencil icon on hover', () => {
    render(<EditableText {...defaultProps} />)

    // The button is hidden by default via CSS
    const editButton = screen.getByRole('button')
    expect(editButton).toBeInTheDocument()
  })

  it('shows edited badge when isEdited is true', () => {
    render(<EditableText {...defaultProps} isEdited={true} />)

    expect(screen.getByText('edited')).toBeInTheDocument()
  })

  it('enters edit mode when text is clicked', async () => {
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} />)

    await user.click(screen.getByText('Test content'))

    // Should show input/textarea in edit mode
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('enters edit mode when pencil button is clicked', async () => {
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} />)

    await user.click(screen.getByRole('button'))

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows input for single line content', async () => {
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} multiline={false} />)

    await user.click(screen.getByText('Test content'))

    const input = screen.getByRole('textbox')
    expect(input.tagName.toLowerCase()).toBe('input')
  })

  it('shows textarea for multiline content', async () => {
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} multiline={true} />)

    await user.click(screen.getByText('Test content'))

    const textarea = screen.getByRole('textbox')
    expect(textarea.tagName.toLowerCase()).toBe('textarea')
  })

  it('shows quick actions in edit mode', async () => {
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} contentType="summary" />)

    await user.click(screen.getByText('Test content'))

    expect(screen.getByRole('button', { name: /shorten/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /more confident/i })).toBeInTheDocument()
  })

  it('shows different quick actions for bullets', async () => {
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} contentType="bullet" />)

    await user.click(screen.getByText('Test content'))

    expect(screen.getByRole('button', { name: /shorten/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add metrics/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stronger verbs/i })).toBeInTheDocument()
  })

  it('shows emphasize dropdown for bullets with skills', async () => {
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} contentType="bullet" skills={['React', 'TypeScript', 'Node.js']} />)

    await user.click(screen.getByText('Test content'))

    expect(screen.getByRole('button', { name: /emphasize/i })).toBeInTheDocument()
  })

  it('saves changes when Done is clicked', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} onUpdate={onUpdate} />)

    await user.click(screen.getByText('Test content'))

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Updated content')

    await user.click(screen.getByRole('button', { name: /done/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/tailored-profile/opp-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'summary', value: 'Updated content' }),
      })
    })

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith('Updated content', 'summary')
    })
  })

  it('cancels edit when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} />)

    await user.click(screen.getByText('Test content'))

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Updated content')

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    // Should revert to original value
    await waitFor(() => {
      expect(screen.getByText('Test content')).toBeInTheDocument()
    })
  })

  it('cancels edit when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} />)

    await user.click(screen.getByText('Test content'))

    const input = screen.getByRole('textbox')
    await user.type(input, ' extra')
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.getByText('Test content')).toBeInTheDocument()
    })
  })

  it('saves when Ctrl+Enter is pressed', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} onUpdate={onUpdate} />)

    await user.click(screen.getByText('Test content'))

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Updated')

    // Simulate Ctrl+Enter
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  it('triggers AI action when quick action is clicked', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} onUpdate={onUpdate} contentType="summary" />)

    await user.click(screen.getByText('Test content'))
    await user.click(screen.getByRole('button', { name: /shorten/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/tailored-profile/opp-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('instruction'),
      })
    })
  })

  it('shows custom instruction input', async () => {
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} />)

    await user.click(screen.getByText('Test content'))

    expect(screen.getByPlaceholderText(/custom instruction/i)).toBeInTheDocument()
  })

  it('sends custom instruction', async () => {
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} />)

    await user.click(screen.getByText('Test content'))

    const customInput = screen.getByPlaceholderText(/custom instruction/i)
    await user.type(customInput, 'Make it sound more professional')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/tailored-profile/opp-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Make it sound more professional'),
      })
    })
  })

  it('shows revert button when isEdited is true', async () => {
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} isEdited={true} />)

    await user.click(screen.getByText('Test content'))

    expect(screen.getByRole('button', { name: /revert/i })).toBeInTheDocument()
  })

  it('calls onRevert when revert is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ value: 'Original content' }),
    })

    const onRevert = vi.fn()
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} isEdited={true} onRevert={onRevert} />)

    await user.click(screen.getByText('Test content'))
    await user.click(screen.getByRole('button', { name: /revert/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/tailored-profile/opp-123', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'summary' }),
      })
    })

    await waitFor(() => {
      expect(onRevert).toHaveBeenCalledWith('summary')
    })
  })

  it('shows error message on save failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    })

    const user = userEvent.setup()
    render(<EditableText {...defaultProps} />)

    await user.click(screen.getByText('Test content'))

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Updated')

    await user.click(screen.getByRole('button', { name: /done/i }))

    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
    })
  })

  it('renders bold markdown in view mode', () => {
    render(<EditableText {...defaultProps} value="This is **bold** text" />)

    const strong = screen.getByText('bold')
    expect(strong.tagName.toLowerCase()).toBe('strong')
  })

  it('does not call save if value unchanged', async () => {
    const user = userEvent.setup()
    render(<EditableText {...defaultProps} />)

    await user.click(screen.getByText('Test content'))
    await user.click(screen.getByRole('button', { name: /done/i }))

    // Should not call API if value is unchanged
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
