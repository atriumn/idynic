import { cn } from "@/lib/utils";

type SortField = "label" | "confidence" | "sources";
type SortDirection = "asc" | "desc";

interface SortableHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}

export function SortableHeader({
  label,
  field,
  currentField,
  direction,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = field === currentField;

  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors",
        isActive && "text-foreground",
        className,
      )}
    >
      {label}
      {isActive && (
        <span className="text-[10px]">{direction === "desc" ? "▼" : "▲"}</span>
      )}
    </button>
  );
}

export type { SortField, SortDirection };
