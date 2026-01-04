import React from "react";
import { render } from "@testing-library/react-native";
import { MeshBackground } from "../../components/ui/mesh-background";

// Mock nativewind useColorScheme
jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "dark" }),
}));

describe("MeshBackground", () => {
  it("renders without crashing", () => {
    const { toJSON } = render(<MeshBackground />);

    expect(toJSON()).not.toBeNull();
  });

  it("renders a View container", () => {
    const { toJSON } = render(<MeshBackground />);
    const tree = toJSON();

    // Root element should be a View
    expect(tree).toBeTruthy();
    expect((tree as { type: string }).type).toBe("View");
  });

  it("renders SVG with gradient circles", () => {
    const { toJSON } = render(<MeshBackground />);
    const tree = JSON.stringify(toJSON());

    // Check that SVG-related elements are rendered (mocked as simple elements)
    expect(tree).toContain("svg");
  });
});
