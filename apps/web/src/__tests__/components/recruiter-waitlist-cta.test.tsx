import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecruiterWaitlistCTA } from "@/components/recruiter-waitlist-cta";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("RecruiterWaitlistCTA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
  });

  it("renders trigger button", () => {
    render(<RecruiterWaitlistCTA />);

    expect(
      screen.getByRole("button", { name: /hiring\? get early access/i }),
    ).toBeInTheDocument();
  });

  it("opens dialog when trigger clicked", async () => {
    const user = userEvent.setup();
    render(<RecruiterWaitlistCTA />);

    await user.click(screen.getByRole("button", { name: /hiring/i }));

    expect(screen.getByText("Join the Waitlist")).toBeInTheDocument();
  });

  it("shows email input in dialog", async () => {
    const user = userEvent.setup();
    render(<RecruiterWaitlistCTA />);

    await user.click(screen.getByRole("button", { name: /hiring/i }));

    expect(screen.getByPlaceholderText("you@company.com")).toBeInTheDocument();
  });

  it("submits email to API", async () => {
    const user = userEvent.setup();
    render(<RecruiterWaitlistCTA />);

    await user.click(screen.getByRole("button", { name: /hiring/i }));
    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /get early access/i }));

    expect(mockFetch).toHaveBeenCalledWith("/api/recruiter-waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
  });

  it("shows success state after submission", async () => {
    const user = userEvent.setup();
    render(<RecruiterWaitlistCTA />);

    await user.click(screen.getByRole("button", { name: /hiring/i }));
    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /get early access/i }));

    await waitFor(() => {
      expect(screen.getByText("You're on the list!")).toBeInTheDocument();
    });
  });

  it("shows success toast on success", async () => {
    const user = userEvent.setup();
    render(<RecruiterWaitlistCTA />);

    await user.click(screen.getByRole("button", { name: /hiring/i }));
    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /get early access/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("You're on the list!");
    });
  });

  it("shows error toast on failure", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RecruiterWaitlistCTA />);

    await user.click(screen.getByRole("button", { name: /hiring/i }));
    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /get early access/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to join waitlist");
    });
  });

  it("does not submit with empty email", async () => {
    const user = userEvent.setup();
    render(<RecruiterWaitlistCTA />);

    await user.click(screen.getByRole("button", { name: /hiring/i }));

    // The form should have required validation
    expect(screen.getByPlaceholderText("you@company.com")).toBeRequired();
  });

  it("shows loading state while submitting", async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<RecruiterWaitlistCTA />);

    await user.click(screen.getByRole("button", { name: /hiring/i }));
    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /get early access/i }));

    // Button should be disabled
    expect(screen.getByRole("button", { name: "" })).toBeDisabled();
  });
});
