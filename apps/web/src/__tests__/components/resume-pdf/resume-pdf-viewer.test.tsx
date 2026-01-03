import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResumePDFViewer } from "@/components/resume-pdf/resume-pdf-viewer";

// Mock @react-pdf/renderer
vi.mock("@react-pdf/renderer", () => ({
  pdf: vi.fn(() => ({
    toBlob: vi.fn(() =>
      Promise.resolve(new Blob(["test"], { type: "application/pdf" })),
    ),
  })),
}));

// Mock the resume document import
vi.mock("./resume-document", () => ({
  ResumeDocument: () => null,
}));

const mockData = {
  name: "John Doe",
  email: "john@example.com",
  summary: "Experienced engineer",
  skills: [],
  experience: [],
  education: [],
};

describe("ResumePDFViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the component", () => {
    const { container } = render(<ResumePDFViewer data={mockData} />);
    expect(container).toBeInTheDocument();
  });

  it("shows generating text during initial load", () => {
    render(<ResumePDFViewer data={mockData} />);
    // Component shows loading state before client hydration
    expect(screen.getByText("Generating PDF...")).toBeInTheDocument();
  });

  it("has loading indicator styling", () => {
    render(<ResumePDFViewer data={mockData} />);
    // Check for the loading container
    const loadingContainer = screen
      .getByText("Generating PDF...")
      .closest("div");
    expect(loadingContainer).toBeInTheDocument();
  });

  it("renders within a bordered container", () => {
    const { container } = render(<ResumePDFViewer data={mockData} />);
    const borderedDiv = container.querySelector(".border");
    expect(borderedDiv).toBeInTheDocument();
  });
});
