import * as cheerio from "cheerio";

const JINA_READER_URL = "https://r.jina.ai";
const BRIGHTDATA_WEB_UNLOCKER_URL = "https://api.brightdata.com/request";

/**
 * Fetch job page content from any URL using cascading fallbacks.
 * Returns markdown/text content or null if all methods fail.
 *
 * Chain: Jina Reader (free) → Bright Data Web Unlocker (paid) → null
 */
export async function fetchJobPageContent(url: string): Promise<string | null> {
  console.log("Fetching job page content for:", url);

  // Try Jina Reader first (free)
  const jinaContent = await tryJinaReader(url);
  if (jinaContent) {
    console.log("Jina Reader succeeded for:", url);
    return jinaContent;
  }

  // Fallback to Bright Data Web Unlocker
  const brightDataContent = await tryBrightDataWebUnlocker(url);
  if (brightDataContent) {
    console.log("Bright Data Web Unlocker succeeded for:", url);
    return brightDataContent;
  }

  console.log("All scraping methods failed for:", url);
  return null;
}

/**
 * Try fetching page content via Jina Reader (free service)
 */
async function tryJinaReader(url: string): Promise<string | null> {
  try {
    const response = await fetch(`${JINA_READER_URL}/${url}`, {
      headers: {
        Accept: "text/markdown",
        "X-Return-Format": "markdown",
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      console.log("Jina Reader failed with status:", response.status);
      return null;
    }

    const content = await response.text();

    // Jina returns empty or error messages sometimes
    if (!content || content.length < 100) {
      console.log("Jina Reader returned insufficient content");
      return null;
    }

    return content;
  } catch (error) {
    console.log("Jina Reader error:", error);
    return null;
  }
}

/**
 * Try fetching page content via Bright Data Web Unlocker (paid fallback)
 */
async function tryBrightDataWebUnlocker(url: string): Promise<string | null> {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  if (!apiKey) {
    console.log("Bright Data API key not configured, skipping fallback");
    return null;
  }

  try {
    const response = await fetch(BRIGHTDATA_WEB_UNLOCKER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        zone: "web_unlocker1",
        url,
        format: "raw",
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      console.log(
        "Bright Data Web Unlocker failed with status:",
        response.status,
      );
      return null;
    }

    const html = await response.text();
    return extractTextFromHtml(html);
  } catch (error) {
    console.log("Bright Data Web Unlocker error:", error);
    return null;
  }
}

/**
 * Extract readable text content from HTML using cheerio
 */
function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $(
    "script, style, nav, header, footer, aside, noscript, iframe, svg",
  ).remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
  $(".nav, .navbar, .header, .footer, .sidebar, .menu, .cookie").remove();

  // Try to find main content area
  let content = "";

  // Look for common job description containers
  const selectors = [
    '[class*="job-description"]',
    '[class*="jobDescription"]',
    '[class*="job_description"]',
    '[id*="job-description"]',
    '[id*="jobDescription"]',
    "article",
    "main",
    '[role="main"]',
    ".content",
    "#content",
  ];

  for (const selector of selectors) {
    const element = $(selector);
    if (element.length > 0) {
      content = element.text();
      if (content.length > 200) break;
    }
  }

  // Fallback to body if no specific container found
  if (content.length < 200) {
    content = $("body").text();
  }

  // Clean up whitespace
  return content
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

/**
 * Check if a URL looks like a job posting
 */
export function looksLikeJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Known job boards
    const jobBoards = [
      "indeed.com",
      "glassdoor.com",
      "ziprecruiter.com",
      "monster.com",
      "dice.com",
      "builtin.com",
      "lever.co",
      "greenhouse.io",
      "workday.com",
      "myworkdayjobs.com",
      "smartrecruiters.com",
      "jobvite.com",
      "icims.com",
      "ultipro.com",
      "breezy.hr",
      "ashbyhq.com",
      "welcometothejungle.com",
      "angel.co",
      "wellfound.com",
    ];

    // Check for job board domains
    if (jobBoards.some((board) => hostname.includes(board))) {
      return true;
    }

    // Check for jobs/careers subdomains
    if (hostname.startsWith("jobs.") || hostname.startsWith("careers.")) {
      return true;
    }

    // Check for common job URL patterns
    const jobPatterns = [
      "/job/",
      "/jobs/",
      "/career/",
      "/careers/",
      "/position/",
      "/positions/",
      "/opening/",
      "/openings/",
      "/vacancy/",
      "/vacancies/",
      "/apply/",
      "/requisition/",
    ];

    if (jobPatterns.some((pattern) => pathname.includes(pattern))) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
