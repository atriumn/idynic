import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackModal } from "@/components/feedback-modal";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("FeedbackModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ issueUrl: "https://github.com/test/issue/1" }),
    });
  });

  it("renders default trigger button", () => {
    render(<FeedbackModal />);

    expect(screen.getByText("Report a Bug")).toBeInTheDocument();
  });

  it("renders custom trigger", () => {
    render(<FeedbackModal trigger={<button>Custom Trigger</button>} />);

    expect(screen.getByText("Custom Trigger")).toBeInTheDocument();
  });

  it("opens modal when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<FeedbackModal />);

    await user.click(screen.getByText("Report a Bug"));

    expect(screen.getByText("Send Feedback")).toBeInTheDocument();
    expect(screen.getByText(/help us improve idynic/i)).toBeInTheDocument();
  });

  it("renders feedback type selector", async () => {
    const user = userEvent.setup();
    render(<FeedbackModal />);

    await user.click(screen.getByText("Report a Bug"));

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders title and description fields", async () => {
    const user = userEvent.setup();
    render(<FeedbackModal />);

    await user.click(screen.getByText("Report a Bug"));

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it("renders optional email field", async () => {
    const user = userEvent.setup();
    render(<FeedbackModal />);

    await user.click(screen.getByText("Report a Bug"));

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/optional/i)).toBeInTheDocument();
  });

  it("shows submit button with type label", async () => {
    const user = userEvent.setup();
    render(<FeedbackModal />);

    await user.click(screen.getByText("Report a Bug"));

    expect(
      screen.getByRole("button", { name: /submit bug report/i }),
    ).toBeInTheDocument();
  });

  it("submits feedback to API", async () => {
    const user = userEvent.setup();
    render(<FeedbackModal />);

    await user.click(screen.getByText("Report a Bug"));
    await user.type(screen.getByLabelText(/title/i), "Test Bug");
    await user.type(
      screen.getByLabelText(/description/i),
      "Description of the bug",
    );
    await user.click(
      screen.getByRole("button", { name: /submit bug report/i }),
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/feedback",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
  });

  it("shows success state after submission", async () => {
    const user = userEvent.setup();
    render(<FeedbackModal />);

    await user.click(screen.getByText("Report a Bug"));
    await user.type(screen.getByLabelText(/title/i), "Test Bug");
    await user.type(screen.getByLabelText(/description/i), "Description");
    await user.click(
      screen.getByRole("button", { name: /submit bug report/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Thank you!")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: /view on github/i }),
    ).toHaveAttribute("href", "https://github.com/test/issue/1");
  });

  it("shows close button after submission", async () => {
    const user = userEvent.setup();
    render(<FeedbackModal />);

    await user.click(screen.getByText("Report a Bug"));
    await user.type(screen.getByLabelText(/title/i), "Test");
    await user.type(screen.getByLabelText(/description/i), "Desc");
    await user.click(
      screen.getByRole("button", { name: /submit bug report/i }),
    );

    await waitFor(() => {
      // Multiple buttons with "Close" exist (text button + X dialog close) - verify at least one
      const closeButtons = screen.getAllByRole("button", { name: /^close$/i });
      expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows error on API failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    const user = userEvent.setup();
    render(<FeedbackModal />);

    await user.click(screen.getByText("Report a Bug"));
    await user.type(screen.getByLabelText(/title/i), "Test");
    await user.type(screen.getByLabelText(/description/i), "Desc");
    await user.click(
      screen.getByRole("button", { name: /submit bug report/i }),
    );

    // Form should still be visible (not success state)
    await waitFor(() => {
      expect(screen.queryByText("Thank you!")).not.toBeInTheDocument();
    });
  });

  it("includes email in submission when provided", async () => {
    const user = userEvent.setup();
    render(<FeedbackModal />);

    await user.click(screen.getByText("Report a Bug"));
    await user.type(screen.getByLabelText(/title/i), "Test");
    await user.type(screen.getByLabelText(/description/i), "Desc");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(
      screen.getByRole("button", { name: /submit bug report/i }),
    );

    await waitFor(() => {
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.email).toBe("test@example.com");
    });
  });
});
