import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { EducationForm } from "../../components/education-form";

describe("EducationForm", () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders when visible", () => {
    render(
      <EducationForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("Add Education")).toBeTruthy();
    expect(
      screen.getByPlaceholderText(/Stanford University, 2018/),
    ).toBeTruthy();
  });

  it("renders custom title", () => {
    render(
      <EducationForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        title="Edit Education"
      />,
    );

    expect(screen.getByText("Edit Education")).toBeTruthy();
  });

  it("shows error when submitting empty form", async () => {
    render(
      <EducationForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(
        screen.getByText("Education description is required"),
      ).toBeTruthy();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("submits form with valid data", async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    render(
      <EducationForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText(/Stanford University, 2018/),
      "PhD in AI, MIT, 2020",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Stanford University"),
      "MIT",
    );
    // The Degree field has a shorter placeholder without "Stanford"
    const degreeInput = screen.getAllByPlaceholderText(/B.S./)[1];
    fireEvent.changeText(degreeInput, "PhD in Artificial Intelligence");

    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        text: "PhD in AI, MIT, 2020",
        context: {
          institution: "MIT",
          degree: "PhD in Artificial Intelligence",
        },
      });
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onClose when Cancel pressed", () => {
    render(
      <EducationForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.press(screen.getByText("Cancel"));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("populates initial data", () => {
    render(
      <EducationForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={{
          text: "BS Computer Science",
          context: {
            institution: "Stanford",
            degree: "BS CS",
          },
        }}
      />,
    );

    expect(screen.getByDisplayValue("BS Computer Science")).toBeTruthy();
    expect(screen.getByDisplayValue("Stanford")).toBeTruthy();
    expect(screen.getByDisplayValue("BS CS")).toBeTruthy();
  });

  it("shows error on submit failure", async () => {
    mockOnSubmit.mockRejectedValueOnce(new Error("Save failed"));

    render(
      <EducationForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText(/Stanford University, 2018/),
      "Some education",
    );
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeTruthy();
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
