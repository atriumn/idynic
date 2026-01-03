import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareLinkModal } from "@/components/share-link-modal";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock clipboard
const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ShareLinkModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockResolvedValue(undefined);
  });

  it("renders trigger button", () => {
    render(<ShareLinkModal tailoredProfileId="profile-123" />);

    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("opens dialog when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<ShareLinkModal tailoredProfileId="profile-123" />);

    await user.click(screen.getByRole("button", { name: /share/i }));

    expect(screen.getByText("Share Profile")).toBeInTheDocument();
  });

  describe("without existing link", () => {
    it("shows create link interface", async () => {
      const user = userEvent.setup();
      render(<ShareLinkModal tailoredProfileId="profile-123" />);

      await user.click(screen.getByRole("button", { name: /share/i }));

      expect(screen.getByText(/create a private link/i)).toBeInTheDocument();
      expect(screen.getByText(/link expires in/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /generate link/i }),
      ).toBeInTheDocument();
    });

    it("shows expiration selector", async () => {
      const user = userEvent.setup();
      render(<ShareLinkModal tailoredProfileId="profile-123" />);

      await user.click(screen.getByRole("button", { name: /share/i }));

      // Check that there's a select/combobox for expiration
      // (Radix Select options don't always render in jsdom)
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("creates a new link", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "link-123",
            token: "abc123",
            expiresAt: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }),
      });

      const onLinkCreated = vi.fn();
      const user = userEvent.setup();
      render(
        <ShareLinkModal
          tailoredProfileId="profile-123"
          onLinkCreated={onLinkCreated}
        />,
      );

      await user.click(screen.getByRole("button", { name: /share/i }));
      await user.click(screen.getByRole("button", { name: /generate link/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/shared-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("profile-123"),
        });
      });

      await waitFor(() => {
        expect(onLinkCreated).toHaveBeenCalled();
      });
    });
  });

  describe("with existing active link", () => {
    const existingLink = {
      id: "link-123",
      token: "abc123",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      revokedAt: null,
      viewCount: 5,
    };

    it("shows active link interface", async () => {
      const user = userEvent.setup();
      render(
        <ShareLinkModal
          tailoredProfileId="profile-123"
          existingLink={existingLink}
        />,
      );

      await user.click(screen.getByRole("button", { name: /share/i }));

      expect(
        screen.getByText(/your share link is active/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/5 views/i)).toBeInTheDocument();
    });

    it("shows copy button", async () => {
      const user = userEvent.setup();
      render(
        <ShareLinkModal
          tailoredProfileId="profile-123"
          existingLink={existingLink}
        />,
      );

      await user.click(screen.getByRole("button", { name: /share/i }));

      // Find the copy button (has Copy icon)
      const copyButtons = screen.getAllByRole("button");
      const copyButton = copyButtons.find((btn) => btn.querySelector("svg"));
      expect(copyButton).toBeDefined();
    });

    it("shows copy functionality", async () => {
      const user = userEvent.setup();
      render(
        <ShareLinkModal
          tailoredProfileId="profile-123"
          existingLink={existingLink}
        />,
      );

      await user.click(screen.getByRole("button", { name: /share/i }));

      // Wait for dialog to open
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Check that share link input is present with the expected value
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toContain("/shared/abc123");
    });

    it("revokes link", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const onLinkRevoked = vi.fn();
      const user = userEvent.setup();
      render(
        <ShareLinkModal
          tailoredProfileId="profile-123"
          existingLink={existingLink}
          onLinkRevoked={onLinkRevoked}
        />,
      );

      await user.click(screen.getByRole("button", { name: /share/i }));
      await user.click(screen.getByRole("button", { name: /revoke/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/shared-links/link-123", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("revoke"),
        });
      });

      await waitFor(() => {
        expect(onLinkRevoked).toHaveBeenCalled();
      });
    });

    it("extends link", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            expiresAt: new Date(
              Date.now() + 60 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }),
      });

      const user = userEvent.setup();
      render(
        <ShareLinkModal
          tailoredProfileId="profile-123"
          existingLink={existingLink}
        />,
      );

      await user.click(screen.getByRole("button", { name: /share/i }));
      await user.click(screen.getByRole("button", { name: /extend/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/shared-links/link-123", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("extend"),
        });
      });
    });
  });

  describe("with expired link", () => {
    const expiredLink = {
      id: "link-123",
      token: "abc123",
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
      revokedAt: null,
      viewCount: 3,
    };

    it("shows expired state", async () => {
      const user = userEvent.setup();
      render(
        <ShareLinkModal
          tailoredProfileId="profile-123"
          existingLink={expiredLink}
        />,
      );

      await user.click(screen.getByRole("button", { name: /share/i }));

      expect(screen.getByText(/this link has expired/i)).toBeInTheDocument();
    });

    it("allows creating new link", async () => {
      const user = userEvent.setup();
      render(
        <ShareLinkModal
          tailoredProfileId="profile-123"
          existingLink={expiredLink}
        />,
      );

      await user.click(screen.getByRole("button", { name: /share/i }));

      // Check for the Create New Link button specifically (use getAllByRole to handle duplicates)
      const createButtons = screen
        .getAllByRole("button")
        .filter((btn) =>
          btn.textContent?.toLowerCase().includes("create new link"),
        );
      expect(createButtons.length).toBeGreaterThan(0);
    });
  });

  describe("with revoked link", () => {
    const revokedLink = {
      id: "link-123",
      token: "abc123",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      revokedAt: new Date().toISOString(),
      viewCount: 2,
    };

    it("shows revoked state", async () => {
      const user = userEvent.setup();
      render(
        <ShareLinkModal
          tailoredProfileId="profile-123"
          existingLink={revokedLink}
        />,
      );

      await user.click(screen.getByRole("button", { name: /share/i }));

      expect(
        screen.getByText(/this link has been revoked/i),
      ).toBeInTheDocument();
    });
  });
});
