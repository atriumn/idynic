import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IdentityReflection } from "@/components/identity/identity-reflection";

// Mock the theme-colors module
vi.mock("@/lib/theme-colors", () => ({
  getArchetypeStyle: () => ({
    bg: "#f0f0f0",
    text: "#333333",
    border: "#cccccc",
  }),
}));

const mockData = {
  identity_headline: "Full-Stack Engineer & Technical Leader",
  identity_bio:
    "Experienced software engineer with a passion for building scalable systems.",
  identity_archetype: "Builder",
  identity_keywords: ["TypeScript", "React", "Node.js", "AWS"],
  identity_matches: ["Staff Engineer", "Tech Lead", "Principal Engineer"],
  identity_generated_at: "2024-01-15T10:00:00Z",
};

describe("IdentityReflection", () => {
  it("renders null when no data and not loading", () => {
    const { container } = render(<IdentityReflection data={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders loading state", () => {
    render(<IdentityReflection data={null} isLoading={true} />);
    expect(
      screen.getByText("Synthesizing your Master Record..."),
    ).toBeInTheDocument();
  });

  it("renders loading spinner when loading", () => {
    render(<IdentityReflection data={null} isLoading={true} />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("renders headline", () => {
    render(<IdentityReflection data={mockData} />);
    expect(
      screen.getByText("Full-Stack Engineer & Technical Leader"),
    ).toBeInTheDocument();
  });

  it("renders bio", () => {
    render(<IdentityReflection data={mockData} />);
    expect(
      screen.getByText(/Experienced software engineer/),
    ).toBeInTheDocument();
  });

  it("renders archetype badge", () => {
    render(<IdentityReflection data={mockData} />);
    expect(screen.getByText("Builder")).toBeInTheDocument();
  });

  it("renders keywords", () => {
    render(<IdentityReflection data={mockData} />);
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText("AWS")).toBeInTheDocument();
  });

  it("renders job matches", () => {
    render(<IdentityReflection data={mockData} />);
    expect(screen.getByText("Best Fit Roles")).toBeInTheDocument();
    expect(screen.getByText(/Staff Engineer/)).toBeInTheDocument();
  });

  it("renders null when data has no content", () => {
    const emptyData = {
      identity_headline: null,
      identity_bio: null,
      identity_archetype: null,
      identity_keywords: null,
      identity_matches: null,
      identity_generated_at: null,
    };
    const { container } = render(<IdentityReflection data={emptyData} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders with only headline", () => {
    const partialData = {
      ...mockData,
      identity_bio: null,
      identity_archetype: null,
      identity_keywords: null,
      identity_matches: null,
    };
    render(<IdentityReflection data={partialData} />);
    expect(
      screen.getByText("Full-Stack Engineer & Technical Leader"),
    ).toBeInTheDocument();
  });

  it("renders with empty keywords array", () => {
    const dataWithEmptyKeywords = {
      ...mockData,
      identity_keywords: [],
    };
    render(<IdentityReflection data={dataWithEmptyKeywords} />);
    expect(
      screen.getByText("Full-Stack Engineer & Technical Leader"),
    ).toBeInTheDocument();
  });

  it("renders with empty matches array", () => {
    const dataWithEmptyMatches = {
      ...mockData,
      identity_matches: [],
    };
    render(<IdentityReflection data={dataWithEmptyMatches} />);
    expect(screen.queryByText("Best Fit Roles")).not.toBeInTheDocument();
  });
});
