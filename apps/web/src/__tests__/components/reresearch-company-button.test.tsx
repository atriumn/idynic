import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReresearchCompanyButton } from "@/components/reresearch-company-button";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ReresearchCompanyButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
  });

  it("renders button with Re-research text", () => {
    render(<ReresearchCompanyButton opportunityId="opp-123" />);

    expect(
      screen.getByRole("button", { name: /re-research/i }),
    ).toBeInTheDocument();
  });

  it("calls API when clicked", async () => {
    const user = userEvent.setup();
    render(<ReresearchCompanyButton opportunityId="opp-123" />);

    await user.click(screen.getByRole("button"));

    expect(mockFetch).toHaveBeenCalledWith("/api/research-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId: "opp-123" }),
    });
  });

  it("shows loading state while researching", async () => {
    const user = userEvent.setup();
    // Make fetch hang
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<ReresearchCompanyButton opportunityId="opp-123" />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText(/researching/i)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("refreshes router on success", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true });

    render(<ReresearchCompanyButton opportunityId="opp-123" />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("handles API error gracefully", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockResolvedValue({ ok: false });

    render(<ReresearchCompanyButton opportunityId="opp-123" />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    // Button should return to normal state
    await waitFor(() => {
      expect(screen.getByText(/re-research/i)).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("handles network error gracefully", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<ReresearchCompanyButton opportunityId="opp-123" />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    // Button should return to normal state
    await waitFor(() => {
      expect(screen.getByText(/re-research/i)).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("disables button while loading", async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<ReresearchCompanyButton opportunityId="opp-123" />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
