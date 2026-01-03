import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentDetailClient } from "@/components/document-detail-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock hooks
const mockUseDocument = vi.fn();
const mockUseDeleteDocument = vi.fn();

vi.mock("@/lib/hooks/use-documents", () => ({
  useDocument: (id: string) => mockUseDocument(id),
  useDeleteDocument: () => mockUseDeleteDocument(),
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockDocument = {
  id: "doc-123",
  type: "resume",
  filename: "Resume.pdf",
  status: "completed",
  created_at: "2024-01-15",
  raw_text:
    "John Doe\nSoftware Engineer\n\nEXPERIENCE\nCompany ABC\n2020 - Present\n• Led team of 5 engineers",
  evidence: [
    {
      id: "ev-1",
      text: "TypeScript",
      evidence_type: "skill_listed",
      evidence_date: "2024-01-15",
    },
    {
      id: "ev-2",
      text: "Led team of 5 engineers",
      evidence_type: "accomplishment",
      evidence_date: "2024-01-15",
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

describe("DocumentDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDocument.mockReturnValue({
      data: mockDocument,
      isLoading: false,
      error: null,
    });
    mockUseDeleteDocument.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it("renders document title", () => {
    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    expect(screen.getByText("Resume.pdf")).toBeInTheDocument();
  });

  it("renders document type badge", () => {
    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    expect(screen.getByText("Resume")).toBeInTheDocument();
  });

  it("renders document date", () => {
    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    // Date formatting may vary by timezone - multiple dates may appear (document + evidence)
    const dateElements = screen.getAllByText(/january \d+, 2024/i);
    expect(dateElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders back link to documents", () => {
    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    expect(screen.getByRole("link", { name: "" })).toHaveAttribute(
      "href",
      "/documents",
    );
  });

  it("renders document content section", () => {
    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders raw text content", () => {
    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    expect(screen.getByText(/john doe/i)).toBeInTheDocument();
  });

  it("renders evidence section", () => {
    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    expect(screen.getByText("What We Learned")).toBeInTheDocument();
  });

  it("renders evidence count badge", () => {
    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders skill evidence as tags", () => {
    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("renders accomplishment evidence", () => {
    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    // Text appears in both content and evidence - verify evidence section has accomplishment badge
    expect(screen.getByText("Accomplishment")).toBeInTheDocument();
    // Verify the evidence card contains the text (look for multiple matches)
    expect(
      screen.getAllByText("Led team of 5 engineers").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders delete button", () => {
    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("shows delete confirmation dialog", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(screen.getByText("Delete Document")).toBeInTheDocument();
    expect(
      screen.getByText(/are you sure you want to delete/i),
    ).toBeInTheDocument();
  });

  it("navigates to documents after delete", async () => {
    const mockDelete = vi.fn().mockResolvedValue({});
    mockUseDeleteDocument.mockReturnValue({
      mutateAsync: mockDelete,
      isPending: false,
    });

    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    await user.click(screen.getByRole("button", { name: /delete/i }));

    // Wait for dialog to open, then click the AlertDialogAction (Delete confirmation)
    await waitFor(() => {
      expect(screen.getByText("Delete Document")).toBeInTheDocument();
    });

    // Find and click the action button in the dialog footer
    const dialogButtons = screen.getAllByRole("button", { name: /delete/i });
    const confirmButton = dialogButtons[dialogButtons.length - 1];
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith("doc-123");
      expect(mockPush).toHaveBeenCalledWith("/documents");
    });
  });

  it("shows loading state", () => {
    mockUseDocument.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseDocument.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed"),
    });

    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    expect(screen.getByText(/failed to load document/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to documents/i }),
    ).toBeInTheDocument();
  });

  it("renders story type correctly", () => {
    mockUseDocument.mockReturnValue({
      data: { ...mockDocument, type: "story", filename: null },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    // "Story" appears twice - as display name and as type badge
    const storyTexts = screen.getAllByText("Story");
    expect(storyTexts.length).toBe(2);
  });

  it("shows empty evidence state", () => {
    mockUseDocument.mockReturnValue({
      data: { ...mockDocument, evidence: [] },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    expect(
      screen.getByText(/no evidence has been extracted/i),
    ).toBeInTheDocument();
  });

  it("shows processing message when status is processing", () => {
    mockUseDocument.mockReturnValue({
      data: { ...mockDocument, evidence: [], status: "processing" },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    expect(screen.getByText(/processing is in progress/i)).toBeInTheDocument();
  });

  it("shows no content message when raw_text is empty", () => {
    mockUseDocument.mockReturnValue({
      data: { ...mockDocument, raw_text: null },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<DocumentDetailClient documentId="doc-123" />);

    expect(screen.getByText(/no text content available/i)).toBeInTheDocument();
  });
});
