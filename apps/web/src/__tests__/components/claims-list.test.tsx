import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClaimsList } from "@/components/claims-list";
import type { Database } from "@/lib/supabase/types";

type Claim = Database["public"]["Tables"]["claims"]["Row"];

// Create mock claim data
const createMockClaim = (overrides: Partial<Claim> = {}): Claim => ({
  id: "claim-1",
  user_id: "user-1",
  claim_type: "skill",
  value: { name: "TypeScript", level: "expert" },
  evidence_text: "Used TypeScript extensively in production",
  created_at: "2024-01-01T00:00:00Z",
  document_id: "doc-1",
  confidence: 0.9,
  embedding: null,
  ...overrides,
});

describe("ClaimsList", () => {
  it("renders empty list when no claims", () => {
    const { container } = render(<ClaimsList claims={[]} />);

    // Should render the container but with no claim cards
    expect(container.querySelector(".space-y-3")).toBeInTheDocument();
  });

  it("renders a single claim", () => {
    const claims = [createMockClaim()];
    render(<ClaimsList claims={claims} />);

    expect(screen.getByText("skill")).toBeInTheDocument();
    expect(
      screen.getByText("Used TypeScript extensively in production"),
    ).toBeInTheDocument();
  });

  it("renders multiple claims", () => {
    const claims = [
      createMockClaim({
        id: "1",
        claim_type: "skill",
        evidence_text: "Skill evidence",
      }),
      createMockClaim({
        id: "2",
        claim_type: "experience",
        evidence_text: "Experience evidence",
      }),
      createMockClaim({
        id: "3",
        claim_type: "education",
        evidence_text: "Education evidence",
      }),
    ];
    render(<ClaimsList claims={claims} />);

    expect(screen.getByText("skill")).toBeInTheDocument();
    expect(screen.getByText("experience")).toBeInTheDocument();
    expect(screen.getByText("education")).toBeInTheDocument();
  });

  it("applies correct color classes for different claim types", () => {
    const claims = [
      createMockClaim({ id: "1", claim_type: "contact" }),
      createMockClaim({ id: "2", claim_type: "summary" }),
      createMockClaim({ id: "3", claim_type: "experience" }),
    ];
    render(<ClaimsList claims={claims} />);

    const contactBadge = screen.getByText("contact");
    const summaryBadge = screen.getByText("summary");
    const experienceBadge = screen.getByText("experience");

    expect(contactBadge).toHaveClass("bg-blue-100");
    expect(summaryBadge).toHaveClass("bg-purple-100");
    expect(experienceBadge).toHaveClass("bg-green-100");
  });

  it("renders claim value as JSON", () => {
    const claims = [createMockClaim({ value: { test: "value" } })];
    render(<ClaimsList claims={claims} />);

    // JSON should be stringified and displayed
    expect(screen.getByText(/"test": "value"/)).toBeInTheDocument();
  });

  it("uses fallback color for unknown claim types", () => {
    const claims = [
      createMockClaim({ claim_type: "unknown" as Claim["claim_type"] }),
    ];
    render(<ClaimsList claims={claims} />);

    const badge = screen.getByText("unknown");
    expect(badge).toHaveClass("bg-gray-100");
  });
});
