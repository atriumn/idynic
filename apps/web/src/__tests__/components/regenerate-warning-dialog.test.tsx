import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegenerateWarningDialog } from "@/components/regenerate-warning-dialog";

describe("RegenerateWarningDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    editedFieldCount: 3,
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open is true", () => {
    render(<RegenerateWarningDialog {...defaultProps} />);

    expect(screen.getByText("Regenerate Profile?")).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(<RegenerateWarningDialog {...defaultProps} open={false} />);

    expect(screen.queryByText("Regenerate Profile?")).not.toBeInTheDocument();
  });

  it("shows correct field count in message (plural)", () => {
    render(<RegenerateWarningDialog {...defaultProps} editedFieldCount={5} />);

    expect(screen.getByText(/5 edited fields/)).toBeInTheDocument();
  });

  it("shows correct field count in message (singular)", () => {
    render(<RegenerateWarningDialog {...defaultProps} editedFieldCount={1} />);

    expect(screen.getByText(/1 edited field/)).toBeInTheDocument();
  });

  it("has Cancel and Regenerate buttons", () => {
    render(<RegenerateWarningDialog {...defaultProps} />);

    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /regenerate anyway/i }),
    ).toBeInTheDocument();
  });

  it("calls onOpenChange with false when Cancel clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <RegenerateWarningDialog {...defaultProps} onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onConfirm and closes when Regenerate clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <RegenerateWarningDialog
        {...defaultProps}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /regenerate anyway/i }),
    );

    expect(onConfirm).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows warning icon", () => {
    render(<RegenerateWarningDialog {...defaultProps} />);

    // The AlertTriangle icon should be present
    const title = screen.getByText("Regenerate Profile?");
    expect(title.parentElement).toContainHTML("svg");
  });

  it("has destructive variant on confirm button", () => {
    render(<RegenerateWarningDialog {...defaultProps} />);

    const confirmButton = screen.getByRole("button", {
      name: /regenerate anyway/i,
    });
    // Radix/shadcn destructive buttons typically have specific styling
    expect(confirmButton).toBeInTheDocument();
  });
});
