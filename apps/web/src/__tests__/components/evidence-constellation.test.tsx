import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvidenceConstellation } from "@/components/evidence-constellation";
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
    {
      id: "claim-2",
      label: "Leadership",
      type: "achievement",
      confidence: 0.85,
    },
  ],
  documents: [
    { id: "doc-1", name: "Resume.pdf", type: "resume" },
    { id: "doc-2", name: "Story 1", type: "story" },
  ],
  documentClaimEdges: [
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

describe("EvidenceConstellation", () => {
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

    renderWithQueryClient(<EvidenceConstellation />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockUseIdentityGraph.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed"),
    });

    renderWithQueryClient(<EvidenceConstellation />);

    expect(screen.getByText("Failed to load data")).toBeInTheDocument();
  });

  it("renders empty state when no documents", () => {
    mockUseIdentityGraph.mockReturnValue({
      data: { nodes: [], documents: [], documentClaimEdges: [] },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<EvidenceConstellation />);

    expect(screen.getByText("No documents to display")).toBeInTheDocument();
  });

  it("renders SVG element", () => {
    const { container } = renderWithQueryClient(<EvidenceConstellation />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders legend", () => {
    renderWithQueryClient(<EvidenceConstellation />);

    expect(screen.getByText("Document Sources")).toBeInTheDocument();
    expect(screen.getByText(/documents in center/i)).toBeInTheDocument();
  });

  it("accepts onSelectClaim callback", () => {
    const onSelectClaim = vi.fn();
    renderWithQueryClient(
      <EvidenceConstellation onSelectClaim={onSelectClaim} />,
    );

    expect(screen.getByText("Document Sources")).toBeInTheDocument();
  });

  it("accepts selectedClaimId prop", () => {
    renderWithQueryClient(<EvidenceConstellation selectedClaimId="claim-1" />);

    expect(screen.getByText("Document Sources")).toBeInTheDocument();
  });

  it("renders container with min-height", () => {
    const { container } = renderWithQueryClient(<EvidenceConstellation />);

    const containerDiv = container.querySelector(".min-h-\\[400px\\]");
    expect(containerDiv).toBeInTheDocument();
  });

  it("renders when documents array is missing", () => {
    mockUseIdentityGraph.mockReturnValue({
      data: { nodes: [], documentClaimEdges: [] },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<EvidenceConstellation />);

    expect(screen.getByText("No documents to display")).toBeInTheDocument();
  });
});
