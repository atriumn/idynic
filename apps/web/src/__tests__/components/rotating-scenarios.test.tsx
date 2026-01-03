import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RotatingScenarios } from "@/components/rotating-scenarios";

describe("RotatingScenarios", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders first scenario initially", () => {
    render(<RotatingScenarios />);

    expect(
      screen.getByText("It's 9pm. Self-review due tomorrow."),
    ).toBeInTheDocument();
    expect(screen.getByText(/digging through slack/i)).toBeInTheDocument();
    expect(
      screen.getByText(/pull your accomplishments in seconds/i),
    ).toBeInTheDocument();
  });

  it('renders "with idynic" divider', () => {
    render(<RotatingScenarios />);

    expect(screen.getByText(/with idynic/i)).toBeInTheDocument();
  });

  it("renders navigation indicators", () => {
    render(<RotatingScenarios />);

    // 5 scenarios = 5 indicator buttons
    const indicators = screen.getAllByRole("button");
    expect(indicators).toHaveLength(5);
  });

  it("auto-advances to next scenario after interval", async () => {
    render(<RotatingScenarios />);

    // Initial scenario
    expect(
      screen.getByText("It's 9pm. Self-review due tomorrow."),
    ).toBeInTheDocument();

    // Advance timers: 4000ms interval + 300ms transition timeout
    await act(async () => {
      vi.advanceTimersByTime(4000); // Trigger interval
    });
    await act(async () => {
      vi.advanceTimersByTime(300); // Trigger nested setTimeout
    });

    // Should show second scenario
    expect(screen.getByText(/dream job just dropped/i)).toBeInTheDocument();
  });

  it("changes scenario when indicator is clicked", async () => {
    vi.useRealTimers(); // Use real timers for user interaction
    const user = userEvent.setup();

    render(<RotatingScenarios />);

    // Click on third indicator (index 2)
    const indicators = screen.getAllByRole("button");
    await user.click(indicators[2]);

    // Should show third scenario
    await waitFor(() => {
      expect(
        screen.getByText(/raise conversation next week/i),
      ).toBeInTheDocument();
    });
  });

  it("has accessible aria-labels on indicators", () => {
    render(<RotatingScenarios />);

    const indicators = screen.getAllByRole("button");
    expect(indicators[0]).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Scenario 1"),
    );
  });

  it("highlights active indicator", () => {
    render(<RotatingScenarios />);

    const indicators = screen.getAllByRole("button");
    // First indicator should have wider/active styling
    expect(indicators[0]).toHaveClass("w-8");
    expect(indicators[1]).toHaveClass("w-2");
  });

  it("renders all scenario content elements", () => {
    render(<RotatingScenarios />);

    // Should have icon container
    const iconContainer = document.querySelector(
      ".rounded-full.bg-primary\\/10",
    );
    expect(iconContainer).toBeInTheDocument();
  });

  it("wraps around to first scenario after last", async () => {
    render(<RotatingScenarios />);

    // Advance through all 5 scenarios
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(4000); // Trigger interval
      });
      await act(async () => {
        vi.advanceTimersByTime(300); // Trigger nested setTimeout
      });
    }

    // Should be back to first scenario
    expect(
      screen.getByText("It's 9pm. Self-review due tomorrow."),
    ).toBeInTheDocument();
  });
});
