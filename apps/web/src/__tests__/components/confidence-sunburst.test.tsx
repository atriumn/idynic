import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceSunburst } from "@/components/confidence-sunburst";
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
    { id: "claim-1", label: "React", type: "skill", confidence: 0.9 },
    { id: "claim-2", label: "Node.js", type: "skill", confidence: 0.8 },
    {
      id: "claim-3",
      label: "Leadership",
      type: "achievement",
      confidence: 0.85,
    },
  ],
  documentClaimEdges: [
    { documentId: "doc-1", claimId: "claim-1" },
    { documentId: "doc-1", claimId: "claim-1" },
    { documentId: "doc-2", claimId: "claim-2" },
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

describe("ConfidenceSunburst", () => {
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

    renderWithQueryClient(<ConfidenceSunburst />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockUseIdentityGraph.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed"),
    });

    renderWithQueryClient(<ConfidenceSunburst />);

    expect(screen.getByText("Failed to load data")).toBeInTheDocument();
  });

  it("renders empty state when no nodes", () => {
    mockUseIdentityGraph.mockReturnValue({
      data: { nodes: [], documentClaimEdges: [] },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<ConfidenceSunburst />);

    expect(screen.getByText("No claims to display")).toBeInTheDocument();
  });

  it("renders SVG element", () => {
    const { container } = renderWithQueryClient(<ConfidenceSunburst />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders legend", () => {
    renderWithQueryClient(<ConfidenceSunburst />);

    expect(screen.getByText("Evidence Strength")).toBeInTheDocument();
    expect(
      screen.getByText(/inner ring shows categories/i),
    ).toBeInTheDocument();
  });

  it("renders heat color legend items", () => {
    renderWithQueryClient(<ConfidenceSunburst />);

    expect(screen.getByText("4+ sources (hot)")).toBeInTheDocument();
    expect(screen.getByText("2-3 sources")).toBeInTheDocument();
    expect(screen.getByText("1 source")).toBeInTheDocument();
    expect(screen.getByText("No evidence")).toBeInTheDocument();
  });

  it("accepts onSelectClaim callback", () => {
    const onSelectClaim = vi.fn();
    renderWithQueryClient(<ConfidenceSunburst onSelectClaim={onSelectClaim} />);

    expect(screen.getByText("Evidence Strength")).toBeInTheDocument();
  });

  it("accepts selectedClaimId prop", () => {
    renderWithQueryClient(<ConfidenceSunburst selectedClaimId="claim-1" />);

    expect(screen.getByText("Evidence Strength")).toBeInTheDocument();
  });

  it("renders container with min-height", () => {
    const { container } = renderWithQueryClient(<ConfidenceSunburst />);

    const containerDiv = container.querySelector(".min-h-\\[400px\\]");
    expect(containerDiv).toBeInTheDocument();
  });

  it("renders without documentClaimEdges", () => {
    mockUseIdentityGraph.mockReturnValue({
      data: { nodes: mockData.nodes },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<ConfidenceSunburst />);

    expect(screen.getByText("Evidence Strength")).toBeInTheDocument();
  });
});
