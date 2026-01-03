import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentsPageClient } from "@/components/documents-page-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock hooks
const mockUseDocuments = vi.fn();
const mockUseDeleteDocument = vi.fn();

vi.mock("@/lib/hooks/use-documents", () => ({
  useDocuments: () => mockUseDocuments(),
  useDeleteDocument: () => mockUseDeleteDocument(),
}));

// Mock child components
vi.mock("@/components/upload-resume-modal", () => ({
  UploadResumeModal: () => <button>Upload Resume</button>,
}));

vi.mock("@/components/add-story-modal", () => ({
  AddStoryModal: () => <button>Add Story</button>,
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

const mockDocuments = [
  {
    id: "doc-1",
    type: "resume",
    filename: "Resume.pdf",
    status: "completed",
    created_at: "2024-01-15",
    evidence_count: 5,
  },
  {
    id: "doc-2",
    type: "story",
    filename: null,
    status: "processing",
    created_at: "2024-01-20",
    evidence_count: 0,
  },
];

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("DocumentsPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDocuments.mockReturnValue({
      data: mockDocuments,
      isLoading: false,
      error: null,
    });
    mockUseDeleteDocument.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it("renders page title", () => {
    renderWithQueryClient(<DocumentsPageClient />);

    expect(screen.getByText("My Documents")).toBeInTheDocument();
  });

  it("renders document count badge", () => {
    renderWithQueryClient(<DocumentsPageClient />);

    expect(screen.getByText("2 documents")).toBeInTheDocument();
  });

  it("renders upload buttons", () => {
    renderWithQueryClient(<DocumentsPageClient />);

    expect(screen.getByText("Upload Resume")).toBeInTheDocument();
    expect(screen.getByText("Add Story")).toBeInTheDocument();
  });

  it("renders back link to identity", () => {
    renderWithQueryClient(<DocumentsPageClient />);

    expect(screen.getByRole("link", { name: "" })).toHaveAttribute(
      "href",
      "/identity",
    );
  });

  it("renders document rows", () => {
    renderWithQueryClient(<DocumentsPageClient />);

    expect(screen.getByText("Resume.pdf")).toBeInTheDocument();
    // "Story" appears twice for the story document - as display name and as type badge
    const storyTexts = screen.getAllByText("Story");
    expect(storyTexts.length).toBe(2);
  });

  it("shows resume type badge", () => {
    renderWithQueryClient(<DocumentsPageClient />);

    expect(screen.getByText("Resume")).toBeInTheDocument();
  });

  it("shows processing status badge", () => {
    renderWithQueryClient(<DocumentsPageClient />);

    expect(screen.getByText("Processing")).toBeInTheDocument();
  });

  it("shows evidence count", () => {
    renderWithQueryClient(<DocumentsPageClient />);

    expect(screen.getByText("5 evidence")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseDocuments.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithQueryClient(<DocumentsPageClient />);

    // Should show loading spinner (animate-spin class)
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseDocuments.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed"),
    });

    renderWithQueryClient(<DocumentsPageClient />);

    expect(screen.getByText(/failed to load documents/i)).toBeInTheDocument();
  });

  it("shows empty state", () => {
    mockUseDocuments.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<DocumentsPageClient />);

    expect(screen.getByText("No documents yet")).toBeInTheDocument();
    expect(
      screen.getByText(/upload a resume or add a story/i),
    ).toBeInTheDocument();
  });

  it("links to document detail page", () => {
    renderWithQueryClient(<DocumentsPageClient />);

    const resumeLink = screen.getByRole("link", { name: "Resume.pdf" });
    expect(resumeLink).toHaveAttribute("href", "/documents/doc-1");
  });

  it("shows delete confirmation dialog", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<DocumentsPageClient />);

    // Find and click delete button (trash icon)
    const deleteButtons = screen.getAllByRole("button");
    const trashButton = deleteButtons.find((btn) =>
      btn.querySelector(".lucide-trash-2"),
    );
    await user.click(trashButton!);

    expect(screen.getByText("Delete Document")).toBeInTheDocument();
    expect(
      screen.getByText(/are you sure you want to delete/i),
    ).toBeInTheDocument();
  });

  it("calls delete mutation when confirmed", async () => {
    const mockDelete = vi.fn().mockResolvedValue({});
    mockUseDeleteDocument.mockReturnValue({
      mutateAsync: mockDelete,
      isPending: false,
    });

    const user = userEvent.setup();
    renderWithQueryClient(<DocumentsPageClient />);

    // Open delete dialog
    const deleteButtons = screen.getAllByRole("button");
    const trashButton = deleteButtons.find((btn) =>
      btn.querySelector(".lucide-trash-2"),
    );
    await user.click(trashButton!);

    // Confirm delete
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith("doc-1");
    });
  });

  it("shows failed status badge", () => {
    mockUseDocuments.mockReturnValue({
      data: [
        {
          id: "doc-3",
          type: "resume",
          filename: "Failed.pdf",
          status: "failed",
          created_at: "2024-01-25",
          evidence_count: 0,
        },
      ],
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<DocumentsPageClient />);

    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
