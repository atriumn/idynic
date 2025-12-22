"use client"

interface RatingInputProps {
  label: string
  value: number | null
  onChange: (value: number | null) => void
}

export function RatingInput({ label, value, onChange }: RatingInputProps) {
  const handleClick = (rating: number) => {
    // Toggle off if clicking the same rating
    if (value === rating) {
      onChange(null)
    } else {
      onChange(rating)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => handleClick(rating)}
            data-selected={value === rating}
            className={`
              w-8 h-8 rounded-md text-sm font-medium transition-colors
              ${value === rating
                ? 'bg-primary text-primary-foreground'
                : value !== null && rating <= value
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }
            `}
          >
            {rating}
          </button>
        ))}
      </div>
    </div>
  )
}
