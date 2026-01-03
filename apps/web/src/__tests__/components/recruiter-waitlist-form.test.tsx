import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecruiterWaitlistForm } from "@/components/recruiter-waitlist-form";

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

describe("RecruiterWaitlistForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
  });

  it("renders email input with label", () => {
    render(<RecruiterWaitlistForm />);

    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@company.com")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<RecruiterWaitlistForm />);

    expect(
      screen.getByRole("button", { name: /get early access/i }),
    ).toBeInTheDocument();
  });

  it("shows privacy notice", () => {
    render(<RecruiterWaitlistForm />);

    expect(screen.getByText(/never share your email/i)).toBeInTheDocument();
  });

  it("submits email to API", async () => {
    const user = userEvent.setup();
    render(<RecruiterWaitlistForm />);

    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "recruiter@company.com",
    );
    await user.click(screen.getByRole("button", { name: /get early access/i }));

    expect(mockFetch).toHaveBeenCalledWith("/api/recruiter-waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "recruiter@company.com" }),
    });
  });

  it("shows success state after submission", async () => {
    const user = userEvent.setup();
    render(<RecruiterWaitlistForm />);

    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /get early access/i }));

    await waitFor(() => {
      expect(screen.getByText("You're on the list!")).toBeInTheDocument();
      expect(
        screen.getByText(/we'll reach out when we launch/i),
      ).toBeInTheDocument();
    });
  });

  it("hides form after success", async () => {
    const user = userEvent.setup();
    render(<RecruiterWaitlistForm />);

    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /get early access/i }));

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText("you@company.com"),
      ).not.toBeInTheDocument();
    });
  });

  it("shows success toast", async () => {
    const user = userEvent.setup();
    render(<RecruiterWaitlistForm />);

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
    render(<RecruiterWaitlistForm />);

    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /get early access/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to join waitlist");
    });
  });

  it("stays in form state after error", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<RecruiterWaitlistForm />);

    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /get early access/i }));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("you@company.com"),
      ).toBeInTheDocument();
    });
  });

  it("disables button while submitting", async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<RecruiterWaitlistForm />);

    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /get early access/i }));

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("requires email field", () => {
    render(<RecruiterWaitlistForm />);

    expect(screen.getByPlaceholderText("you@company.com")).toBeRequired();
  });

  it("validates email type", () => {
    render(<RecruiterWaitlistForm />);

    expect(screen.getByPlaceholderText("you@company.com")).toHaveAttribute(
      "type",
      "email",
    );
  });
});
