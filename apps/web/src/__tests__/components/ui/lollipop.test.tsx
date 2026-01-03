import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Lollipop } from "@/components/ui/lollipop";

describe("Lollipop", () => {
  it("renders percentage text", () => {
    render(<Lollipop value={85} />);
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("renders 0% correctly", () => {
    render(<Lollipop value={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders 100% correctly", () => {
    render(<Lollipop value={100} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("applies custom width", () => {
    const { container } = render(<Lollipop value={50} width={120} />);
    const track = container.querySelector("[data-testid='lollipop-track']");
    expect(track).toHaveStyle({ width: "120px" });
  });
});
