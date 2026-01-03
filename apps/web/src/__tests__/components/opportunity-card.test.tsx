import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpportunityCard } from "@/components/opportunity-card";
import type { Database } from "@/lib/supabase/types";

type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

const createMockOpportunity = (
  overrides: Partial<Opportunity> = {},
): Opportunity => ({
  id: "opp-123",
  user_id: "user-123",
  title: "Senior Software Engineer",
  company: "Acme Corp",
  location: "San Francisco, CA",
  employment_type: "Full-time",
  status: "tracking",
  url: "https://example.com/job",
  description: "A great job",
  description_html: null,
  requirements: null,
  company_logo_url: null,
  company_url: null,
  company_industry: null,
  company_is_public: null,
  company_stock_ticker: null,
  company_challenges: null,
  company_recent_news: null,
  company_researched_at: null,
  company_role_context: null,
  created_at: "2024-01-01T00:00:00Z",
  source: "manual",
  normalized_url: null,
  posted_date: null,
  applicant_count: null,
  easy_apply: null,
  embedding: null,
  salary_min: null,
  salary_max: null,
  salary_currency: null,
  seniority_level: null,
  job_function: null,
  industries: null,
  ...overrides,
});

describe("OpportunityCard", () => {
  it("renders job title", () => {
    const opp = createMockOpportunity();
    render(<OpportunityCard opportunity={opp} />);

    expect(screen.getByText("Senior Software Engineer")).toBeInTheDocument();
  });

  it("renders company name", () => {
    const opp = createMockOpportunity();
    render(<OpportunityCard opportunity={opp} />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it('renders "Direct Hire" when no company', () => {
    const opp = createMockOpportunity({ company: null });
    render(<OpportunityCard opportunity={opp} />);

    expect(screen.getByText("Direct Hire")).toBeInTheDocument();
  });

  it("renders location when provided", () => {
    const opp = createMockOpportunity();
    render(<OpportunityCard opportunity={opp} />);

    expect(screen.getByText("San Francisco, CA")).toBeInTheDocument();
  });

  it("renders employment type when provided", () => {
    const opp = createMockOpportunity();
    render(<OpportunityCard opportunity={opp} />);

    expect(screen.getByText("Full-time")).toBeInTheDocument();
  });

  it("renders status badge with correct status", () => {
    const opp = createMockOpportunity({ status: "applied" });
    render(<OpportunityCard opportunity={opp} />);

    expect(screen.getByText("applied")).toBeInTheDocument();
  });

  it("renders fallback status when null", () => {
    const opp = createMockOpportunity({ status: null });
    render(<OpportunityCard opportunity={opp} />);

    expect(screen.getByText("tracking")).toBeInTheDocument();
  });

  it("links to opportunity detail page", () => {
    const opp = createMockOpportunity();
    render(<OpportunityCard opportunity={opp} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/opportunities/opp-123");
  });

  it("renders requirements count when provided", () => {
    const opp = createMockOpportunity({
      requirements: {
        mustHave: ["React", "TypeScript", "Node.js"],
        niceToHave: ["GraphQL"],
      },
    });
    render(<OpportunityCard opportunity={opp} />);

    expect(screen.getByText("3")).toBeInTheDocument(); // mustHave count
    expect(screen.getByText("1")).toBeInTheDocument(); // niceToHave count
  });

  it("does not render requirements section when no requirements", () => {
    const opp = createMockOpportunity({ requirements: null });
    render(<OpportunityCard opportunity={opp} />);

    expect(screen.queryByText("Match Analysis")).not.toBeInTheDocument();
  });

  it("renders company logo when provided", () => {
    const opp = createMockOpportunity({
      company_logo_url: "https://example.com/logo.png",
    });
    render(<OpportunityCard opportunity={opp} />);

    expect(screen.getByAltText("Acme Corp")).toBeInTheDocument();
  });

  it("renders relative time for created_at", () => {
    // Create a date from 5 days ago
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const opp = createMockOpportunity({
      created_at: fiveDaysAgo.toISOString(),
    });
    render(<OpportunityCard opportunity={opp} />);

    // Should show something like "5 days ago"
    expect(screen.getByText(/days ago/i)).toBeInTheDocument();
  });

  it('shows "JUST NOW" when no created_at', () => {
    const opp = createMockOpportunity({ created_at: null });
    render(<OpportunityCard opportunity={opp} />);

    expect(screen.getByText("JUST NOW")).toBeInTheDocument();
  });
});
