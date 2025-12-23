"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";

interface CompanyLogoProps {
  domain: string | null | undefined;
  companyName: string;
  size?: number;
  className?: string;
}

/**
 * Displays a company logo using Google's favicon service, with fallback to a building icon.
 * Only renders an image if a valid domain is provided.
 */
export function CompanyLogo({
  domain,
  companyName,
  size = 24,
  className = "",
}: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false);

  // No domain or already errored - show fallback icon
  if (!domain || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded ${className}`}
        style={{ width: size, height: size }}
        title={companyName}
      >
        <Building2 className="text-muted-foreground" style={{ width: size * 0.6, height: size * 0.6 }} />
      </div>
    );
  }

  // Clean domain (remove any protocol if accidentally included)
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  // Use logo.dev for high-quality company logos
  const logoUrl = `https://img.logo.dev/${cleanDomain}?token=pk_b3U88G0OTNKjNTpAlTU_OQ&retina=true`;

  return (
    // Using img instead of Next Image since Google's service handles caching
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt={`${companyName} logo`}
      width={size}
      height={size}
      className={`rounded ${className}`}
      onError={() => setHasError(true)}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}

/**
 * Returns the logo.dev URL for a company domain.
 * Useful for contexts where the component can't be used (e.g., react-pdf).
 */
export function getLogoUrl(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://img.logo.dev/${cleanDomain}?token=pk_b3U88G0OTNKjNTpAlTU_OQ&retina=true`;
}
