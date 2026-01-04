import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WaitlistForm } from "@/components/waitlist-form";

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

describe("WaitlistForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
  });

  describe("default props", () => {
    it("renders with default labels", () => {
      render(<WaitlistForm source="homepage" />);

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("you@example.com"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /join waitlist/i }),
      ).toBeInTheDocument();
    });

    it("shows default privacy notice", () => {
      render(<WaitlistForm source="homepage" />);

      expect(screen.getByText(/never share your email/i)).toBeInTheDocument();
    });
  });

  describe("custom props", () => {
    it("renders with custom labels", () => {
      render(
        <WaitlistForm
          source="recruiters"
          emailLabel="Work email"
          emailPlaceholder="you@company.com"
          submitLabel="Get Early Access"
        />,
      );

      expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("you@company.com"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /get early access/i }),
      ).toBeInTheDocument();
    });

    it("renders with custom success messages", async () => {
      const user = userEvent.setup();
      render(
        <WaitlistForm
          source="students"
          successTitle="Welcome aboard!"
          successMessage="Check your inbox soon."
        />,
      );

      await user.type(
        screen.getByPlaceholderText("you@example.com"),
        "student@edu.com",
      );
      await user.click(screen.getByRole("button", { name: /join waitlist/i }));

      await waitFor(() => {
        expect(screen.getByText("Welcome aboard!")).toBeInTheDocument();
        expect(screen.getByText("Check your inbox soon.")).toBeInTheDocument();
      });
    });

    it("renders with custom privacy note", () => {
      render(
        <WaitlistForm source="homepage" privacyNote="Your data is safe." />,
      );

      expect(screen.getByText("Your data is safe.")).toBeInTheDocument();
    });
  });

  describe("form submission", () => {
    it("submits email with source to API", async () => {
      const user = userEvent.setup();
      render(<WaitlistForm source="homepage" />);

      await user.type(
        screen.getByPlaceholderText("you@example.com"),
        "user@example.com",
      );
      await user.click(screen.getByRole("button", { name: /join waitlist/i }));

      expect(mockFetch).toHaveBeenCalledWith("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          source: "homepage",
          interests: undefined,
        }),
      });
    });

    it("submits with custom interests", async () => {
      const user = userEvent.setup();
      render(<WaitlistForm source="recruiters" interests={["recruiting"]} />);

      await user.type(
        screen.getByPlaceholderText("you@example.com"),
        "recruiter@company.com",
      );
      await user.click(screen.getByRole("button", { name: /join waitlist/i }));

      expect(mockFetch).toHaveBeenCalledWith("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "recruiter@company.com",
          source: "recruiters",
          interests: ["recruiting"],
        }),
      });
    });

    it("submits with multiple interests", async () => {
      const user = userEvent.setup();
      render(
        <WaitlistForm
          source="homepage"
          interests={["job_seeking", "recruiting"]}
        />,
      );

      await user.type(
        screen.getByPlaceholderText("you@example.com"),
        "both@example.com",
      );
      await user.click(screen.getByRole("button", { name: /join waitlist/i }));

      expect(mockFetch).toHaveBeenCalledWith("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "both@example.com",
          source: "homepage",
          interests: ["job_seeking", "recruiting"],
        }),
      });
    });
  });

  describe("success state", () => {
    it("shows success state after submission", async () => {
      const user = userEvent.setup();
      render(<WaitlistForm source="homepage" />);

      await user.type(
        screen.getByPlaceholderText("you@example.com"),
        "test@example.com",
      );
      await user.click(screen.getByRole("button", { name: /join waitlist/i }));

      await waitFor(() => {
        expect(screen.getByText("You're on the list!")).toBeInTheDocument();
        expect(
          screen.getByText(/we'll reach out when we launch/i),
        ).toBeInTheDocument();
      });
    });

    it("hides form after success", async () => {
      const user = userEvent.setup();
      render(<WaitlistForm source="homepage" />);

      await user.type(
        screen.getByPlaceholderText("you@example.com"),
        "test@example.com",
      );
      await user.click(screen.getByRole("button", { name: /join waitlist/i }));

      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText("you@example.com"),
        ).not.toBeInTheDocument();
      });
    });

    it("shows success toast with custom title", async () => {
      const user = userEvent.setup();
      render(<WaitlistForm source="homepage" successTitle="You made it!" />);

      await user.type(
        screen.getByPlaceholderText("you@example.com"),
        "test@example.com",
      );
      await user.click(screen.getByRole("button", { name: /join waitlist/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("You made it!");
      });
    });
  });

  describe("error handling", () => {
    it("shows error toast on failure", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const user = userEvent.setup();
      render(<WaitlistForm source="homepage" />);

      await user.type(
        screen.getByPlaceholderText("you@example.com"),
        "test@example.com",
      );
      await user.click(screen.getByRole("button", { name: /join waitlist/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to join waitlist");
      });
    });

    it("stays in form state after error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const user = userEvent.setup();
      render(<WaitlistForm source="homepage" />);

      await user.type(
        screen.getByPlaceholderText("you@example.com"),
        "test@example.com",
      );
      await user.click(screen.getByRole("button", { name: /join waitlist/i }));

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("you@example.com"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("loading state", () => {
    it("disables button while submitting", async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<WaitlistForm source="homepage" />);

      await user.type(
        screen.getByPlaceholderText("you@example.com"),
        "test@example.com",
      );
      await user.click(screen.getByRole("button", { name: /join waitlist/i }));

      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("form validation", () => {
    it("requires email field", () => {
      render(<WaitlistForm source="homepage" />);

      expect(screen.getByPlaceholderText("you@example.com")).toBeRequired();
    });

    it("validates email type", () => {
      render(<WaitlistForm source="homepage" />);

      expect(screen.getByPlaceholderText("you@example.com")).toHaveAttribute(
        "type",
        "email",
      );
    });
  });

  describe("different sources", () => {
    it.each(["homepage", "students", "recruiters", "mobile"] as const)(
      "submits with %s source",
      async (source) => {
        const user = userEvent.setup();
        render(<WaitlistForm source={source} />);

        await user.type(
          screen.getByPlaceholderText("you@example.com"),
          "test@example.com",
        );
        await user.click(
          screen.getByRole("button", { name: /join waitlist/i }),
        );

        expect(mockFetch).toHaveBeenCalledWith(
          "/api/waitlist",
          expect.objectContaining({
            body: expect.stringContaining(`"source":"${source}"`),
          }),
        );
      },
    );
  });
});
