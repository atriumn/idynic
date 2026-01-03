import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { IdentityConstellation } from "@/components/identity-constellation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the hook
const mockUseIdentityGraph = vi.fn();
vi.mock("@/lib/hooks/use-identity-graph", () => ({
  useIdentityGraph: () => mockUseIdentityGraph(),
}));

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

const mockData = {
  nodes: [
    {
      id: "claim-1",
      label: "React",
      type: "skill",
      confidence: 0.9,
      description: "Frontend library",
    },
    {
      id: "claim-2",
      label: "Node.js",
      type: "skill",
      confidence: 0.8,
      description: null,
    },
    {
      id: "claim-3",
      label: "Team Lead",
      type: "achievement",
      confidence: 0.85,
      description: "Led 5 engineers",
    },
  ],
};

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("IdentityConstellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIdentityGraph.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });
  });

  it("renders loading state", () => {
    mockUseIdentityGraph.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithQueryClient(<IdentityConstellation />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockUseIdentityGraph.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed"),
    });

    renderWithQueryClient(<IdentityConstellation />);

    expect(screen.getByText("Failed to load data")).toBeInTheDocument();
  });

  it("returns null when no nodes", () => {
    mockUseIdentityGraph.mockReturnValue({
      data: { nodes: [] },
      isLoading: false,
      error: null,
    });

    const { container } = renderWithQueryClient(<IdentityConstellation />);

    // Component returns null for empty state
    expect(container.firstChild).toBeNull();
  });

  it("renders SVG element", () => {
    const { container } = renderWithQueryClient(<IdentityConstellation />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders legend", () => {
    renderWithQueryClient(<IdentityConstellation />);

    expect(screen.getByText("Claims by Category")).toBeInTheDocument();
    expect(screen.getByText(/each box is a claim/i)).toBeInTheDocument();
  });

  it("renders interaction hint in legend", () => {
    renderWithQueryClient(<IdentityConstellation />);

    expect(
      screen.getByText(/click any claim to see details/i),
    ).toBeInTheDocument();
  });

  it("accepts onSelectClaim callback", () => {
    const onSelectClaim = vi.fn();
    renderWithQueryClient(
      <IdentityConstellation onSelectClaim={onSelectClaim} />,
    );

    expect(screen.getByText("Claims by Category")).toBeInTheDocument();
  });

  it("accepts selectedClaimId prop", () => {
    renderWithQueryClient(<IdentityConstellation selectedClaimId="claim-1" />);

    expect(screen.getByText("Claims by Category")).toBeInTheDocument();
  });

  it("renders container with min-height", () => {
    const { container } = renderWithQueryClient(<IdentityConstellation />);

    const containerDiv = container.querySelector(".min-h-\\[400px\\]");
    expect(containerDiv).toBeInTheDocument();
  });

  it("renders when data is null", () => {
    mockUseIdentityGraph.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    const { container } = renderWithQueryClient(<IdentityConstellation />);

    // Component returns null for null data
    expect(container.firstChild).toBeNull();
  });
});
