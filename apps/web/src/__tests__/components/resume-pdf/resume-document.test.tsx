import { describe, it, expect, vi } from "vitest";

// Mock @react-pdf/renderer before importing component
vi.mock("@react-pdf/renderer", () => ({
  Document: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pdf-document">{children}</div>
  ),
  Page: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pdf-page">{children}</div>
  ),
  Text: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="pdf-text">{children}</span>
  ),
  View: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pdf-view">{children}</div>
  ),
  Image: ({ src }: { src: string }) => (
    <img data-testid="pdf-image" src={src} alt="" />
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}));

import { render, screen } from "@testing-library/react";
import {
  ResumeDocument,
  ResumeDocumentProps,
} from "@/components/resume-pdf/resume-document";

const mockData: ResumeDocumentProps = {
  name: "John Doe",
  email: "john@example.com",
  phone: "555-1234",
  location: "San Francisco, CA",
  linkedin: "johndoe",
  github: "johndoe",
  website: "https://johndoe.com",
  summary: "Experienced software engineer with 10 years of experience.",
  skills: [
    { category: "Languages", skills: ["JavaScript", "TypeScript", "Python"] },
    { category: "Frameworks", skills: ["React", "Next.js", "Node.js"] },
  ],
  experience: [
    {
      company: "Tech Corp",
      companyDomain: "techcorp.com",
      title: "Senior Engineer",
      dates: "2020 - Present",
      location: "San Francisco",
      bullets: ["Led team of 5 engineers", "**Improved** performance by 50%"],
    },
  ],
  additionalExperience: [
    {
      company: "Startup Inc",
      companyDomain: null,
      title: "Developer",
      dates: "2018 - 2020",
      location: null,
      bullets: ["Built features"],
    },
  ],
  ventures: [
    {
      name: "Side Project",
      role: "Founder",
      status: "Active",
      description: "A cool project",
    },
  ],
  education: [
    {
      institution: "Stanford University",
      degree: "B.S. Computer Science",
      year: "2018",
    },
  ],
};

describe("ResumeDocument", () => {
  it("renders without crashing", () => {
    render(<ResumeDocument {...mockData} />);
    expect(screen.getByTestId("pdf-document")).toBeInTheDocument();
  });

  it("renders the name", () => {
    render(<ResumeDocument {...mockData} />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders contact information", () => {
    render(<ResumeDocument {...mockData} />);
    expect(
      screen.getByText(/john@example.com.*555-1234.*San Francisco, CA/),
    ).toBeInTheDocument();
  });

  it("renders professional summary section", () => {
    render(<ResumeDocument {...mockData} />);
    expect(screen.getByText("Professional Summary")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Experienced software engineer with 10 years of experience.",
      ),
    ).toBeInTheDocument();
  });

  it("renders experience section", () => {
    render(<ResumeDocument {...mockData} />);
    expect(screen.getByText("Experience")).toBeInTheDocument();
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
    expect(screen.getByText(/Tech Corp/)).toBeInTheDocument();
    expect(screen.getByText("2020 - Present")).toBeInTheDocument();
  });

  it("renders experience bullets", () => {
    render(<ResumeDocument {...mockData} />);
    expect(screen.getByText("Led team of 5 engineers")).toBeInTheDocument();
  });

  it("renders bold text in bullets", () => {
    render(<ResumeDocument {...mockData} />);
    expect(screen.getByText("Improved")).toBeInTheDocument();
    // The text after bold is " performance by 50%" but RTL normalizes whitespace
    expect(screen.getByText(/performance by 50%/)).toBeInTheDocument();
  });

  it("renders additional experience section", () => {
    render(<ResumeDocument {...mockData} />);
    expect(screen.getByText("Additional Experience")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();
    expect(screen.getByText("Startup Inc")).toBeInTheDocument();
  });

  it("renders ventures section", () => {
    render(<ResumeDocument {...mockData} />);
    expect(screen.getByText("Ventures & Projects")).toBeInTheDocument();
    expect(screen.getByText(/Side Project.*\(Active\)/)).toBeInTheDocument();
    expect(screen.getByText("Founder")).toBeInTheDocument();
    expect(screen.getByText("A cool project")).toBeInTheDocument();
  });

  it("renders skills section", () => {
    render(<ResumeDocument {...mockData} />);
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Languages:")).toBeInTheDocument();
    expect(
      screen.getByText("JavaScript, TypeScript, Python"),
    ).toBeInTheDocument();
  });

  it("renders education section", () => {
    render(<ResumeDocument {...mockData} />);
    expect(screen.getByText("Education")).toBeInTheDocument();
    expect(screen.getByText("B.S. Computer Science")).toBeInTheDocument();
    expect(screen.getByText(/Stanford University.*2018/)).toBeInTheDocument();
  });

  it("renders company logo when domain provided", () => {
    render(<ResumeDocument {...mockData} />);
    const logos = screen.getAllByTestId("pdf-image");
    expect(
      logos.some((img) => img.getAttribute("src")?.includes("techcorp.com")),
    ).toBe(true);
  });

  it("renders without optional fields", () => {
    const minimalData: ResumeDocumentProps = {
      name: "Jane Doe",
      summary: "A summary",
      skills: [],
      experience: [],
      education: [],
    };
    render(<ResumeDocument {...minimalData} />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("omits sections when empty", () => {
    const minimalData: ResumeDocumentProps = {
      name: "Jane Doe",
      summary: "",
      skills: [],
      experience: [],
      education: [],
    };
    render(<ResumeDocument {...minimalData} />);
    expect(screen.queryByText("Experience")).not.toBeInTheDocument();
    expect(screen.queryByText("Skills")).not.toBeInTheDocument();
    expect(screen.queryByText("Education")).not.toBeInTheDocument();
  });
});
