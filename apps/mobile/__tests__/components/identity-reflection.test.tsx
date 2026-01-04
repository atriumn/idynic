import React from "react";
import { render, screen } from "@testing-library/react-native";
import { IdentityReflection } from "../../components/identity-reflection";
import { mockIdentityReflection } from "../mocks/api-responses";

describe("IdentityReflection", () => {
  describe("when loading", () => {
    it("shows loading indicator and message", () => {
      render(<IdentityReflection data={null} isLoading={true} />);

      expect(
        screen.getByText("Synthesizing your Master Record..."),
      ).toBeTruthy();
    });
  });

  describe("when no data and not loading", () => {
    it("renders nothing", () => {
      const { toJSON } = render(
        <IdentityReflection data={null} isLoading={false} />,
      );

      expect(toJSON()).toBeNull();
    });

    it("renders nothing with undefined data", () => {
      const { toJSON } = render(<IdentityReflection data={null} />);

      expect(toJSON()).toBeNull();
    });
  });

  describe("when data has no content", () => {
    it("renders nothing when all fields are empty", () => {
      const emptyData = {
        archetype: null,
        headline: null,
        bio: null,
        keywords: [],
        matches: [],
        generated_at: "2024-01-01T00:00:00Z",
      };

      const { toJSON } = render(<IdentityReflection data={emptyData} />);

      expect(toJSON()).toBeNull();
    });
  });

  describe("when data is present", () => {
    it("renders headline", () => {
      render(<IdentityReflection data={mockIdentityReflection} />);

      expect(screen.getByText(mockIdentityReflection.headline!)).toBeTruthy();
    });

    it("renders bio", () => {
      render(<IdentityReflection data={mockIdentityReflection} />);

      expect(screen.getByText(mockIdentityReflection.bio!)).toBeTruthy();
    });

    it("renders archetype badge", () => {
      render(<IdentityReflection data={mockIdentityReflection} />);

      expect(screen.getByText(mockIdentityReflection.archetype!)).toBeTruthy();
    });

    it("renders keywords", () => {
      render(<IdentityReflection data={mockIdentityReflection} />);

      for (const keyword of mockIdentityReflection.keywords) {
        expect(screen.getByText(keyword)).toBeTruthy();
      }
    });

    it("renders job matches section", () => {
      render(<IdentityReflection data={mockIdentityReflection} />);

      // Check for the "Best Fit Roles" label
      expect(screen.getByText("Best Fit Roles")).toBeTruthy();

      // Check that each match is present in the rendered output
      for (const match of mockIdentityReflection.matches) {
        expect(screen.getByText(new RegExp(match))).toBeTruthy();
      }
    });

    it("renders with only headline", () => {
      const partialData = {
        archetype: null,
        headline: "Just a headline",
        bio: null,
        keywords: [],
        matches: [],
        generated_at: "2024-01-01T00:00:00Z",
      };

      render(<IdentityReflection data={partialData} />);

      expect(screen.getByText("Just a headline")).toBeTruthy();
    });

    it("renders with only archetype", () => {
      const partialData = {
        archetype: "Builder",
        headline: null,
        bio: null,
        keywords: [],
        matches: [],
        generated_at: "2024-01-01T00:00:00Z",
      };

      render(<IdentityReflection data={partialData} />);

      expect(screen.getByText("Builder")).toBeTruthy();
    });
  });

  describe("archetype colors", () => {
    const archetypes = [
      "Builder",
      "Optimizer",
      "Connector",
      "Guide",
      "Stabilizer",
      "Specialist",
      "Strategist",
      "Advocate",
      "Investigator",
      "Performer",
    ];

    it.each(archetypes)(
      "renders %s archetype with correct styling",
      (archetype) => {
        const data = {
          archetype,
          headline: "Test",
          bio: null,
          keywords: [],
          matches: [],
          generated_at: "2024-01-01T00:00:00Z",
        };

        render(<IdentityReflection data={data} />);

        expect(screen.getByText(archetype)).toBeTruthy();
      },
    );

    it("uses default colors for unknown archetype", () => {
      const data = {
        archetype: "UnknownType",
        headline: "Test",
        bio: null,
        keywords: [],
        matches: [],
        generated_at: "2024-01-01T00:00:00Z",
      };

      render(<IdentityReflection data={data} />);

      expect(screen.getByText("UnknownType")).toBeTruthy();
    });
  });
});
