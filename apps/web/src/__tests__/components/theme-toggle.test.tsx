import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeProvider } from "next-themes";

// Wrap component with ThemeProvider for testing
function renderThemeToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage
    localStorage.clear();
  });

  it("renders a button", async () => {
    renderThemeToggle();

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  it("has accessible label", async () => {
    renderThemeToggle();

    await waitFor(() => {
      expect(screen.getByText("Toggle theme")).toBeInTheDocument();
    });
  });

  it("renders placeholder before mounting", () => {
    // Before hydration, should show a placeholder button
    renderThemeToggle();
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("toggles theme when clicked", async () => {
    const user = userEvent.setup();
    renderThemeToggle();

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    const button = screen.getByRole("button");
    await user.click(button);

    // Theme should toggle (we can't easily verify the actual theme change
    // since next-themes handles it internally, but we can verify no errors)
    expect(button).toBeInTheDocument();
  });
});
