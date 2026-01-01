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
    // The selected button (index 2 for value 3) should have primary styling
    expect(buttons[2]).toHaveClass('bg-primary')
  })

  it('calls onChange when rating is clicked', () => {
    const onChange = vi.fn()
    render(<RatingInput label="Tech Stack" value={null} onChange={onChange} />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[3]) // 4th button = rating 4
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('clears rating when same value is clicked', () => {
    const onChange = vi.fn()
    render(<RatingInput label="Tech Stack" value={3} onChange={onChange} />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[2]) // 3rd button = rating 3
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('shows unrated state when value is null', () => {
    render(<RatingInput label="Tech Stack" value={null} onChange={() => {}} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).not.toHaveAttribute('data-selected', 'true')
    })
  })

  it('displays current rating value when selected', () => {
    render(<RatingInput label="Tech Stack" value={4} onChange={() => {}} />)

    expect(screen.getByText('4/5')).toBeInTheDocument()
  })

  it('does not display rating value when null', () => {
    render(<RatingInput label="Tech Stack" value={null} onChange={() => {}} />)

    expect(screen.queryByText(/\/5/)).not.toBeInTheDocument()
  })

  it('highlights all buttons up to selected rating', () => {
    render(<RatingInput label="Tech Stack" value={3} onChange={() => {}} />)

    const buttons = screen.getAllByRole('button')
    // Buttons 1, 2 should have partial highlight (bg-primary/20)
    expect(buttons[0]).toHaveClass('bg-primary/20')
    expect(buttons[1]).toHaveClass('bg-primary/20')
    // Button 3 should have full highlight (bg-primary)
    expect(buttons[2]).toHaveClass('bg-primary')
    // Buttons 4, 5 should have muted state
    expect(buttons[3]).toHaveClass('bg-muted/50')
    expect(buttons[4]).toHaveClass('bg-muted/50')
  })

  it('allows selecting different ratings', () => {
    const onChange = vi.fn()
    render(<RatingInput label="Role Fit" value={2} onChange={onChange} />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[4]) // 5th button = rating 5
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('calls onChange with rating 1 for first button', () => {
    const onChange = vi.fn()
    render(<RatingInput label="Company" value={null} onChange={onChange} />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0]) // 1st button = rating 1
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('renders with different labels', () => {
    const { rerender } = render(<RatingInput label="Company" value={null} onChange={() => {}} />)
    expect(screen.getByText('Company')).toBeInTheDocument()

    rerender(<RatingInput label="Industry" value={null} onChange={() => {}} />)
    expect(screen.getByText('Industry')).toBeInTheDocument()

    rerender(<RatingInput label="Role Fit" value={null} onChange={() => {}} />)
    expect(screen.getByText('Role Fit')).toBeInTheDocument()
  })

  it('buttons have type="button" to prevent form submission', () => {
    render(<RatingInput label="Tech Stack" value={null} onChange={() => {}} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toHaveAttribute('type', 'button')
    })
  })

  it('updates display when value prop changes', () => {
    const { rerender } = render(<RatingInput label="Tech Stack" value={2} onChange={() => {}} />)
    expect(screen.getByText('2/5')).toBeInTheDocument()

    rerender(<RatingInput label="Tech Stack" value={4} onChange={() => {}} />)
    expect(screen.getByText('4/5')).toBeInTheDocument()
  })

  it('handles maximum rating selection', () => {
    render(<RatingInput label="Tech Stack" value={5} onChange={() => {}} />)

    expect(screen.getByText('5/5')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    expect(buttons[4]).toHaveClass('bg-primary')
  })

  it('handles minimum rating selection', () => {
    render(<RatingInput label="Tech Stack" value={1} onChange={() => {}} />)

    expect(screen.getByText('1/5')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveClass('bg-primary')
  })
})
