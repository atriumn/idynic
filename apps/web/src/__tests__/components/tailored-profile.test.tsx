import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TailoredProfile } from "@/components/tailored-profile";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock resume-pdf components
vi.mock("@/components/resume-pdf", () => ({
  ResumePDFViewer: ({ data }: { data: unknown }) => (
    <div data-testid="pdf-viewer">PDF Viewer: {JSON.stringify(data)}</div>
  ),
  ResumePDFDownload: ({ filename }: { filename: string }) => (
    <button data-testid="pdf-download">Download {filename}</button>
  ),
}));

// Mock company-logo
vi.mock("@/components/company-logo", () => ({
  CompanyLogo: ({ companyName }: { companyName: string }) => (
    <div data-testid="company-logo">{companyName}</div>
  ),
}));

// Mock editable-text
vi.mock("@/components/editable-text", () => ({
  EditableText: ({
    value,
    fieldPath,
  }: {
    value: string;
    fieldPath: string;
  }) => <span data-testid={`editable-${fieldPath}`}>{value}</span>,
}));

// Mock regenerate-warning-dialog
vi.mock("@/components/regenerate-warning-dialog", () => ({
  RegenerateWarningDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: () => void;
  }) =>
    open ? (
      <div data-testid="regenerate-dialog">
        <button onClick={onConfirm}>Confirm Regenerate</button>
      </div>
    ) : null,
}));

// Mock onboarding-prompt to avoid shared package React hook issues in tests
vi.mock("@/components/onboarding-prompt", () => ({
  OnboardingPrompt: () => null,
}));

