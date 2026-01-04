"use client";

import { Button } from "@/components/ui/button";
import {
  X,
  LinkedinLogo,
  Briefcase,
  Link as LinkIcon,
} from "@phosphor-icons/react";
import type { UrlType } from "@/lib/utils/url-detection";

interface LinkData {
  url: string;
  label: string | null;
  type: UrlType;
}

interface SmartLinksListProps {
  links: LinkData[];
  onRemove: (index: number) => void;
}

function getIconForType(type: UrlType) {
  switch (type) {
    case "linkedin":
      return <LinkedinLogo className="h-4 w-4 text-[#0A66C2]" weight="fill" />;
    case "glassdoor":
    case "indeed":
    case "greenhouse":
    case "lever":
    case "workday":
    case "careers":
      return <Briefcase className="h-4 w-4 text-muted-foreground" />;
    default:
      return <LinkIcon className="h-4 w-4 text-muted-foreground" />;
  }
}

function getDisplayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.replace("www.", "") +
      (parsed.pathname !== "/" ? parsed.pathname.slice(0, 20) + "..." : "")
    );
  } catch {
    return url.slice(0, 30) + "...";
  }
}

export function SmartLinksList({ links, onRemove }: SmartLinksListProps) {
  if (links.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No links added yet</p>
    );
  }

  return (
    <ul className="space-y-2">
      {links.map((link, index) => (
        <li key={index} className="flex items-center gap-2 group">
          {getIconForType(link.type)}
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-sm hover:underline truncate"
          >
            {link.label || getDisplayUrl(link.url)}
          </a>
          <span className="text-xs text-muted-foreground hidden group-hover:inline">
            {getDisplayUrl(link.url)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
