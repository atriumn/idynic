import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "@/components/site-footer";

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

// Mock FeedbackModal
vi.mock("./feedback-modal", () => ({
  FeedbackModal: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));

describe("SiteFooter", () => {
  it("renders logo and brand name", () => {
    render(<SiteFooter />);

    expect(screen.getByText("Idynic")).toBeInTheDocument();
    expect(screen.getByAltText("Idynic")).toBeInTheDocument();
  });

  it("renders tagline", () => {
    render(<SiteFooter />);

    expect(
      screen.getByText(/ai-powered career companion/i),
    ).toBeInTheDocument();
  });

  it("renders Product section links", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: /pricing/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /for recruiters/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /for students/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^login$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /help center/i }),
    ).toBeInTheDocument();
  });

  it("renders Company section links", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: /about/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /trust & safety/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contact/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /terms/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /privacy/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cookies/i })).toBeInTheDocument();
  });

  it("renders Discord link with external attributes", () => {
    render(<SiteFooter />);

    const discordLink = screen.getByRole("link", { name: /discord/i });
    expect(discordLink).toHaveAttribute("href", "https://discord.gg/tCeeZDFd");
    expect(discordLink).toHaveAttribute("target", "_blank");
    expect(discordLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders current year in copyright", () => {
    render(<SiteFooter />);

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${currentYear}`))).toBeInTheDocument();
    expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument();
  });

  it("renders app store badges", () => {
    render(<SiteFooter />);

    expect(
      screen.getByAltText(/download on the app store/i),
    ).toBeInTheDocument();
    expect(screen.getByAltText(/get it on google play/i)).toBeInTheDocument();
  });

  it("renders Report a Bug button", () => {
    render(<SiteFooter />);

    expect(screen.getByText(/report a bug/i)).toBeInTheDocument();
  });

  it("has correct link hrefs", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: /pricing/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getByRole("link", { name: /terms/i })).toHaveAttribute(
      "href",
      "/legal/terms",
    );
    expect(screen.getByRole("link", { name: /privacy/i })).toHaveAttribute(
      "href",
      "/legal/privacy",
    );
  });
});
