import type { ExtractedEvidence } from "@/lib/ai/extract-evidence";
import type { ExtractedJob } from "@/lib/ai/extract-work-history";

// Notable companies that are worth highlighting
const NOTABLE_COMPANIES = new Set([
  "google",
  "meta",
  "facebook",
  "amazon",
  "apple",
  "microsoft",
  "netflix",
  "uber",
  "airbnb",
  "stripe",
  "twitter",
  "x",
  "linkedin",
  "salesforce",
  "oracle",
  "ibm",
  "intel",
  "nvidia",
  "adobe",
  "spotify",
  "snap",
  "dropbox",
  "slack",
  "zoom",
  "shopify",
  "square",
  "block",
  "paypal",
  "coinbase",
  "robinhood",
  "doordash",
  "instacart",
  "lyft",
  "pinterest",
]);

function isNotableCompany(company: string): boolean {
  const normalized = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  return NOTABLE_COMPANIES.has(normalized);
}

function hasNumbers(text: string): boolean {
  return /\d+/.test(text);
}

function calculateTenure(job: ExtractedJob): string | null {
  if (!job.start_date) return null;

  const startYear = parseInt(job.start_date.match(/\d{4}/)?.[0] || "0");
  if (!startYear) return null;

  const endYear = job.end_date
    ? parseInt(job.end_date.match(/\d{4}/)?.[0] || "0")
    : new Date().getFullYear();

  if (!endYear) return null;

  const years = endYear - startYear;
  if (years < 1) return null;

  return `${years} year${years === 1 ? "" : "s"}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export interface Highlight {
  text: string;
  type: "certification" | "company" | "achievement" | "education";
}

export function extractHighlights(
  evidence: ExtractedEvidence[],
  workHistory: ExtractedJob[],
): Highlight[] {
  const highlights: Highlight[] = [];

  // From work history - notable companies with tenure
  for (const job of workHistory) {
    if (isNotableCompany(job.company)) {
      const tenure = calculateTenure(job);
      if (tenure) {
        highlights.push({
          text: `${tenure} at ${job.company}`,
          type: "company",
        });
      }
    }
  }

  // From evidence - certifications
  for (const item of evidence) {
    if (item.type === "certification") {
      highlights.push({
        text: item.text,
        type: "certification",
      });
    }
  }

  // From evidence - education
  for (const item of evidence) {
    if (item.type === "education") {
      highlights.push({
        text: item.text,
        type: "education",
      });
    }
  }

  // From evidence - quantified achievements (limit to avoid overwhelming)
  const quantifiedAchievements = evidence
    .filter((item) => item.type === "accomplishment" && hasNumbers(item.text))
    .slice(0, 3);

  for (const item of quantifiedAchievements) {
    highlights.push({
      text: truncate(item.text, 60),
      type: "achievement",
    });
  }

  // Return top 6 highlights max
  return highlights.slice(0, 6);
}