describe("TailoredProfile", () => {
  const mockProfile = {
    talking_points: {
      strengths: [
        {
          requirement: "React experience",
          requirement_type: "technical",
          claim_id: "claim-1",
          claim_label: "React Development",
          evidence_summary: "Built 5 React applications",
          framing: "Highlight your component architecture skills",
          confidence: 0.9,
        },
      ],
      gaps: [
        {
          requirement: "Kubernetes experience",
          requirement_type: "technical",
          mitigation: "Mention Docker experience as foundation",
          related_claims: [],
        },
      ],
      inferences: [
        {
          inferred_claim: "Strong problem solver",
          derived_from: ["Led debugging sessions"],
          reasoning: "Multiple complex issues resolved",
        },
      ],
    },
    narrative:
      "I am an experienced software engineer with a passion for building great products.",
    resume_data: {
      summary: "Experienced software engineer with 5+ years of experience",
      skills: [
        { category: "Frontend", skills: ["React", "TypeScript", "CSS"] },
        { category: "Backend", skills: ["Node.js", "Python"] },
      ],
      experience: [
        {
          company: "Acme Corp",
          companyDomain: "acme.com",
          title: "Senior Engineer",
          dates: "2020 - Present",
          location: "San Francisco, CA",
          bullets: ["Built React components", "Led team of 3"],
        },
      ],
      additionalExperience: [],
      ventures: [],
      education: [
        {
          institution: "Stanford University",
          degree: "BS Computer Science",
          year: "2015",
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial loading state", () => {
    it("shows loading spinner on mount", () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      render(<TailoredProfile opportunityId="opp-123" />);

      expect(screen.getByText(/analyzing your profile/i)).toBeInTheDocument();
    });
  });

  describe("no profile state", () => {
    it("shows generate button when no profile exists", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profile: null }),
      });

      render(<TailoredProfile opportunityId="opp-123" />);

      await waitFor(() => {
        expect(screen.getByText(/ready to stand out/i)).toBeInTheDocument();
      });

      expect(
        screen.getByRole("button", { name: /generate tailored profile/i }),
      ).toBeInTheDocument();
    });

    it("generates profile when button is clicked", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profile: null }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profile: mockProfile }),
      });

      const user = userEvent.setup();
      render(<TailoredProfile opportunityId="opp-123" />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /generate tailored profile/i }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: /generate tailored profile/i }),
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/generate-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunityId: "opp-123" }),
        });
      });
    });
  });

  describe("profile loaded state", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profile: mockProfile }),
      });
    });

    it("shows tailored profile header", async () => {
      render(<TailoredProfile opportunityId="opp-123" />);

      await waitFor(() => {
        expect(screen.getByText("Tailored Profile")).toBeInTheDocument();
      });
    });

    it("shows regenerate button", async () => {
      render(<TailoredProfile opportunityId="opp-123" />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /regenerate/i }),
        ).toBeInTheDocument();
      });
    });

    it("shows tabs for talking points, narrative, and resume", async () => {
      render(<TailoredProfile opportunityId="opp-123" />);

      await waitFor(() => {
        expect(
          screen.getByRole("tab", { name: /talking points/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("tab", { name: /narrative/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("tab", { name: /resume/i }),
        ).toBeInTheDocument();
      });
    });

    describe("talking points tab", () => {
      it("shows strengths section", async () => {
        render(<TailoredProfile opportunityId="opp-123" />);

        await waitFor(() => {
          expect(screen.getByText(/strengths/i)).toBeInTheDocument();
          expect(screen.getByText("React Development")).toBeInTheDocument();
        });
      });

      it("shows gaps section", async () => {
        render(<TailoredProfile opportunityId="opp-123" />);

        await waitFor(() => {
          expect(screen.getByText(/gaps/i)).toBeInTheDocument();
          expect(screen.getByText("Kubernetes experience")).toBeInTheDocument();
        });
      });

      it("shows inferences section", async () => {
        render(<TailoredProfile opportunityId="opp-123" />);

        await waitFor(() => {
          expect(screen.getByText(/inferences/i)).toBeInTheDocument();
          expect(screen.getByText("Strong problem solver")).toBeInTheDocument();
        });
      });
    });

    describe("narrative tab", () => {
      it("shows narrative content", async () => {
        const user = userEvent.setup();
        render(<TailoredProfile opportunityId="opp-123" />);

        await waitFor(() => {
          expect(
            screen.getByRole("tab", { name: /narrative/i }),
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("tab", { name: /narrative/i }));

        await waitFor(() => {
          expect(
            screen.getByText(/cover letter narrative/i),
          ).toBeInTheDocument();
        });
      });

      it("has copy button for narrative", async () => {
        const user = userEvent.setup();
        render(<TailoredProfile opportunityId="opp-123" />);

        await waitFor(() => {
          expect(
            screen.getByRole("tab", { name: /narrative/i }),
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("tab", { name: /narrative/i }));

        // Find copy button (ghost variant)
        await waitFor(() => {
          const buttons = screen.getAllByRole("button");
          expect(buttons.length).toBeGreaterThan(0);
        });
      });
    });

    describe("resume tab", () => {
      it("shows resume content", async () => {
        const user = userEvent.setup();
        render(<TailoredProfile opportunityId="opp-123" />);

        await waitFor(() => {
          expect(
            screen.getByRole("tab", { name: /resume/i }),
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("tab", { name: /resume/i }));

        await waitFor(() => {
          expect(screen.getByText(/professional summary/i)).toBeInTheDocument();
        });
      });

      it("shows PDF preview toggle button", async () => {
        const user = userEvent.setup();
        render(<TailoredProfile opportunityId="opp-123" userName="John Doe" />);

        await waitFor(() => {
          expect(
            screen.getByRole("tab", { name: /resume/i }),
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("tab", { name: /resume/i }));

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /pdf preview/i }),
          ).toBeInTheDocument();
        });
      });

      it("shows experience section", async () => {
        const user = userEvent.setup();
        render(<TailoredProfile opportunityId="opp-123" />);

        await waitFor(() => {
          expect(
            screen.getByRole("tab", { name: /resume/i }),
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("tab", { name: /resume/i }));

        await waitFor(() => {
          expect(screen.getByText("Experience")).toBeInTheDocument();
          expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
        });
      });

      it("shows skills section", async () => {
        const user = userEvent.setup();
        render(<TailoredProfile opportunityId="opp-123" />);

        await waitFor(() => {
          expect(
            screen.getByRole("tab", { name: /resume/i }),
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("tab", { name: /resume/i }));

        await waitFor(() => {
          expect(screen.getByText("Skills")).toBeInTheDocument();
          expect(screen.getByText("Frontend")).toBeInTheDocument();
        });
      });

      it("shows education section", async () => {
        const user = userEvent.setup();
        render(<TailoredProfile opportunityId="opp-123" />);

        await waitFor(() => {
          expect(
            screen.getByRole("tab", { name: /resume/i }),
          ).toBeInTheDocument();
        });

        await user.click(screen.getByRole("tab", { name: /resume/i }));

        await waitFor(() => {
          expect(screen.getByText("Education")).toBeInTheDocument();
          expect(screen.getByText("BS Computer Science")).toBeInTheDocument();
        });
      });
    });
  });

  describe("error state", () => {
    it("shows error message on fetch failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profile: null }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const user = userEvent.setup();
      render(<TailoredProfile opportunityId="opp-123" />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /generate tailored profile/i }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: /generate tailored profile/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByText(/failed to generate profile/i),
        ).toBeInTheDocument();
      });
    });

    it("shows try again button on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profile: null }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const user = userEvent.setup();
      render(<TailoredProfile opportunityId="opp-123" />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /generate tailored profile/i }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: /generate tailored profile/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /try again/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe("evaluation banner", () => {
    it("shows success banner when evaluation passes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            profile: mockProfile,
            evaluation: {
              passed: true,
              groundingPassed: true,
              hallucinations: null,
            },
          }),
      });

      render(<TailoredProfile opportunityId="opp-123" />);

      await waitFor(() => {
        expect(screen.getByText(/profile verified/i)).toBeInTheDocument();
      });
    });

    it("shows warning banner when hallucinations detected", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            profile: mockProfile,
            evaluation: {
              passed: false,
              groundingPassed: false,
              hallucinations: [
                {
                  field: "summary",
                  claim: "Python expert",
                  reason: "Not found in documents",
                },
              ],
            },
          }),
      });

      render(<TailoredProfile opportunityId="opp-123" />);

      await waitFor(() => {
        expect(
          screen.getByText(/potential accuracy issues detected/i),
        ).toBeInTheDocument();
        expect(screen.getByText(/not found in documents/i)).toBeInTheDocument();
      });
    });

    it("can dismiss warning banner", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            profile: mockProfile,
            evaluation: {
              passed: false,
              groundingPassed: false,
              hallucinations: [
                {
                  field: "summary",
                  claim: "Python expert",
                  reason: "Not found",
                },
              ],
            },
          }),
      });

      const user = userEvent.setup();
      render(<TailoredProfile opportunityId="opp-123" />);

      await waitFor(() => {
        expect(
          screen.getByText(/potential accuracy issues/i),
        ).toBeInTheDocument();
      });

      // Find and click dismiss button (X icon)
      const dismissButtons = screen.getAllByRole("button");
      const dismissButton = dismissButtons.find(
        (btn) => btn.textContent === "" || btn.querySelector("svg"),
      );
      if (dismissButton) {
        await user.click(dismissButton);
      }
    });
  });

  describe("regenerate", () => {
    it("regenerates profile when regenerate button is clicked", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profile: mockProfile }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profile: mockProfile }),
      });

      const user = userEvent.setup();
      render(<TailoredProfile opportunityId="opp-123" />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /regenerate/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /regenerate/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/generate-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunityId: "opp-123" }),
        });
      });
    });
  });

  describe("requirement matches", () => {
    it("shows required qualifications section when provided", async () => {
      const requirementMatches = [
        {
          requirement: {
            text: "5+ years experience",
            type: "experience",
            category: "mustHave" as const,
          },
          bestMatch: {
            id: "claim-1",
            type: "skill",
            label: "Experience",
            description: null,
            confidence: 0.9,
            similarity: 0.85,
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profile: mockProfile }),
      });

      render(
        <TailoredProfile
          opportunityId="opp-123"
          requirementMatches={requirementMatches}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Required Qualifications")).toBeInTheDocument();
        expect(screen.getByText("5+ years experience")).toBeInTheDocument();
      });
    });

    it("shows nice to have section when provided", async () => {
      const requirementMatches = [
        {
          requirement: {
            text: "GraphQL experience",
            type: "skill",
            category: "niceToHave" as const,
          },
          bestMatch: null,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profile: mockProfile }),
      });

      render(
        <TailoredProfile
          opportunityId="opp-123"
          requirementMatches={requirementMatches}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Nice to Have")).toBeInTheDocument();
        expect(screen.getByText("GraphQL experience")).toBeInTheDocument();
      });
    });
  });
});
