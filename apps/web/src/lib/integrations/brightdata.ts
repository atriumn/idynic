import { z } from 'zod';

const BRIGHTDATA_API_URL = 'https://api.brightdata.com/datasets/v3/scrape';
const LINKEDIN_JOBS_DATASET_ID = 'gd_lpfll7v5hcqtkxl6l';

// Response schema from Bright Data
const LinkedInJobSchema = z.object({
  job_posting_id: z.string(),
  job_title: z.string(),
  company_name: z.string(),
  company_id: z.string().nullish(),
  company_logo: z.string().nullish(),
  company_url: z.string().nullish(),
  job_location: z.string().nullish(),
  job_summary: z.string(),
  job_description_formatted: z.string().nullish(),
  job_seniority_level: z.string().nullish(),
  job_employment_type: z.string().nullish(),
  job_function: z.string().nullish(),
  job_industries: z.string().nullish(),
  job_base_pay_range: z.string().nullish(),
  base_salary: z
    .object({
      min_amount: z.number(),
      max_amount: z.number(),
      currency: z.string(),
      payment_period: z.string(),
    })
    .nullish(),
  job_num_applicants: z.number().nullish(),
  job_posted_date: z.string().nullish(),
  job_posted_time: z.string().nullish(),
  is_easy_apply: z.boolean().nullish(),
  apply_link: z.string().nullish(),
});

export type LinkedInJob = z.infer<typeof LinkedInJobSchema>;

/**
 * Fetch structured job data from LinkedIn via Bright Data API
 */
export async function fetchLinkedInJob(jobUrl: string): Promise<LinkedInJob> {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  if (!apiKey) {
    throw new Error('BRIGHTDATA_API_KEY not configured');
  }

  const normalizedUrl = normalizeLinkedInJobUrl(jobUrl);

  const response = await fetch(
    `${BRIGHTDATA_API_URL}?dataset_id=${LINKEDIN_JOBS_DATASET_ID}&format=json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ url: normalizedUrl }]),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bright Data API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No job data returned from Bright Data');
  }

  return LinkedInJobSchema.parse(data[0]);
}

/**
 * Clean up LinkedIn job URLs (remove tracking params)
 */
function normalizeLinkedInJobUrl(url: string): string {
  const parsed = new URL(url);
  const jobId = parsed.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
  if (!jobId) {
    throw new Error('Invalid LinkedIn job URL');
  }
  return `https://www.linkedin.com/jobs/view/${jobId}/`;
}

/**
 * Check if a URL is a LinkedIn job posting
 */
export function isLinkedInJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes('linkedin.com') && parsed.pathname.includes('/jobs/view/')
    );
  } catch {
    return false;
  }
}
