import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClaimDetailPanel } from "@/components/claim-detail-panel";

// Mock the identity graph hook
const mockUseIdentityGraph = vi.fn();
vi.mock("@/lib/hooks/use-identity-graph", () => ({
  useIdentityGraph: () => mockUseIdentityGraph(),
}));

const mockGraphData = {
  nodes: [
    {
      id: "claim-1",
      label: "React",
      type: "skill",
      confidence: 0.85,
      description: "Frontend library expertise",
    },
    {
      id: "claim-2",
      label: "Team Lead",
      type: "achievement",
      confidence: 0.9,
      description: null,
    },
  ],
  edges: [
    {
      source: "claim-1",
      target: "claim-2",
      sharedEvidence: ["evidence-1"],
    },
  ],
  evidence: [
    {
      id: "evidence-1",
      text: "Led the React migration project",
      sourceType: "resume",
      date: "2024-01-15",
    },
  ],
};

describe("ClaimDetailPanel", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIdentityGraph.mockReturnValue({ data: mockGraphData });
  });

  it("renders claim label when open", () => {
    render(<ClaimDetailPanel claimId="claim-1" onClose={mockOnClose} />);

    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("renders claim type badge", () => {
    render(<ClaimDetailPanel claimId="claim-1" onClose={mockOnClose} />);

    expect(screen.getByText("skill")).toBeInTheDocument();
  });

  it("renders confidence score", () => {
    render(<ClaimDetailPanel claimId="claim-1" onClose={mockOnClose} />);

    expect(screen.getByText("85% confidence")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<ClaimDetailPanel claimId="claim-1" onClose={mockOnClose} />);

    expect(screen.getByText("Frontend library expertise")).toBeInTheDocument();
  });

  it("renders confidence progress bar", () => {
    render(<ClaimDetailPanel claimId="claim-1" onClose={mockOnClose} />);

    expect(screen.getByText("Confidence")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("renders connected evidence", () => {
    render(<ClaimDetailPanel claimId="claim-1" onClose={mockOnClose} />);

    expect(screen.getByText("Supporting Evidence (1)")).toBeInTheDocument();
    expect(
      screen.getByText("Led the React migration project"),
    ).toBeInTheDocument();
  });

  it("renders evidence source type", () => {
    render(<ClaimDetailPanel claimId="claim-1" onClose={mockOnClose} />);

    expect(screen.getByText("Resume")).toBeInTheDocument();
  });

  it("renders evidence date", () => {
    render(<ClaimDetailPanel claimId="claim-1" onClose={mockOnClose} />);

    // Date formatted as locale string
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it("does not render when claimId is null", () => {
    render(<ClaimDetailPanel claimId={null} onClose={mockOnClose} />);

    // Sheet should not be visible
    expect(screen.queryByText("React")).not.toBeInTheDocument();
  });

  it("calls onClose when sheet is closed", async () => {
    const user = userEvent.setup();
    render(<ClaimDetailPanel claimId="claim-1" onClose={mockOnClose} />);

    // Find and click the close button (X) in the sheet
    const closeButton = screen.getByRole("button", { name: /close/i });
    await user.click(closeButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("applies correct color class for skill type", () => {
    render(<ClaimDetailPanel claimId="claim-1" onClose={mockOnClose} />);

    const badge = screen.getByText("skill");
    expect(badge).toHaveClass("bg-blue-100");
  });

  it("applies correct color class for achievement type", () => {
    render(<ClaimDetailPanel claimId="claim-2" onClose={mockOnClose} />);

    const badge = screen.getByText("achievement");
    expect(badge).toHaveClass("bg-green-100");
  });

  it("does not render description section when null", () => {
    render(<ClaimDetailPanel claimId="claim-2" onClose={mockOnClose} />);

    expect(screen.queryByText("Description")).not.toBeInTheDocument();
  });

  it("handles claim not found in graph data", () => {
    render(<ClaimDetailPanel claimId="nonexistent" onClose={mockOnClose} />);

    // Should not render claim details
    expect(screen.queryByText("React")).not.toBeInTheDocument();
  });

  it("deduplicates evidence when same evidence appears multiple times", () => {
    mockUseIdentityGraph.mockReturnValue({
      data: {
        ...mockGraphData,
        edges: [
          {
            source: "claim-1",
            target: "claim-2",
            sharedEvidence: ["evidence-1"],
          },
          {
            source: "claim-1",
            target: "claim-3",
            sharedEvidence: ["evidence-1"],
          },
        ],
      },
    });

    render(<ClaimDetailPanel claimId="claim-1" onClose={mockOnClose} />);

    // Should only show evidence once
    expect(screen.getByText("Supporting Evidence (1)")).toBeInTheDocument();
  });
});
