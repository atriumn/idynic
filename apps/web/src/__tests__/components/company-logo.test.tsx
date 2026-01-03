import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CompanyLogo, getLogoUrl } from "@/components/company-logo";

describe("CompanyLogo", () => {
  it("renders image when domain is provided", () => {
    render(<CompanyLogo domain="google.com" companyName="Google" />);

    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", "Google logo");
  });

  it("renders fallback icon when no domain provided", () => {
    render(<CompanyLogo domain={null} companyName="Unknown Company" />);

    // Should not have an img element
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    // Should have the fallback div with title
    expect(screen.getByTitle("Unknown Company")).toBeInTheDocument();
  });

  it("renders fallback icon when domain is undefined", () => {
    render(<CompanyLogo domain={undefined} companyName="Test Company" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTitle("Test Company")).toBeInTheDocument();
  });

  it("shows fallback on image error", () => {
    render(<CompanyLogo domain="invalid-domain.xyz" companyName="Test" />);

    const img = screen.getByRole("img");
    fireEvent.error(img);

    // After error, should show fallback
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTitle("Test")).toBeInTheDocument();
  });

  it("uses correct logo.dev URL", () => {
    render(<CompanyLogo domain="example.com" companyName="Example" />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("img.logo.dev/example.com"),
    );
  });

  it("cleans domain with protocol prefix", () => {
    render(<CompanyLogo domain="https://example.com" companyName="Example" />);

    const img = screen.getByRole("img");
    // Should strip the https:// prefix
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("img.logo.dev/example.com"),
    );
    expect(img).toHaveAttribute(
      "src",
      expect.not.stringContaining("https://example.com"),
    );
  });

  it("applies custom size", () => {
    render(<CompanyLogo domain="test.com" companyName="Test" size={48} />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("width", "48");
    expect(img).toHaveAttribute("height", "48");
  });

  it("applies custom className", () => {
    render(
      <CompanyLogo
        domain="test.com"
        companyName="Test"
        className="custom-class"
      />,
    );

    const img = screen.getByRole("img");
    expect(img).toHaveClass("custom-class");
  });

  it("uses default size of 24", () => {
    render(<CompanyLogo domain="test.com" companyName="Test" />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("width", "24");
  });
});

describe("getLogoUrl", () => {
  it("returns null for null domain", () => {
    expect(getLogoUrl(null)).toBeNull();
  });

  it("returns null for undefined domain", () => {
    expect(getLogoUrl(undefined)).toBeNull();
  });

  it("returns logo.dev URL for valid domain", () => {
    const url = getLogoUrl("example.com");
    expect(url).toContain("img.logo.dev/example.com");
  });

  it("strips protocol from domain", () => {
    const url = getLogoUrl("https://example.com");
    expect(url).toContain("img.logo.dev/example.com");
    expect(url).not.toContain("https://example.com");
  });

  it("strips trailing slash from domain", () => {
    const url = getLogoUrl("example.com/");
    expect(url).toContain("img.logo.dev/example.com");
    expect(url).not.toContain("example.com/");
  });
});
