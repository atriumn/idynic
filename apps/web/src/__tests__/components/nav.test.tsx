import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Nav } from "@/components/nav";
import type { User } from "@supabase/supabase-js";

// Mock Supabase client
const mockSignOut = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

const mockUser: User = {
  id: "user-123",
  email: "test@example.com",
  aud: "authenticated",
  created_at: "2024-01-01",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};

describe("Nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when user is logged out", () => {
    it("renders logo and brand name", () => {
      render(<Nav user={null} />);

      expect(screen.getByText("Idynic")).toBeInTheDocument();
      expect(screen.getByAltText("Idynic")).toBeInTheDocument();
    });

    it("shows Login button", () => {
      render(<Nav user={null} />);

      expect(screen.getByRole("link", { name: /login/i })).toBeInTheDocument();
    });

    it("shows public navigation links", () => {
      render(<Nav user={null} />);

      expect(
        screen.getByRole("link", { name: /pricing/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /for recruiters/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /docs/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /help/i })).toBeInTheDocument();
    });

    it("does not show authenticated navigation links", () => {
      render(<Nav user={null} />);

      expect(
        screen.queryByRole("link", { name: /identity/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /opportunities/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("when user is logged in", () => {
    it("shows user email in dropdown trigger", () => {
      render(<Nav user={mockUser} />);

      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });

    it("shows authenticated navigation links", () => {
      render(<Nav user={mockUser} />);

      expect(
        screen.getByRole("link", { name: /identity/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /opportunities/i }),
      ).toBeInTheDocument();
    });

    it("does not show Login button", () => {
      render(<Nav user={mockUser} />);

      expect(
        screen.queryByRole("link", { name: /^login$/i }),
      ).not.toBeInTheDocument();
    });

    it("opens dropdown menu when clicked", async () => {
      const user = userEvent.setup();
      render(<Nav user={mockUser} />);

      // Find the dropdown trigger button by the email text it contains
      const dropdownTrigger = screen
        .getByText("test@example.com")
        .closest("button");
      await user.click(dropdownTrigger!);

      await waitFor(() => {
        expect(screen.getByText("Profile")).toBeInTheDocument();
        expect(screen.getByText("Shared Links")).toBeInTheDocument();
        expect(screen.getByText("Usage & Billing")).toBeInTheDocument();
        expect(screen.getByText("API Keys")).toBeInTheDocument();
        expect(screen.getByText("Logout")).toBeInTheDocument();
      });
    });

    it("logs out when Logout is clicked", async () => {
      const user = userEvent.setup();
      render(<Nav user={mockUser} />);

      // Find the dropdown trigger button by the email text it contains
      const dropdownTrigger = screen
        .getByText("test@example.com")
        .closest("button");
      await user.click(dropdownTrigger!);

      await waitFor(() => {
        expect(screen.getByText("Logout")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Logout"));

      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("includes ThemeToggle", () => {
    render(<Nav user={null} />);

    // ThemeToggle renders a button with sr-only text
    expect(screen.getByText("Toggle theme")).toBeInTheDocument();
  });
});
