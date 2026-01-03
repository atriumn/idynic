import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CookieConsent,
  hasAnalyticsConsent,
} from "@/components/cookie-consent";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("CookieConsent", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("renders consent banner when no prior consent", async () => {
    render(<CookieConsent />);

    await waitFor(() => {
      expect(screen.getByText(/we use cookies/i)).toBeInTheDocument();
    });
  });

  it("shows Accept and Decline buttons", async () => {
    render(<CookieConsent />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /accept/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /decline/i }),
      ).toBeInTheDocument();
    });
  });

  it("has link to cookie policy", async () => {
    render(<CookieConsent />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /cookie policy/i });
      expect(link).toHaveAttribute("href", "/legal/cookies");
    });
  });

  it("hides banner and stores consent when Accept clicked", async () => {
    const user = userEvent.setup();
    render(<CookieConsent />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /accept/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /accept/i }));

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "idynic_cookie_consent",
      "accepted",
    );
    await waitFor(() => {
      expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument();
    });
  });

  it("hides banner and stores decline when Decline clicked", async () => {
    const user = userEvent.setup();
    render(<CookieConsent />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /decline/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /decline/i }));

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "idynic_cookie_consent",
      "declined",
    );
    await waitFor(() => {
      expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument();
    });
  });

  it("does not render if already accepted", async () => {
    localStorageMock.getItem.mockReturnValue("accepted");
    render(<CookieConsent />);

    // Wait for mount effect
    await waitFor(() => {
      expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument();
    });
  });

  it("does not render if already declined", async () => {
    localStorageMock.getItem.mockReturnValue("declined");
    render(<CookieConsent />);

    await waitFor(() => {
      expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument();
    });
  });
});

describe("hasAnalyticsConsent", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("returns true when consent is accepted", () => {
    localStorageMock.getItem.mockReturnValue("accepted");
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("returns false when consent is declined", () => {
    localStorageMock.getItem.mockReturnValue("declined");
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("returns false when no consent stored", () => {
    localStorageMock.getItem.mockReturnValue(null);
    expect(hasAnalyticsConsent()).toBe(false);
  });
});
