"use client";

import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CONTEXTUAL_HELP, type ContextualHelpKey } from "@idynic/shared";

interface HelpTooltipProps {
  helpKey: ContextualHelpKey;
  className?: string;
  iconSize?: number;
}

export function HelpTooltip({ helpKey, className, iconSize = 14 }: HelpTooltipProps) {
  const help = CONTEXTUAL_HELP[helpKey];

  if (!help) return null;

  return (
    <TooltipProvider delayDuration={200}>
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
          <p className="text-muted-foreground text-xs">{help.content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
