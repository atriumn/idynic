"use client";

import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CONTEXTUAL_HELP, type ContextualHelpKey } from "@idynic/shared";

interface HelpTooltipProps {
  helpKey: ContextualHelpKey;
  className?: string;
  iconSize?: number;
}

/** Parse **bold** markdown to React elements */
function parseBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-bold text-foreground">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

export function HelpTooltip({
  helpKey,
  className,
  iconSize = 14,
}: HelpTooltipProps) {
  const help = CONTEXTUAL_HELP[helpKey];

  if (!help) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
          aria-label={`Help: ${help.title}`}
        >
          <HelpCircle size={iconSize} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium mb-1">{help.title}</p>
        <div className="text-muted-foreground text-xs leading-relaxed">
          {parseBold(help.content)}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
