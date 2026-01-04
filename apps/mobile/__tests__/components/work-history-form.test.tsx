import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { WorkHistoryForm } from "../../components/work-history-form";

describe("WorkHistoryForm", () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders when visible", () => {
    render(
      <WorkHistoryForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("Add Experience")).toBeTruthy();
    expect(screen.getByPlaceholderText("Company name")).toBeTruthy();
    expect(screen.getByPlaceholderText("Software Engineer")).toBeTruthy();
  });

  it("renders custom title", () => {
    render(
      <WorkHistoryForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        title="Edit Experience"
      />,
    );

    expect(screen.getByText("Edit Experience")).toBeTruthy();
  });

  it("renders venture labels when isVenture is true", () => {
    render(
      <WorkHistoryForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isVenture={true}
      />,
    );

    expect(screen.getByPlaceholderText("Your Startup Inc.")).toBeTruthy();
    expect(screen.getByPlaceholderText("Founder & CEO")).toBeTruthy();
  });

  it("shows error when company is empty", async () => {
    render(
      <WorkHistoryForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Company and title are required")).toBeTruthy();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("shows error when start date is empty", async () => {
    render(
      <WorkHistoryForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText("Company name"),
      "Acme Corp",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Software Engineer"),
      "Developer",
    );
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Start date is required")).toBeTruthy();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("submits form with valid data", async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    render(
      <WorkHistoryForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText("Company name"),
      "TechCorp",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Software Engineer"),
      "Senior Engineer",
    );
    fireEvent.changeText(screen.getByPlaceholderText("2020-01"), "2022-01");
    fireEvent.changeText(screen.getByPlaceholderText("Present"), "2024-01");
    fireEvent.changeText(
      screen.getByPlaceholderText("San Francisco, CA"),
      "Remote",
    );

    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        company: "TechCorp",
        title: "Senior Engineer",
        start_date: "2022-01",
        end_date: "2024-01",
        location: "Remote",
        summary: null,
        entry_type: "work",
      });
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("submits venture with correct entry_type", async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    render(
      <WorkHistoryForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isVenture={true}
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText("Your Startup Inc."),
      "My Startup",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Founder & CEO"),
      "Founder",
    );
    fireEvent.changeText(screen.getByPlaceholderText("2020-01"), "2020-06");

    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "venture",
        }),
      );
    });
  });

  it("calls onClose when Cancel pressed", () => {
    render(
      <WorkHistoryForm
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
      <WorkHistoryForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={{
          company: "InitialCorp",
          title: "Engineer",
          start_date: "2020-01",
          end_date: "2023-01",
          location: "NYC",
          summary: "Did stuff",
        }}
      />,
    );

    expect(screen.getByDisplayValue("InitialCorp")).toBeTruthy();
    expect(screen.getByDisplayValue("Engineer")).toBeTruthy();
    expect(screen.getByDisplayValue("2020-01")).toBeTruthy();
    expect(screen.getByDisplayValue("2023-01")).toBeTruthy();
    expect(screen.getByDisplayValue("NYC")).toBeTruthy();
    expect(screen.getByDisplayValue("Did stuff")).toBeTruthy();
  });

  it("shows error on submit failure", async () => {
    mockOnSubmit.mockRejectedValueOnce(new Error("Save failed"));

    render(
      <WorkHistoryForm
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText("Company name"),
      "Company",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Software Engineer"),
      "Role",
    );
    fireEvent.changeText(screen.getByPlaceholderText("2020-01"), "2020-01");
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeTruthy();
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
