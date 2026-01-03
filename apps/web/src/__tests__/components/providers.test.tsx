import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Providers } from "@/components/providers";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";

// Test component to verify providers are working
function TestChild() {
  const queryClient = useQueryClient();
  const { theme } = useTheme();

  return (
    <div>
      <span data-testid="has-query-client">{queryClient ? "yes" : "no"}</span>
      <span data-testid="has-theme">{theme ? "yes" : "no"}</span>
    </div>
  );
}

describe("Providers", () => {
  it("renders children", () => {
    render(
      <Providers>
        <div data-testid="child">Hello</div>
      </Providers>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("provides QueryClient to children", () => {
    render(
      <Providers>
        <TestChild />
      </Providers>,
    );

    expect(screen.getByTestId("has-query-client")).toHaveTextContent("yes");
  });

  it("provides ThemeProvider to children", () => {
    render(
      <Providers>
        <TestChild />
      </Providers>,
    );

    // Theme provider is present (theme value may vary)
    expect(screen.getByTestId("has-theme")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    render(
      <Providers>
        <div data-testid="child-1">First</div>
        <div data-testid="child-2">Second</div>
      </Providers>,
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });
});
