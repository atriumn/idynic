import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { StoryInput } from "../../components/story-input";

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

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("StoryInput", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it("renders input area", () => {
    render(<StoryInput />);

    expect(screen.getByPlaceholderText(/Share a story/)).toBeTruthy();
    expect(screen.getByText("Submit Story")).toBeTruthy();
  });

  it("shows character count", () => {
    render(<StoryInput />);

    expect(screen.getByText("0/200 min characters")).toBeTruthy();
  });

  it("updates character count as user types", () => {
    render(<StoryInput />);

    const input = screen.getByPlaceholderText(/Share a story/);
    fireEvent.changeText(input, "Hello");

    expect(screen.getByText("5/200 min characters")).toBeTruthy();
  });

  it("disables submit when text is too short", () => {
    render(<StoryInput />);

    const input = screen.getByPlaceholderText(/Share a story/);
    fireEvent.changeText(input, "Short text");

    // Submit button should still be rendered but pressing should not call fetch
    fireEvent.press(screen.getByText("Submit Story"));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("submits story when text is long enough", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: "job-123" }),
    });

    render(<StoryInput />);

    const input = screen.getByPlaceholderText(/Share a story/);
    // Type 200+ characters
    const longText = "a".repeat(250);
    fireEvent.changeText(input, longText);

    fireEvent.press(screen.getByText("Submit Story"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/process-story"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ text: longText }),
        }),
      );
    });
  });

  it("shows error on submission failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Submission failed" }),
    });

    render(<StoryInput />);

    const input = screen.getByPlaceholderText(/Share a story/);
    fireEvent.changeText(input, "a".repeat(250));
    fireEvent.press(screen.getByText("Submit Story"));

    await waitFor(() => {
      expect(screen.getByText("Submission failed")).toBeTruthy();
    });
  });

  it("renders initial input state correctly", () => {
    // Default mock returns null job, so input should be visible
    render(<StoryInput />);

    expect(screen.getByPlaceholderText(/Share a story/)).toBeTruthy();
    expect(screen.getByText("Submit Story")).toBeTruthy();
  });
});
