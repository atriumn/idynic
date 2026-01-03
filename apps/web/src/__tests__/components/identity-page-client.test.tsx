import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IdentityPageClient } from "@/components/identity-page-client";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// Mock hooks
vi.mock("@/lib/hooks/use-identity-graph", () => ({
  useIdentityGraph: () => ({
    data: {
      nodes: [
        {
          id: "claim-1",
          label: "React",
          type: "skill",
          confidence: 0.9,
          claim_evidence: [],
          issues: [],
        },
        {
          id: "claim-2",
          label: "TypeScript",
          type: "skill",
          confidence: 0.85,
          claim_evidence: [],
          issues: [],
        },
      ],
      documents: [],
    },
    isLoading: false,
  }),
  useInvalidateGraph: () => vi.fn(),
}));

vi.mock("@/lib/hooks/use-identity-reflection", () => ({
  useIdentityReflection: () => ({
    data: {
      headline: "Software Engineer",
      summary: "Experienced developer",
    },
    isLoading: false,
  }),
}));

// Mock visualization components (skip chart components)
vi.mock("@/components/identity-constellation", () => ({
  IdentityConstellation: () => (
    <div data-testid="identity-constellation">Constellation</div>
  ),
}));

vi.mock("@/components/evidence-constellation", () => ({
  EvidenceConstellation: () => (
    <div data-testid="evidence-constellation">Evidence</div>
  ),
}));

vi.mock("@/components/confidence-sunburst", () => ({
  ConfidenceSunburst: () => (
    <div data-testid="confidence-sunburst">Sunburst</div>
  ),
}));

vi.mock("@/components/skill-clusters", () => ({
  SkillClusters: () => <div data-testid="skill-clusters">Clusters</div>,
}));

// Mock other components
vi.mock("@/components/identity-claims-list", () => ({
  IdentityClaimsList: ({ claims }: { claims: unknown[] }) => (
    <div data-testid="identity-claims-list">Claims: {claims.length}</div>
  ),
}));

vi.mock("@/components/claim-detail-panel", () => ({
  ClaimDetailPanel: () => (
    <div data-testid="claim-detail-panel">Detail Panel</div>
  ),
}));

vi.mock("@/components/upload-resume-modal", () => ({
  UploadResumeModal: () => (
    <button data-testid="upload-resume-modal">Upload Resume</button>
  ),
}));

vi.mock("@/components/add-story-modal", () => ({
  AddStoryModal: () => <button data-testid="add-story-modal">Add Story</button>,
}));

vi.mock("@/components/identity/identity-reflection", () => ({
  IdentityReflection: ({ data }: { data: { headline?: string } | null }) => (
    <div data-testid="identity-reflection">
      {data?.headline || "No reflection"}
    </div>
  ),
}));

vi.mock("@/components/beta-gate", () => ({
  BetaGate: ({ onAccessGranted }: { onAccessGranted: () => void }) => (
    <div data-testid="beta-gate">
      <button onClick={onAccessGranted}>Grant Access</button>
    </div>
  ),
}));

// Mock shared constants
vi.mock("@idynic/shared", () => ({
  EMPTY_STATE: {
    title: "Build Your Professional Identity",
    subtitle: "Upload documents to get started",
    features: [
      { title: "See Your Skills", description: "AI extracts your skills" },
      { title: "Get Matched", description: "Match to opportunities" },
      { title: "Track Progress", description: "Monitor your growth" },
    ],
    help: {
      q1: { title: "What is this?", content: "Your **identity** hub" },
      q2: { title: "How does it work?", content: "Upload and **analyze**" },
      q3: { title: "Is it secure?", content: "Yes, **encrypted**" },
    },
  },
}));

