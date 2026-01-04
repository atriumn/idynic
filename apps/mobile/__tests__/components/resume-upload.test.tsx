import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { ResumeUpload } from "../../components/resume-upload";

import * as DocumentPicker from "expo-document-picker";
import { useDocumentJob } from "../../hooks/use-document-job";

// Mock auth
jest.mock("../../lib/auth-context", () => ({
  useAuth: () => ({
    session: { access_token: "test-token" },
    user: { id: "user-123" },
  }),
}));

// Mock useDocumentJob
jest.mock("../../hooks/use-document-job", () => ({
  useDocumentJob: jest.fn(() => ({
    job: null,
    isLoading: false,
    error: null,
    displayMessages: [],
  })),
}));

// Mock DocumentPicker
jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("ResumeUpload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it("renders upload area", () => {
    render(<ResumeUpload />);

    expect(screen.getByText("Upload your resume")).toBeTruthy();
    expect(screen.getByText(/Tap to select a PDF file/)).toBeTruthy();
  });

  it("handles document picker cancellation", async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: true,
    });

    render(<ResumeUpload />);

    fireEvent.press(screen.getByText("Upload your resume"));

    await waitFor(() => {
      expect(DocumentPicker.getDocumentAsync).toHaveBeenCalled();
    });

    // Should still show upload area
    expect(screen.getByText("Upload your resume")).toBeTruthy();
  });

  it("shows error for large files", async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        { uri: "file://test.pdf", name: "test.pdf", size: 15 * 1024 * 1024 },
      ],
    });

    render(<ResumeUpload />);

    fireEvent.press(screen.getByText("Upload your resume"));

    await waitFor(() => {
      expect(screen.getByText("File size must be less than 10MB")).toBeTruthy();
    });
  });

  it("uploads file successfully", async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file://test.pdf", name: "resume.pdf", size: 1024 }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: () => Promise.resolve({ jobId: "job-123" }),
    });

    render(<ResumeUpload />);

    fireEvent.press(screen.getByText("Upload your resume"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it("renders upload area initially", () => {
    // Default mock returns null job, so upload area should be visible
    render(<ResumeUpload />);

    expect(screen.getByText("Upload your resume")).toBeTruthy();
    expect(screen.getByText(/Max size: 10MB/)).toBeTruthy();
  });
});
