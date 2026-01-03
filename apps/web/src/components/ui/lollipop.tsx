import { cn } from "@/lib/utils";

interface LollipopProps {
  value: number; // 0-100
  width?: number; // default 80px
  className?: string;
}

export function Lollipop({ value, width = 80, className }: LollipopProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const barWidth = (clampedValue / 100) * width;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        data-testid="lollipop-track"
        className="relative h-1 bg-muted rounded-full"
        style={{ width }}
      >
        <div
          className="absolute h-1 bg-teal-500 rounded-full transition-all"
          style={{ width: barWidth }}
        />
        {/* Lollipop head */}
        <div
          className="absolute w-2.5 h-2.5 bg-teal-500 rounded-full -top-[3px] transition-all"
          style={{ left: Math.max(0, barWidth - 5) }}
        />
      </div>
      <span className="text-xs text-teal-400 font-medium w-9 tabular-nums">
        {clampedValue}%
      </span>
    </div>
  );
}
