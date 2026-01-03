import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableText } from "@/components/editable-text";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("EditableText", () => {
  const defaultProps = {
    value: "Test content",
    fieldPath: "summary",
    contentType: "summary" as const,
    isEdited: false,
    opportunityId: "opp-123",
    onUpdate: vi.fn(),
    onRevert: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ value: "Updated content" }),
    });
  });

  it("renders text content in view mode", () => {
    render(<EditableText {...defaultProps} />);

    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("shows pencil icon on hover", () => {
    render(<EditableText {...defaultProps} />);

    // The button is hidden by default via CSS
    const editButton = screen.getByRole("button");
    expect(editButton).toBeInTheDocument();
  });

  it("shows edited badge when isEdited is true", () => {
    render(<EditableText {...defaultProps} isEdited={true} />);

    expect(screen.getByText("edited")).toBeInTheDocument();
  });

  it("enters edit mode when text is clicked", async () => {
    const user = userEvent.setup();
    render(<EditableText {...defaultProps} />);

    await user.click(screen.getByText("Test content"));

    // Should show input/textarea in edit mode (may have multiple textboxes including custom instruction)
    await waitFor(() => {
      const textboxes = screen.getAllByRole("textbox");
      expect(textboxes.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("enters edit mode when pencil button is clicked", async () => {
    const user = userEvent.setup();
    render(<EditableText {...defaultProps} />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      const textboxes = screen.getAllByRole("textbox");
      expect(textboxes.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows input for single line content", async () => {
    const user = userEvent.setup();
    render(<EditableText {...defaultProps} multiline={false} />);

    await user.click(screen.getByText("Test content"));

    await waitFor(() => {
      // Get the main input (not the custom instruction input)
      const input = screen.getByDisplayValue("Test content");
      expect(input.tagName.toLowerCase()).toBe("input");
    });
  });

  it("shows textarea for multiline content", async () => {
    const user = userEvent.setup();
    render(<EditableText {...defaultProps} multiline={true} />);

    await user.click(screen.getByText("Test content"));

    await waitFor(() => {
      // Get the main textarea (not the custom instruction input)
      const textarea = screen.getByDisplayValue("Test content");
      expect(textarea.tagName.toLowerCase()).toBe("textarea");
    });
  });

  it("shows quick actions in edit mode", async () => {
    const user = userEvent.setup();
    render(<EditableText {...defaultProps} contentType="summary" />);

    await user.click(screen.getByText("Test content"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /shorten/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /expand/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /more confident/i }),
    ).toBeInTheDocument();
  });

  it("shows different quick actions for bullets", async () => {
    const user = userEvent.setup();
    render(<EditableText {...defaultProps} contentType="bullet" />);

    await user.click(screen.getByText("Test content"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /shorten/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /add metrics/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /stronger verbs/i }),
    ).toBeInTheDocument();
  });

  it("shows emphasize dropdown for bullets with skills", async () => {
    const user = userEvent.setup();
    render(
      <EditableText
        {...defaultProps}
        contentType="bullet"
        skills={["React", "TypeScript", "Node.js"]}
      />,
    );

    await user.click(screen.getByText("Test content"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /emphasize/i }),
      ).toBeInTheDocument();
    });
  });

  it("triggers AI action when quick action is clicked", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(
      <EditableText
        {...defaultProps}
        onUpdate={onUpdate}
        contentType="summary"
      />,
    );

    await user.click(screen.getByText("Test content"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /shorten/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /shorten/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/tailored-profile/opp-123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("instruction"),
      });
    });
  });

  it("shows custom instruction input", async () => {
    const user = userEvent.setup();
    render(<EditableText {...defaultProps} />);

    await user.click(screen.getByText("Test content"));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/custom instruction/i),
      ).toBeInTheDocument();
    });
  });

  it("sends custom instruction", async () => {
    const user = userEvent.setup();
    render(<EditableText {...defaultProps} />);

    await user.click(screen.getByText("Test content"));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/custom instruction/i),
      ).toBeInTheDocument();
    });

    const customInput = screen.getByPlaceholderText(/custom instruction/i);
    await user.type(customInput, "Make it sound more professional");
    fireEvent.keyDown(customInput, { key: "Enter" });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/tailored-profile/opp-123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("Make it sound more professional"),
      });
    });
  });

  it("shows revert button when isEdited is true", async () => {
    const user = userEvent.setup();
    render(<EditableText {...defaultProps} isEdited={true} />);

    await user.click(screen.getByText("Test content"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /revert/i }),
      ).toBeInTheDocument();
    });
  });

  it("calls onRevert when revert is clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ value: "Original content" }),
    });

    const onRevert = vi.fn();
    const user = userEvent.setup();
    render(
      <EditableText {...defaultProps} isEdited={true} onRevert={onRevert} />,
    );

    await user.click(screen.getByText("Test content"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /revert/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /revert/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/tailored-profile/opp-123", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "summary" }),
      });
    });

    await waitFor(() => {
      expect(onRevert).toHaveBeenCalledWith("summary");
    });
  });

  it("renders bold markdown in view mode", () => {
    render(<EditableText {...defaultProps} value="This is **bold** text" />);

    const strong = screen.getByText("bold");
    expect(strong.tagName.toLowerCase()).toBe("strong");
  });
});
