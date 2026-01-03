import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditClaimModal } from "@/components/edit-claim-modal";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockClaim = {
  id: "claim-123",
  label: "React",
  description: "Frontend library expertise",
  type: "skill",
};

describe("EditClaimModal", () => {
  const defaultProps = {
    claim: mockClaim,
    open: true,
    onOpenChange: vi.fn(),
    onSaved: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  it("renders modal title", () => {
    render(<EditClaimModal {...defaultProps} />);

    expect(screen.getByText("Edit Claim")).toBeInTheDocument();
  });

  it("renders modal description", () => {
    render(<EditClaimModal {...defaultProps} />);

    expect(screen.getByText(/update the claim details/i)).toBeInTheDocument();
  });

  it("populates form with claim data", () => {
    render(<EditClaimModal {...defaultProps} />);

    expect(screen.getByLabelText(/label/i)).toHaveValue("React");
    expect(screen.getByLabelText(/description/i)).toHaveValue(
      "Frontend library expertise",
    );
  });

  it("renders type selector with correct value", () => {
    render(<EditClaimModal {...defaultProps} />);

    // The select trigger should show the current type
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders Cancel and Save buttons", () => {
    render(<EditClaimModal {...defaultProps} />);

    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it("disables Save when no changes made", () => {
    render(<EditClaimModal {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeDisabled();
  });

  it("enables Save when label is changed", async () => {
    const user = userEvent.setup();
    render(<EditClaimModal {...defaultProps} />);

    const labelInput = screen.getByLabelText(/label/i);
    await user.clear(labelInput);
    await user.type(labelInput, "React Native");

    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
  });

  it("enables Save when description is changed", async () => {
    const user = userEvent.setup();
    render(<EditClaimModal {...defaultProps} />);

    const descInput = screen.getByLabelText(/description/i);
    await user.clear(descInput);
    await user.type(descInput, "New description");

    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
  });

  it("calls API to update claim on save", async () => {
    const user = userEvent.setup();
    render(<EditClaimModal {...defaultProps} />);

    const labelInput = screen.getByLabelText(/label/i);
    await user.clear(labelInput);
    await user.type(labelInput, "React Native");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/claims/claim-123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "React Native",
          description: "Frontend library expertise",
          type: "skill",
        }),
      });
    });
  });

  it("calls onSaved and closes modal on success", async () => {
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <EditClaimModal
        {...defaultProps}
        onSaved={onSaved}
        onOpenChange={onOpenChange}
      />,
    );

    const labelInput = screen.getByLabelText(/label/i);
    await user.clear(labelInput);
    await user.type(labelInput, "React Native");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows error on API failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: { message: "Update failed" } }),
    });

    const user = userEvent.setup();
    render(<EditClaimModal {...defaultProps} />);

    const labelInput = screen.getByLabelText(/label/i);
    await user.clear(labelInput);
    await user.type(labelInput, "New Label");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText("Update failed")).toBeInTheDocument();
    });
  });

  it("shows loading state while saving", async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    const user = userEvent.setup();
    render(<EditClaimModal {...defaultProps} />);

    const labelInput = screen.getByLabelText(/label/i);
    await user.clear(labelInput);
    await user.type(labelInput, "New Label");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      // Button text changes to "Saving..." when loading
      expect(
        screen.getByRole("button", { name: /saving/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    });
  });

  it("closes modal on Cancel click", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(<EditClaimModal {...defaultProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables Save when label is empty", async () => {
    const user = userEvent.setup();
    render(<EditClaimModal {...defaultProps} />);

    const labelInput = screen.getByLabelText(/label/i);
    await user.clear(labelInput);

    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeDisabled();
  });

  it("handles claim with null description", () => {
    render(
      <EditClaimModal
        {...defaultProps}
        claim={{ ...mockClaim, description: null }}
      />,
    );

    expect(screen.getByLabelText(/description/i)).toHaveValue("");
  });

  it("resets form when claim changes", async () => {
    const { rerender } = render(<EditClaimModal {...defaultProps} />);

    const newClaim = {
      id: "claim-456",
      label: "TypeScript",
      description: "Type safety",
      type: "skill",
    };

    rerender(<EditClaimModal {...defaultProps} claim={newClaim} />);

    expect(screen.getByLabelText(/label/i)).toHaveValue("TypeScript");
    expect(screen.getByLabelText(/description/i)).toHaveValue("Type safety");
  });

  it("does not render when open is false", () => {
    render(<EditClaimModal {...defaultProps} open={false} />);

    expect(screen.queryByText("Edit Claim")).not.toBeInTheDocument();
  });
});
