// src/lib/utils/normalize-url.ts

/**
 * Normalize a job URL for duplicate detection.
 * Extracts canonical identifiers from known job boards,
 * strips tracking params from others.
 */
export function normalizeJobUrl(url: string | null | undefined): string | null {
  if (!url || url.trim() === '') {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // LinkedIn: extract job ID
  if (parsed.hostname.includes('linkedin.com')) {
    const match = parsed.pathname.match(/\/jobs\/view\/(\d+)/);
    if (match) {
      return `linkedin:${match[1]}`;
    }
  }

  // Greenhouse: extract company + job ID
  if (parsed.hostname.includes('greenhouse.io')) {
    const match = parsed.pathname.match(/\/([^/]+)\/jobs\/(\d+)/);
    if (match) {
      return `greenhouse:${match[1]}:${match[2]}`;
    }
  }

  // Lever: extract company + job ID
  if (parsed.hostname.includes('lever.co')) {
    const match = parsed.pathname.match(/\/([^/]+)\/([a-f0-9-]+)/);
    if (match) {
      return `lever:${match[1]}:${match[2]}`;
    }
  }

  // Other URLs: strip query params, keep hostname + path
  const path = parsed.pathname.replace(/\/$/, ''); // Remove trailing slash
  return `${parsed.hostname}${path}`;
}