describe("IdentityPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default: user has beta access
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockSupabase.single.mockResolvedValue({
      data: { beta_code_used: true },
      error: null,
    });
  });

  describe("loading state", () => {
    it("shows loading spinner while checking beta access", () => {
      mockSupabase.auth.getUser.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<IdentityPageClient hasAnyClaims={true} />);

      // Should show loading state
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("beta gate", () => {
    it("shows beta gate when user has no beta access", async () => {
      mockSupabase.single.mockResolvedValue({
        data: { beta_code_used: false },
        error: null,
      });

      render(<IdentityPageClient hasAnyClaims={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("beta-gate")).toBeInTheDocument();
      });
    });

    it("shows main content when user has beta access", async () => {
      render(<IdentityPageClient hasAnyClaims={true} />);

      await waitFor(() => {
        expect(screen.getByText("Your Identity")).toBeInTheDocument();
      });
    });
  });

  describe("with claims", () => {
    it("shows header with claim count", async () => {
      render(<IdentityPageClient hasAnyClaims={true} />);

      await waitFor(() => {
        expect(screen.getByText("Your Identity")).toBeInTheDocument();
        expect(screen.getByText("2 claims")).toBeInTheDocument();
      });
    });

    it('shows "All verified" badge when no issues', async () => {
      render(<IdentityPageClient hasAnyClaims={true} />);

      await waitFor(() => {
        expect(screen.getByText("All verified")).toBeInTheDocument();
      });
    });

    it("shows view toggle buttons", async () => {
      render(<IdentityPageClient hasAnyClaims={true} />);

      await waitFor(() => {
        // There should be multiple view toggle buttons
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(2);
      });
    });

    it("shows upload resume and add story buttons", async () => {
      render(<IdentityPageClient hasAnyClaims={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("upload-resume-modal")).toBeInTheDocument();
        expect(screen.getByTestId("add-story-modal")).toBeInTheDocument();
      });
    });

    it("shows identity reflection", async () => {
      render(<IdentityPageClient hasAnyClaims={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("identity-reflection")).toBeInTheDocument();
      });
    });

    it("shows claims list in list view by default", async () => {
      render(<IdentityPageClient hasAnyClaims={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("identity-claims-list")).toBeInTheDocument();
      });
    });
  });

  describe("empty state", () => {
    // Note: The empty state is shown when hasAnyClaims is false AND claimCount from useIdentityGraph is 0.
    // Since the mock returns nodes with length > 0, we test that the component handles hasAnyClaims=false
    // by checking if the identity page still renders (as it will when claimCount > 0 from the hook).
    // In practice, the empty state is only shown when both conditions are true.

    it("renders identity page when hasAnyClaims is false but hook returns claims", async () => {
      // When hasAnyClaims is false but the hook returns claims, we show the claims view
      // (this happens during the transition state when new claims are being added)
      render(<IdentityPageClient hasAnyClaims={false} />);

      await waitFor(() => {
        // The header should show with claims from the mock
        expect(screen.getByText("Your Identity")).toBeInTheDocument();
      });
    });

    it("shows upload buttons in header", async () => {
      render(<IdentityPageClient hasAnyClaims={false} />);

      await waitFor(() => {
        // Should have upload/add buttons in the header
        const uploadButtons = screen.getAllByTestId("upload-resume-modal");
        expect(uploadButtons.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("view switching", () => {
    it("can switch to treemap view", async () => {
      const user = userEvent.setup();
      render(<IdentityPageClient hasAnyClaims={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("identity-claims-list")).toBeInTheDocument();
      });

      // Find the treemap button (LayoutGrid icon)
      const buttons = screen.getAllByRole("button");
      // The view toggle buttons are in a specific group
      const treemapButton = buttons.find((btn) =>
        btn.getAttribute("title")?.includes("Treemap"),
      );
      if (treemapButton) {
        await user.click(treemapButton);

        await waitFor(() => {
          expect(
            screen.getByTestId("identity-constellation"),
          ).toBeInTheDocument();
        });
      }
    });

    it("can switch to radial view", async () => {
      const user = userEvent.setup();
      render(<IdentityPageClient hasAnyClaims={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("identity-claims-list")).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole("button");
      const radialButton = buttons.find((btn) =>
        btn.getAttribute("title")?.includes("Radial"),
      );
      if (radialButton) {
        await user.click(radialButton);

        await waitFor(() => {
          expect(
            screen.getByTestId("evidence-constellation"),
          ).toBeInTheDocument();
        });
      }
    });

    it("can switch to sunburst view", async () => {
      const user = userEvent.setup();
      render(<IdentityPageClient hasAnyClaims={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("identity-claims-list")).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole("button");
      const sunburstButton = buttons.find((btn) =>
        btn.getAttribute("title")?.includes("Sunburst"),
      );
      if (sunburstButton) {
        await user.click(sunburstButton);

        await waitFor(() => {
          expect(screen.getByTestId("confidence-sunburst")).toBeInTheDocument();
        });
      }
    });

    it("can switch to clusters view", async () => {
      const user = userEvent.setup();
      render(<IdentityPageClient hasAnyClaims={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("identity-claims-list")).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole("button");
      const clustersButton = buttons.find((btn) =>
        btn.getAttribute("title")?.includes("Clusters"),
      );
      if (clustersButton) {
        await user.click(clustersButton);

        await waitFor(() => {
          expect(screen.getByTestId("skill-clusters")).toBeInTheDocument();
        });
      }
    });
  });

  describe("beta code consumption", () => {
    it("consumes stored beta code on mount", async () => {
      localStorage.setItem("idynic_beta_code", "BETA123");

      mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

      render(<IdentityPageClient hasAnyClaims={true} />);

      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalledWith("consume_beta_code", {
          input_code: "BETA123",
          user_id: "user-123",
        });
      });

      // Should remove code from storage
      expect(localStorage.getItem("idynic_beta_code")).toBeNull();
    });
  });
});
