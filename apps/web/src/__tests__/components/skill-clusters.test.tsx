import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillClusters } from "@/components/skill-clusters";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the hook
const mockUseSkillClusters = vi.fn();
vi.mock("@/lib/hooks/use-skill-clusters", () => ({
  useSkillClusters: () => mockUseSkillClusters(),
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
      x: 0.3,
      y: 0.4,
    },
    {
      id: "claim-2",
      label: "Node.js",
      type: "skill",
      confidence: 0.8,
      x: 0.5,
      y: 0.6,
    },
    {
      id: "claim-3",
      label: "Leadership",
      type: "achievement",
      confidence: 0.85,
      x: 0.7,
      y: 0.3,
    },
  ],
  regions: [
    {
      id: 1,
      label: "Technical",
      keywords: ["React", "Node.js"],
      x: 0.4,
      y: 0.5,
      count: 2,
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

describe("SkillClusters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSkillClusters.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });
  });

  it("renders loading state", () => {
    mockUseSkillClusters.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithQueryClient(<SkillClusters />);

    expect(screen.getByText("Computing clusters...")).toBeInTheDocument();
    expect(
      screen.getByText("Reducing 1536 dimensions to 2D"),
    ).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockUseSkillClusters.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed"),
    });

    renderWithQueryClient(<SkillClusters />);

    expect(screen.getByText("Failed to load clusters")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    mockUseSkillClusters.mockReturnValue({
      data: { nodes: [], regions: [] },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<SkillClusters />);

    expect(screen.getByText("No claims to cluster")).toBeInTheDocument();
  });

  it("renders SVG element", () => {
    const { container } = renderWithQueryClient(<SkillClusters />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders legend", () => {
    renderWithQueryClient(<SkillClusters />);

    expect(screen.getByText("Similarity Map")).toBeInTheDocument();
    expect(
      screen.getByText(/similar claims appear near each other/i),
    ).toBeInTheDocument();
  });

  it("renders type counts in legend", () => {
    renderWithQueryClient(<SkillClusters />);

    expect(screen.getByText(/skills \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/achievements \(1\)/i)).toBeInTheDocument();
  });

  it("accepts onSelectClaim callback", () => {
    const onSelectClaim = vi.fn();
    renderWithQueryClient(<SkillClusters onSelectClaim={onSelectClaim} />);

    // Component renders without error
    expect(screen.getByText("Similarity Map")).toBeInTheDocument();
  });

  it("accepts selectedClaimId prop", () => {
    renderWithQueryClient(<SkillClusters selectedClaimId="claim-1" />);

    expect(screen.getByText("Similarity Map")).toBeInTheDocument();
  });

  it("renders container with min-height", () => {
    const { container } = renderWithQueryClient(<SkillClusters />);

    const containerDiv = container.querySelector(".min-h-\\[400px\\]");
    expect(containerDiv).toBeInTheDocument();
  });
});
