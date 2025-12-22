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
    expect(buttons[2]).toHaveAttribute('data-selected', 'true')
  })

  it('calls onChange when rating is clicked', () => {
    const onChange = vi.fn()
    render(<RatingInput label="Tech Stack" value={null} onChange={onChange} />)

    fireEvent.click(screen.getByText('4'))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('clears rating when same value is clicked', () => {
    const onChange = vi.fn()
    render(<RatingInput label="Tech Stack" value={3} onChange={onChange} />)

    fireEvent.click(screen.getByText('3'))
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
