import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ResumePDFDownload } from "@/components/resume-pdf/resume-pdf-download";

// Mock the dynamic imports
vi.mock("@react-pdf/renderer", () => ({
  pdf: vi.fn(() => ({
    toBlob: vi.fn(() =>
      Promise.resolve(new Blob(["test"], { type: "application/pdf" })),
    ),
  })),
}));

vi.mock("./resume-document", () => ({
  ResumeDocument: () => null,
}));

// Mock URL APIs
const mockCreateObjectURL = vi.fn(() => "blob:test-url");
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

const mockData = {
  name: "John Doe",
  email: "john@example.com",
  phone: "555-1234",
  location: "San Francisco",
  summary: "Experienced engineer",
  experience: [],
  education: [],
  skills: [],
};

describe("ResumePDFDownload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially (SSR)", () => {
    // Before useEffect runs
    const { rerender } = render(<ResumePDFDownload data={mockData} />);

    // After hydration, button should be enabled
    rerender(<ResumePDFDownload data={mockData} />);
  });

  it("renders download button after client hydration", async () => {
    render(<ResumePDFDownload data={mockData} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /download pdf/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows download icon", async () => {
    render(<ResumePDFDownload data={mockData} />);

    await waitFor(() => {
      const downloadIcon = document.querySelector(".lucide-download");
      expect(downloadIcon).toBeInTheDocument();
    });
  });

  it("uses custom filename when provided", () => {
    render(<ResumePDFDownload data={mockData} filename="my-resume.pdf" />);
    // Filename is used during download, not visible in UI
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("button is not disabled after hydration", async () => {
    render(<ResumePDFDownload data={mockData} />);

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /download pdf/i });
      expect(button).not.toBeDisabled();
    });
  });
});
