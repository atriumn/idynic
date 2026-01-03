import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpportunityNotes } from "@/components/opportunity-notes";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("OpportunityNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          rating_tech_stack: null,
          rating_company: null,
          rating_industry: null,
          rating_role_fit: null,
          links: [],
          notes: null,
        }),
    });
  });

  it("fetches notes on mount", async () => {
    render(<OpportunityNotes opportunityId="opp-123" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/opportunity-notes?opportunityId=opp-123",
      );
    });
  });

  it("renders rating inputs", async () => {
    render(<OpportunityNotes opportunityId="opp-123" />);

    await waitFor(() => {
      expect(screen.getByText("Tech Stack")).toBeInTheDocument();
      expect(screen.getByText("Company")).toBeInTheDocument();
      expect(screen.getByText("Industry")).toBeInTheDocument();
      expect(screen.getByText("Role Fit")).toBeInTheDocument();
    });
  });

  it("renders links section", async () => {
    render(<OpportunityNotes opportunityId="opp-123" />);

    await waitFor(() => {
      expect(screen.getByText("Relevant Links")).toBeInTheDocument();
    });
  });

  it("renders notes textarea", async () => {
    render(<OpportunityNotes opportunityId="opp-123" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/jot down quick thoughts/i),
      ).toBeInTheDocument();
    });
  });

  it("auto-saves when rating changes", async () => {
    const user = userEvent.setup();
    render(<OpportunityNotes opportunityId="opp-123" />);

    await waitFor(() => screen.getByText("Tech Stack"));

    // Rating buttons are empty, click the 4th button in the first rating group
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[3]); // 4th button = rating 4

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/opportunity-notes",
        expect.objectContaining({
          method: "PUT",
        }),
      );
    });
  });

  it("shows saving indicator", async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ ok: true, json: () => Promise.resolve({}) }),
            100,
          ),
        ),
    );

    render(<OpportunityNotes opportunityId="opp-123" />);

    await waitFor(() => screen.getByText("Tech Stack"));

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[3]); // 4th button = rating 4

    expect(screen.getByText("SAVING...")).toBeInTheDocument();
  });
});
