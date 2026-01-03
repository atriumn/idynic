import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchScoreVisualizer } from "@/components/match-score-visualizer";

describe("MatchScoreVisualizer", () => {
  const defaultProps = {
    overallScore: 75,
    mustHaveScore: 80,
    niceToHaveScore: 60,
  };

  it("renders overall score", () => {
    render(<MatchScoreVisualizer {...defaultProps} />);

    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("renders must-have score", () => {
    render(<MatchScoreVisualizer {...defaultProps} />);

    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("renders nice-to-have score", () => {
    render(<MatchScoreVisualizer {...defaultProps} />);

    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it('shows "Exceptional Match" label for 90+ score', () => {
    render(<MatchScoreVisualizer {...defaultProps} overallScore={95} />);

    expect(screen.getByText("Exceptional Match")).toBeInTheDocument();
  });

  it('shows "Strong Alignment" label for 80-89 score', () => {
    render(<MatchScoreVisualizer {...defaultProps} overallScore={85} />);

    expect(screen.getByText("Strong Alignment")).toBeInTheDocument();
  });

  it('shows "Good Alignment" label for 60-79 score', () => {
    render(<MatchScoreVisualizer {...defaultProps} overallScore={70} />);

    expect(screen.getByText("Good Alignment")).toBeInTheDocument();
  });

  it('shows "Developing Match" label for 40-59 score', () => {
    render(<MatchScoreVisualizer {...defaultProps} overallScore={50} />);

    expect(screen.getByText("Developing Match")).toBeInTheDocument();
  });

  it('shows "Low Alignment" label for < 40 score', () => {
    render(<MatchScoreVisualizer {...defaultProps} overallScore={30} />);

    expect(screen.getByText("Low Alignment")).toBeInTheDocument();
  });

  it("renders match details when provided", () => {
    render(
      <MatchScoreVisualizer
        {...defaultProps}
        matchDetails={{
          mustHave: { matched: 4, total: 5 },
          niceToHave: { matched: 2, total: 3 },
        }}
      />,
    );

    expect(screen.getByText("4 OF 5 CRITERIA MET")).toBeInTheDocument();
    expect(screen.getByText("2 OF 3 CRITERIA MET")).toBeInTheDocument();
  });

  it("does not render match counts when total is 0", () => {
    render(
      <MatchScoreVisualizer
        {...defaultProps}
        matchDetails={{
          mustHave: { matched: 0, total: 0 },
          niceToHave: { matched: 0, total: 0 },
        }}
      />,
    );

    expect(screen.queryByText(/CRITERIA MET/)).not.toBeInTheDocument();
  });

  it("renders section labels", () => {
    render(<MatchScoreVisualizer {...defaultProps} />);

    expect(screen.getByText("REQUIRED QUALIFICATIONS")).toBeInTheDocument();
    expect(screen.getByText("NICE-TO-HAVE SKILLS")).toBeInTheDocument();
  });

  it("renders info box with explanation", () => {
    render(<MatchScoreVisualizer {...defaultProps} />);

    expect(screen.getByText(/identity synthesis score/i)).toBeInTheDocument();
    expect(
      screen.getByText(/documented claims and story evidence/i),
    ).toBeInTheDocument();
  });

  it("renders radial progress SVG", () => {
    const { container } = render(<MatchScoreVisualizer {...defaultProps} />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("uses green color for high scores", () => {
    render(<MatchScoreVisualizer {...defaultProps} overallScore={85} />);

    const scoreText = screen.getByText("85%");
    expect(scoreText).toHaveClass("text-green-600");
  });

  it("uses amber color for medium scores", () => {
    // Use 65 to avoid collision with niceToHaveScore (60)
    render(<MatchScoreVisualizer {...defaultProps} overallScore={65} />);

    const scoreText = screen.getByText("65%");
    expect(scoreText).toHaveClass("text-amber-600");
  });

  it("uses red color for low scores", () => {
    render(<MatchScoreVisualizer {...defaultProps} overallScore={30} />);

    const scoreText = screen.getByText("30%");
    expect(scoreText).toHaveClass("text-red-600");
  });
});
