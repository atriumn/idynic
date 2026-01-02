import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddStoryModal } from "@/components/add-story-modal";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.location
Object.defineProperty(window, "location", {
  value: { href: "" },
  writable: true,
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock @tanstack/react-query
const mockRefetchQueries = vi.fn().mockResolvedValue(undefined);
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    refetchQueries: mockRefetchQueries,
  }),
}));

// Mock useDocumentJob hook
const mockJob = vi.fn();
vi.mock("@/lib/hooks/use-document-job", () => ({
  useDocumentJob: (jobId: string | null) => mockJob(jobId),
}));

// Mock useOnboardingProgress hook
const mockGetPrompt = vi.fn();
const mockDismissPrompt = vi.fn();
vi.mock("@idynic/shared", async () => {
  const actual = await vi.importActual("@idynic/shared");
  return {
    ...actual,
    useOnboardingProgress: () => ({
      getPrompt: mockGetPrompt,
      dismissPrompt: mockDismissPrompt,
      isLoading: false,
    }),
  };
});

// Mock storage adapter
vi.mock("@/lib/storage-adapter", () => ({
  webStorageAdapter: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("AddStoryModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobId: "job-123" }),
    });
    mockJob.mockReturnValue({
      job: null,
      displayMessages: [],
    });
    mockGetPrompt.mockReturnValue(null);
    window.location.href = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders trigger button", () => {
    render(<AddStoryModal />);
    expect(
      screen.getByRole("button", { name: /add story/i }),
    ).toBeInTheDocument();
  });

  it("opens dialog when trigger is clicked", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<AddStoryModal />);

    await user.click(screen.getByRole("button", { name: /add story/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/share a story/i)).toBeInTheDocument();
  });

  it("shows character count", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<AddStoryModal />);

    await user.click(screen.getByRole("button", { name: /add story/i }));

    expect(screen.getByText("0/200 min characters")).toBeInTheDocument();
  });

  it("disables submit button when text is too short", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<AddStoryModal />);

    await user.click(screen.getByRole("button", { name: /add story/i }));

    const submitButton = screen.getByRole("button", { name: /submit story/i });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit button when text meets minimum length", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<AddStoryModal />);

    await user.click(screen.getByRole("button", { name: /add story/i }));

    const textarea = screen.getByPlaceholderText(/share a story/i);
    await user.type(textarea, "a".repeat(200));

    const submitButton = screen.getByRole("button", { name: /submit story/i });
    expect(submitButton).toBeEnabled();
  });

  it("submits story and gets jobId", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<AddStoryModal />);

    await user.click(screen.getByRole("button", { name: /add story/i }));

    const textarea = screen.getByPlaceholderText(/share a story/i);
    await user.type(textarea, "a".repeat(200));

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/process-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "a".repeat(200) }),
      });
    });
  });

  it("shows error on submission failure", async () => {
    vi.useRealTimers();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Submission failed" }),
    });

    const user = userEvent.setup();
    render(<AddStoryModal />);

    await user.click(screen.getByRole("button", { name: /add story/i }));

    const textarea = screen.getByPlaceholderText(/share a story/i);
    await user.type(textarea, "a".repeat(200));

    await user.click(screen.getByRole("button", { name: /submit story/i }));

    await waitFor(() => {
      expect(screen.getByText("Submission failed")).toBeInTheDocument();
    });
  });

  it("closes dialog when cancel is clicked", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<AddStoryModal />);

    await user.click(screen.getByRole("button", { name: /add story/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("onboarding prompt actions", () => {
    it("shows onboarding prompt after job completion", async () => {
      // Setup: return completed job only when jobId is set
      mockJob.mockImplementation((jobId: string | null) => {
        if (jobId === "job-123") {
          return {
            job: {
              status: "completed",
              summary: { claimsCreated: 1, claimsUpdated: 0 },
            },
            displayMessages: [],
          };
        }
        return { job: null, displayMessages: [] };
      });
      mockGetPrompt.mockReturnValue({
        title: "Story added!",
        message: "Your claims are getting stronger.",
        primaryAction: {
          label: "Add Another Story",
          route: null,
          action: "add_story",
        },
        secondaryAction: {
          label: "Upload Resume",
          route: null,
          action: "upload_resume",
        },
      });

      vi.useRealTimers();
      const user = userEvent.setup();
      render(<AddStoryModal />);

      // Open modal and wait for it to appear
      await user.click(screen.getByRole("button", { name: /add story/i }));
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Submit the story
      const textarea = screen.getByPlaceholderText(/share a story/i);
      await user.type(textarea, "a".repeat(200));
      await user.click(screen.getByRole("button", { name: /submit story/i }));

      // Wait for the completion flow
      await waitFor(
        () => {
          expect(screen.getByText("Story added!")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("navigates to /identity when upload_resume action is triggered", async () => {
      // Setup: return completed job only when jobId is set
      mockJob.mockImplementation((jobId: string | null) => {
        if (jobId === "job-123") {
          return {
            job: {
              status: "completed",
              summary: { claimsCreated: 1, claimsUpdated: 0 },
            },
            displayMessages: [],
          };
        }
        return { job: null, displayMessages: [] };
      });
      mockGetPrompt.mockReturnValue({
        title: "Story added!",
        message: "Your claims are getting stronger.",
        primaryAction: {
          label: "Add Another Story",
          route: null,
          action: "add_story",
        },
        secondaryAction: {
          label: "Upload Resume",
          route: null,
          action: "upload_resume",
        },
      });

      vi.useRealTimers();
      const user = userEvent.setup();
      render(<AddStoryModal />);

      // Open modal and wait for it to appear
      await user.click(screen.getByRole("button", { name: /add story/i }));
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Submit the story
      const textarea = screen.getByPlaceholderText(/share a story/i);
      await user.type(textarea, "a".repeat(200));
      await user.click(screen.getByRole("button", { name: /submit story/i }));

      // Wait for onboarding prompt to appear
      await waitFor(
        () => {
          expect(screen.getByText("Story added!")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      // Click "Upload Resume" button
      await user.click(screen.getByRole("button", { name: /upload resume/i }));

      // Should navigate to /identity
      expect(window.location.href).toBe("/identity");
    });
  });

  describe("processing states", () => {
    it("shows processing state when job is in progress", async () => {
      vi.useRealTimers();
      mockJob.mockReturnValue({
        job: { status: "processing", phase: "extracting" },
        displayMessages: [],
      });

      const user = userEvent.setup();
      render(<AddStoryModal />);

      await user.click(screen.getByRole("button", { name: /add story/i }));
      const textarea = screen.getByPlaceholderText(/share a story/i);
      await user.type(textarea, "a".repeat(200));
      await user.click(screen.getByRole("button", { name: /submit story/i }));

      await waitFor(() => {
        expect(screen.getByText(/processing story/i)).toBeInTheDocument();
      });
    });

    it("shows error state when job fails", async () => {
      vi.useRealTimers();
      mockJob.mockReturnValue({
        job: { status: "failed", error: "Processing error" },
        displayMessages: [],
      });

      const user = userEvent.setup();
      render(<AddStoryModal />);

      await user.click(screen.getByRole("button", { name: /add story/i }));
      const textarea = screen.getByPlaceholderText(/share a story/i);
      await user.type(textarea, "a".repeat(200));
      await user.click(screen.getByRole("button", { name: /submit story/i }));

      await waitFor(() => {
        expect(screen.getByText("Processing error")).toBeInTheDocument();
      });
    });
  });
});
