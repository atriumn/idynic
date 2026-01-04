"use client";

interface RatingInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}

export function RatingInput({ label, value, onChange }: RatingInputProps) {
  const handleClick = (rating: number) => {
    // Toggle off if clicking the same rating
    if (value === rating) {
      onChange(null);
    } else {
      onChange(rating);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-muted/20 rounded-lg border border-transparent hover:border-muted/50 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {value && (
          <span className="text-xs font-bold text-primary">{value}/5</span>
        )}
      </div>
      <div className="flex gap-1 h-6">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => handleClick(rating)}
            className={`
              flex-1 rounded text-[10px] font-bold transition-all h-full
              ${
                value === rating
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : value !== null && rating <= value
                    ? "bg-primary/20 text-primary"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }
            `}
          ></button>
        ))}
      </div>
    </div>
  );
}
