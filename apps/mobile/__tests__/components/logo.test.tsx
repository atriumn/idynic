import React from "react";
import { render } from "@testing-library/react-native";
import { Logo } from "../../components/logo";

// react-native-svg is mocked in jest.setup.js

describe("Logo", () => {
  it("renders without crashing", () => {
    expect(() => render(<Logo />)).not.toThrow();
  });

  it("accepts size prop", () => {
    expect(() => render(<Logo size={60} />)).not.toThrow();
  });

  it("accepts color prop for solid color", () => {
    expect(() => render(<Logo color="#ffffff" />)).not.toThrow();
  });
});
