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
})
