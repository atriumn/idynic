import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoryInput } from "@/components/story-input";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock hooks
const mockUseDocumentJob = vi.fn();
vi.mock("@/lib/hooks/use-document-job", () => ({
  useDocumentJob: (jobId: string | null) => mockUseDocumentJob(jobId),
}));

vi.mock("@idynic/shared/types", () => ({
  STORY_PHASES: ["parsing", "extracting", "synthesizing"],
  PHASE_LABELS: {
    parsing: "Parsing story",
    extracting: "Extracting claims",
    synthesizing: "Synthesizing identity",
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock router
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("StoryInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDocumentJob.mockReturnValue({
      job: null,
      displayMessages: [],
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobId: "job-123" }),
    });
  });

  it("renders textarea", () => {
    renderWithQueryClient(<StoryInput />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders placeholder text", () => {
    renderWithQueryClient(<StoryInput />);

    expect(screen.getByPlaceholderText(/share a story/i)).toBeInTheDocument();
  });

  it("renders submit button", () => {
    renderWithQueryClient(<StoryInput />);

    expect(
      screen.getByRole("button", { name: /submit story/i }),
    ).toBeInTheDocument();
  });

  it("shows character count", () => {
    renderWithQueryClient(<StoryInput />);

    expect(screen.getByText("0/200 min characters")).toBeInTheDocument();
  });

  it("updates character count as user types", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<StoryInput />);

    await user.type(screen.getByRole("textbox"), "Hello");

    expect(screen.getByText("5/200 min characters")).toBeInTheDocument();
  });

  it("disables submit button when text is too short", () => {
    renderWithQueryClient(<StoryInput />);

    expect(
      screen.getByRole("button", { name: /submit story/i }),
    ).toBeDisabled();
  });

  it("enables submit button when text meets minimum length", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<StoryInput />);

    // Type 200+ characters
    const longText = "a".repeat(200);
    await user.type(screen.getByRole("textbox"), longText);

    expect(screen.getByRole("button", { name: /submit story/i })).toBeEnabled();
  });

  it("submits story to API", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<StoryInput />);

    const longText = "a".repeat(200);
    await user.type(screen.getByRole("textbox"), longText);
    await user.click(screen.getByRole("button", { name: /submit story/i }));

    expect(mockFetch).toHaveBeenCalledWith("/api/process-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: longText }),
    });
  });

  it("shows error when submission fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    const user = userEvent.setup();
    renderWithQueryClient(<StoryInput />);

    const longText = "a".repeat(200);
    await user.type(screen.getByRole("textbox"), longText);
    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("shows processing phases when job is in progress", () => {
    mockUseDocumentJob.mockReturnValue({
      job: { status: "processing", phase: "extracting" },
      displayMessages: [],
    });

    renderWithQueryClient(<StoryInput />);

    expect(screen.getByText("Parsing story")).toBeInTheDocument();
    expect(screen.getByText("Extracting claims")).toBeInTheDocument();
    expect(screen.getByText("Synthesizing identity")).toBeInTheDocument();
  });

  it("shows completed checkmarks for completed phases", () => {
    mockUseDocumentJob.mockReturnValue({
      job: { status: "processing", phase: "synthesizing" },
      displayMessages: [],
    });

    renderWithQueryClient(<StoryInput />);

    // Check for checkmark symbols (✓) for completed phases
    const checkmarks = screen.getAllByText("✓");
    expect(checkmarks.length).toBeGreaterThan(0);
  });

  it("shows success message when completed", () => {
    mockUseDocumentJob.mockReturnValue({
      job: {
        status: "completed",
        summary: { claimsCreated: 5, claimsUpdated: 2 },
      },
      displayMessages: [],
    });

    renderWithQueryClient(<StoryInput />);

    expect(screen.getByText("Processing complete!")).toBeInTheDocument();
    expect(screen.getByText(/\+5 new claims/)).toBeInTheDocument();
  });

  it("shows display messages during processing", () => {
    mockUseDocumentJob.mockReturnValue({
      job: { status: "processing", phase: "extracting" },
      displayMessages: [
        { id: "1", text: "Found leadership experience" },
        { id: "2", text: "Identified TypeScript skill" },
      ],
    });

    renderWithQueryClient(<StoryInput />);

    expect(screen.getByText("Found leadership experience")).toBeInTheDocument();
    expect(screen.getByText("Identified TypeScript skill")).toBeInTheDocument();
  });

  it("shows warning message when present", () => {
    mockUseDocumentJob.mockReturnValue({
      job: {
        status: "completed",
        warning: "Some claims could not be verified",
        summary: { claimsCreated: 1, claimsUpdated: 0 },
      },
      displayMessages: [],
    });

    renderWithQueryClient(<StoryInput />);

    expect(
      screen.getByText("Some claims could not be verified"),
    ).toBeInTheDocument();
  });

  it("calls onSubmitComplete when job completes", async () => {
    const onSubmitComplete = vi.fn();
    mockUseDocumentJob.mockReturnValue({
      job: {
        status: "completed",
        summary: { claimsCreated: 1, claimsUpdated: 0 },
      },
      displayMessages: [],
    });

    renderWithQueryClient(<StoryInput onSubmitComplete={onSubmitComplete} />);

    await waitFor(() => {
      expect(onSubmitComplete).toHaveBeenCalled();
    });
  });
});
