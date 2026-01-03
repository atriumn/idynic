import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SharedProfileResume } from "@/components/shared-profile-resume";

// Mock the ResumePDFDownload component
vi.mock("@/components/resume-pdf", () => ({
  ResumePDFDownload: ({
    data,
    filename,
  }: {
    data: Record<string, unknown>;
    filename: string;
  }) => (
    <div data-testid="resume-pdf-download">
      <span data-testid="resume-name">{data.name as string}</span>
      <span data-testid="resume-filename">{filename}</span>
      <span data-testid="resume-email">{data.email as string}</span>
    </div>
  ),
}));

describe("SharedProfileResume", () => {
  const defaultProps = {
    resumeData: {
      name: "Resume Name",
      email: "resume@example.com",
      phone: "123-456-7890",
      location: "Resume City",
      linkedin: "linkedin.com/resume",
      github: "github.com/resume",
      website: "resume.com",
    },
    candidateName: "John Doe",
    candidateContact: {
      email: "john@example.com",
      phone: "555-555-5555",
      location: "New York",
      linkedin: "linkedin.com/johndoe",
      github: "github.com/johndoe",
      website: "johndoe.com",
    },
  };

  it("renders ResumePDFDownload component", () => {
    render(<SharedProfileResume {...defaultProps} />);

    expect(screen.getByTestId("resume-pdf-download")).toBeInTheDocument();
  });

  it("uses candidate name over resume data name", () => {
    render(<SharedProfileResume {...defaultProps} />);

    expect(screen.getByTestId("resume-name")).toHaveTextContent("John Doe");
  });

  it("uses candidate contact email over resume data", () => {
    render(<SharedProfileResume {...defaultProps} />);

    expect(screen.getByTestId("resume-email")).toHaveTextContent(
      "john@example.com",
    );
  });

  it("generates filename from candidate name", () => {
    render(<SharedProfileResume {...defaultProps} />);

    expect(screen.getByTestId("resume-filename")).toHaveTextContent(
      "John Doe.pdf",
    );
  });

  it("falls back to resume data name when candidateName is null", () => {
    render(<SharedProfileResume {...defaultProps} candidateName={null} />);

    // Falls back to data.name from resumeData when candidateName is null
    expect(screen.getByTestId("resume-name")).toHaveTextContent("Resume Name");
  });

  it('falls back to "Candidate" when both candidateName and data.name are missing', () => {
    const propsWithoutName = {
      ...defaultProps,
      candidateName: null,
      resumeData: { ...defaultProps.resumeData, name: undefined },
    };
    render(<SharedProfileResume {...propsWithoutName} />);

    expect(screen.getByTestId("resume-name")).toHaveTextContent("Candidate");
  });

  it('uses "resume.pdf" filename when candidateName is null', () => {
    render(<SharedProfileResume {...defaultProps} candidateName={null} />);

    expect(screen.getByTestId("resume-filename")).toHaveTextContent(
      "resume.pdf",
    );
  });

  it("falls back to resume data when candidate contact is null", () => {
    const props = {
      ...defaultProps,
      candidateContact: {
        email: null,
        phone: null,
        location: null,
        linkedin: null,
        github: null,
        website: null,
      },
    };
    render(<SharedProfileResume {...props} />);

    expect(screen.getByTestId("resume-email")).toHaveTextContent(
      "resume@example.com",
    );
  });
});
