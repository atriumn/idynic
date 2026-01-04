import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text, View, useThemeColor } from "../../components/Themed";
import { renderHook } from "@testing-library/react-native";

// Mock useColorScheme
const mockUseColorScheme = jest.fn();
jest.mock("../../components/useColorScheme", () => ({
  useColorScheme: () => mockUseColorScheme(),
}));

describe("Themed components", () => {
  beforeEach(() => {
    mockUseColorScheme.mockReturnValue("light");
  });

  describe("Text", () => {
    it("renders text content", () => {
      render(<Text>Hello</Text>);

      expect(screen.getByText("Hello")).toBeTruthy();
    });

    it("applies light theme text color by default", () => {
      render(<Text testID="themed-text">Light text</Text>);

      const textElement = screen.getByTestId("themed-text");
      // Light theme text color is #000
      expect(textElement.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: "#000" })]),
      );
    });

    it("applies dark theme text color", () => {
      mockUseColorScheme.mockReturnValue("dark");

      render(<Text testID="themed-text">Dark text</Text>);

      const textElement = screen.getByTestId("themed-text");
      // Dark theme text color is #fff
      expect(textElement.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: "#fff" })]),
      );
    });

    it("uses custom lightColor prop", () => {
      render(
        <Text testID="custom-text" lightColor="#ff0000">
          Custom light
        </Text>,
      );

      const textElement = screen.getByTestId("custom-text");
      expect(textElement.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: "#ff0000" })]),
      );
    });

    it("uses custom darkColor prop in dark mode", () => {
      mockUseColorScheme.mockReturnValue("dark");

      render(
        <Text testID="custom-text" darkColor="#00ff00">
          Custom dark
        </Text>,
      );

      const textElement = screen.getByTestId("custom-text");
      expect(textElement.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: "#00ff00" })]),
      );
    });
  });

  describe("View", () => {
    it("renders children", () => {
      render(
        <View>
          <Text>Child content</Text>
        </View>,
      );

      expect(screen.getByText("Child content")).toBeTruthy();
    });

    it("applies light theme background color by default", () => {
      render(<View testID="themed-view" />);

      const viewElement = screen.getByTestId("themed-view");
      // Light theme background is #fff
      expect(viewElement.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: "#fff" }),
        ]),
      );
    });

    it("applies dark theme background color", () => {
      mockUseColorScheme.mockReturnValue("dark");

      render(<View testID="themed-view" />);

      const viewElement = screen.getByTestId("themed-view");
      // Dark theme background is #000
      expect(viewElement.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: "#000" }),
        ]),
      );
    });
  });

  describe("useThemeColor", () => {
    it("returns color from props when provided", () => {
      const { result } = renderHook(() =>
        useThemeColor({ light: "#custom", dark: "#dark" }, "text"),
      );

      expect(result.current).toBe("#custom");
    });

    it("returns color from Colors when not in props", () => {
      const { result } = renderHook(() => useThemeColor({}, "text"));

      // Light theme text is #000
      expect(result.current).toBe("#000");
    });

    it("falls back to light theme when colorScheme is null", () => {
      mockUseColorScheme.mockReturnValue(null);

      const { result } = renderHook(() => useThemeColor({}, "text"));

      expect(result.current).toBe("#000");
    });
  });
});
