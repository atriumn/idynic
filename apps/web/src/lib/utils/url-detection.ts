export type UrlType =
  | 'linkedin'
  | 'glassdoor'
  | 'indeed'
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'careers'
  | 'link'

export function detectUrlType(url: string): UrlType {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    // Specific platforms
    if (hostname.includes('linkedin.com')) return 'linkedin'
    if (hostname.includes('glassdoor.com')) return 'glassdoor'
    if (hostname.includes('indeed.com')) return 'indeed'
    if (hostname.includes('greenhouse.io')) return 'greenhouse'
    if (hostname.includes('lever.co')) return 'lever'
    if (hostname.includes('myworkdayjobs.com') || hostname.includes('workday.com')) return 'workday'

    // Generic careers/jobs subdomains
    if (hostname.startsWith('careers.') || hostname.startsWith('jobs.')) return 'careers'

    return 'link'
  } catch {
    return 'link'
  }
}
