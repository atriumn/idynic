import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpportunityList } from "@/components/opportunities/opportunity-list";

// Mock OpportunityCard
vi.mock("@/components/opportunity-card", () => ({
  OpportunityCard: ({ opportunity }: { opportunity: { title: string } }) => (
    <div data-testid="opportunity-card">{opportunity.title}</div>
  ),
}));

const mockOpportunities = [
  {
    id: "opp-1",
    user_id: "user-1",
    title: "Senior Engineer",
    company: "TechCorp",
    location: "San Francisco",
    status: "applied",
    created_at: "2024-01-15T10:00:00Z",
    url: "https://example.com/job1",
    description: null,
    description_html: null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    employment_type: null,
    seniority_level: null,
    job_function: null,
    industries: null,
    company_logo_url: null,
    company_url: null,
    company_industry: null,
    company_is_public: null,
    company_stock_ticker: null,
    company_challenges: null,
    company_recent_news: null,
    company_researched_at: null,
    company_role_context: null,
    source: null,
    normalized_url: null,
    posted_date: null,
    applicant_count: null,
    easy_apply: null,
    embedding: null,
    requirements: null,
  },
  {
    id: "opp-2",
    user_id: "user-1",
    title: "Staff Engineer",
    company: "StartupXYZ",
    location: "Remote",
    status: "tracking",
    created_at: "2024-01-10T10:00:00Z",
    url: "https://example.com/job2",
    description: null,
    description_html: null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    employment_type: null,
    seniority_level: null,
    job_function: null,
    industries: null,
    company_logo_url: null,
    company_url: null,
    company_industry: null,
    company_is_public: null,
    company_stock_ticker: null,
    company_challenges: null,
    company_recent_news: null,
    company_researched_at: null,
    company_role_context: null,
    source: null,
    normalized_url: null,
    posted_date: null,
    applicant_count: null,
    easy_apply: null,
    embedding: null,
    requirements: null,
  },
];

describe("OpportunityList", () => {
  it("renders search input", () => {
    render(<OpportunityList initialOpportunities={mockOpportunities} />);
    expect(
      screen.getByPlaceholderText(/search targets, roles, or companies/i),
    ).toBeInTheDocument();
  });

  it("renders filter button", () => {
    render(<OpportunityList initialOpportunities={mockOpportunities} />);
    expect(screen.getByRole("button", { name: /status/i })).toBeInTheDocument();
  });

  it("renders view toggle buttons", () => {
    render(<OpportunityList initialOpportunities={mockOpportunities} />);
    const buttons = screen.getAllByRole("button");
    // Should have grid and list view buttons
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("renders opportunities in grid view by default", () => {
    render(<OpportunityList initialOpportunities={mockOpportunities} />);
    const cards = screen.getAllByTestId("opportunity-card");
    expect(cards).toHaveLength(2);
  });

  it("switches to list view", async () => {
    const user = userEvent.setup();
    render(<OpportunityList initialOpportunities={mockOpportunities} />);

    // Find and click the list view button (second toggle button)
    const buttons = screen.getAllByRole("button");
    const listButton = buttons.find((btn) => btn.querySelector(".lucide-list"));
    if (listButton) {
      await user.click(listButton);
    }

    // In list view, we should see a table
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("filters by search query", async () => {
    const user = userEvent.setup();
    render(<OpportunityList initialOpportunities={mockOpportunities} />);

    await user.type(
      screen.getByPlaceholderText(/search targets, roles, or companies/i),
      "Senior",
    );

    const cards = screen.getAllByTestId("opportunity-card");
    expect(cards).toHaveLength(1);
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
  });

  it("filters by company name", async () => {
    const user = userEvent.setup();
    render(<OpportunityList initialOpportunities={mockOpportunities} />);

    await user.type(
      screen.getByPlaceholderText(/search targets, roles, or companies/i),
      "TechCorp",
    );

    const cards = screen.getAllByTestId("opportunity-card");
    expect(cards).toHaveLength(1);
  });

  it("shows empty state when no matches", async () => {
    const user = userEvent.setup();
    render(<OpportunityList initialOpportunities={mockOpportunities} />);

    await user.type(
      screen.getByPlaceholderText(/search targets, roles, or companies/i),
      "nonexistent",
    );

    expect(
      screen.getByText("Zero targets match your search"),
    ).toBeInTheDocument();
  });

  it("shows empty state message", async () => {
    const user = userEvent.setup();
    render(<OpportunityList initialOpportunities={mockOpportunities} />);

    await user.type(
      screen.getByPlaceholderText(/search targets, roles, or companies/i),
      "nonexistent",
    );

    expect(screen.getByText(/try expanding your search/i)).toBeInTheDocument();
  });

  it("renders with empty opportunities list", () => {
    render(<OpportunityList initialOpportunities={[]} />);
    expect(
      screen.getByText("Zero targets match your search"),
    ).toBeInTheDocument();
  });

  it("displays table headers in list view", async () => {
    const user = userEvent.setup();
    render(<OpportunityList initialOpportunities={mockOpportunities} />);

    const buttons = screen.getAllByRole("button");
    const listButton = buttons.find((btn) => btn.querySelector(".lucide-list"));
    if (listButton) {
      await user.click(listButton);
    }

    expect(screen.getByText("Target Role")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
  });
});
