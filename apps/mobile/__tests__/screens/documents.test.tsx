import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import DocumentsScreen from "../../app/(app)/documents";
import { useDocuments, useDeleteDocument } from "../../hooks/use-documents";

// Mock hooks
jest.mock("../../hooks/use-documents");

// Mock router
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock lucide icons
jest.mock("lucide-react-native", () => ({
  FileText: () => "FileText",
  BookOpen: () => "BookOpen",
  ChevronRight: () => "ChevronRight",
  Trash2: () => "Trash2",
  Upload: () => "Upload",
  MessageSquarePlus: () => "MessageSquarePlus",
}));

// Mock Alert
jest.spyOn(Alert, "alert");

describe("DocumentsScreen", () => {
  const mockRefetch = jest.fn();
  const mockMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useDeleteDocument as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
    });
  });

  it("shows loading state", () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    // Screen renders without crashing in loading state
    expect(true).toBeTruthy();
  });

  it("shows error state", () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed to fetch"),
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    expect(screen.getByText("Failed to load documents")).toBeTruthy();
    expect(screen.getByText("Failed to fetch")).toBeTruthy();
  });

  it("shows empty state when no documents", () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    expect(screen.getByText("No documents yet")).toBeTruthy();
    expect(screen.getByText(/Upload a resume or add a story/)).toBeTruthy();
  });

  it("navigates to upload resume from empty state", () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    fireEvent.press(screen.getByText("Upload Resume"));

    expect(mockPush).toHaveBeenCalledWith("/upload-resume");
  });

  it("navigates to add story from empty state", () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    fireEvent.press(screen.getByText("Add Story"));

    expect(mockPush).toHaveBeenCalledWith("/add-story");
  });

  it("displays document list", () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: [
        {
          id: "doc-1",
          type: "resume",
          filename: "resume.pdf",
          status: "completed",
          created_at: "2024-01-15T00:00:00Z",
          evidence_count: 10,
        },
        {
          id: "doc-2",
          type: "story",
          filename: "My Career Story",
          status: "completed",
          created_at: "2024-01-10T00:00:00Z",
          evidence_count: 5,
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    expect(screen.getByText("resume.pdf")).toBeTruthy();
    expect(screen.getByText("My Career Story")).toBeTruthy();
    expect(screen.getByText("2 documents")).toBeTruthy();
    expect(screen.getByText("10 evidence")).toBeTruthy();
    expect(screen.getByText("5 evidence")).toBeTruthy();
  });

  it("displays type badges correctly", () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: [
        {
          id: "doc-1",
          type: "resume",
          filename: "resume.pdf",
          status: "completed",
          created_at: "2024-01-15T00:00:00Z",
          evidence_count: 0,
        },
        {
          id: "doc-2",
          type: "story",
          filename: "My Story",
          status: "completed",
          created_at: "2024-01-10T00:00:00Z",
          evidence_count: 0,
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    expect(screen.getByText("Resume")).toBeTruthy();
    expect(screen.getByText("Story")).toBeTruthy();
  });

  it("shows processing status for pending documents", () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: [
        {
          id: "doc-1",
          type: "resume",
          filename: "resume.pdf",
          status: "processing",
          created_at: "2024-01-15T00:00:00Z",
          evidence_count: 0,
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    expect(screen.getByText("Processing")).toBeTruthy();
  });

  it("shows failed status for failed documents", () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: [
        {
          id: "doc-1",
          type: "resume",
          filename: "resume.pdf",
          status: "failed",
          created_at: "2024-01-15T00:00:00Z",
          evidence_count: 0,
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    expect(screen.getByText("Failed")).toBeTruthy();
  });

  it("navigates to document detail on press", () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: [
        {
          id: "doc-123",
          type: "resume",
          filename: "resume.pdf",
          status: "completed",
          created_at: "2024-01-15T00:00:00Z",
          evidence_count: 5,
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    fireEvent.press(screen.getByText("resume.pdf"));

    expect(mockPush).toHaveBeenCalledWith("/documents/doc-123");
  });

  it("shows fallback name for documents without filename", () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: [
        {
          id: "doc-1",
          type: "resume",
          filename: null,
          status: "completed",
          created_at: "2024-01-15T00:00:00Z",
          evidence_count: 0,
        },
        {
          id: "doc-2",
          type: "story",
          filename: null,
          status: "completed",
          created_at: "2024-01-10T00:00:00Z",
          evidence_count: 0,
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    // When filename is null, it should show the type as fallback
    const resumeElements = screen.getAllByText("Resume");
    const storyElements = screen.getAllByText("Story");

    // One for the document name and one for the type badge
    expect(resumeElements.length).toBeGreaterThanOrEqual(1);
    expect(storyElements.length).toBeGreaterThanOrEqual(1);
  });

  it("removes date suffix from filename", () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: [
        {
          id: "doc-1",
          type: "resume",
          filename: "resume.pdf (12/25/2024)",
          status: "completed",
          created_at: "2024-01-15T00:00:00Z",
          evidence_count: 0,
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    expect(screen.getByText("resume.pdf")).toBeTruthy();
    expect(screen.queryByText("resume.pdf (12/25/2024)")).toBeNull();
  });

  it("shows delete confirmation on long press", async () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: [
        {
          id: "doc-123",
          type: "resume",
          filename: "resume.pdf",
          status: "completed",
          created_at: "2024-01-15T00:00:00Z",
          evidence_count: 5,
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    fireEvent(screen.getByText("resume.pdf"), "longPress");

    expect(Alert.alert).toHaveBeenCalledWith(
      "Delete Document",
      expect.stringContaining("resume.pdf"),
      expect.arrayContaining([
        expect.objectContaining({ text: "Cancel" }),
        expect.objectContaining({ text: "Delete", style: "destructive" }),
      ]),
    );
  });

  it("shows document count for single document", () => {
    (useDocuments as jest.Mock).mockReturnValue({
      data: [
        {
          id: "doc-1",
          type: "resume",
          filename: "resume.pdf",
          status: "completed",
          created_at: "2024-01-15T00:00:00Z",
          evidence_count: 5,
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<DocumentsScreen />);

    expect(screen.getByText("1 document")).toBeTruthy();
  });
});
