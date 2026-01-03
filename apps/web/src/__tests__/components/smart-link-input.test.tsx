import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SmartLinkInput } from "@/components/smart-link-input";

describe("SmartLinkInput", () => {
  it("renders URL input and label input", () => {
    render(<SmartLinkInput onAdd={() => {}} />);

    expect(screen.getByPlaceholderText(/paste.*url/i)).toBeInTheDocument();
  });

  it("shows detected type when URL is entered", async () => {
    const user = userEvent.setup();
    render(<SmartLinkInput onAdd={() => {}} />);

    const input = screen.getByPlaceholderText(/paste.*url/i);
    await user.type(input, "https://linkedin.com/jobs/123");

    expect(screen.getByText(/linkedin/i)).toBeInTheDocument();
  });

  it("calls onAdd with link data when Add button clicked", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<SmartLinkInput onAdd={onAdd} />);

    await user.type(
      screen.getByPlaceholderText(/paste.*url/i),
      "https://linkedin.com/jobs/123",
    );
    await user.type(screen.getByPlaceholderText(/label/i), "Main posting");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(onAdd).toHaveBeenCalledWith({
      url: "https://linkedin.com/jobs/123",
      label: "Main posting",
      type: "linkedin",
    });
  });

  it("clears inputs after adding", async () => {
    const user = userEvent.setup();
    render(<SmartLinkInput onAdd={() => {}} />);

    const urlInput = screen.getByPlaceholderText(/paste.*url/i);
    await user.type(urlInput, "https://example.com");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(urlInput).toHaveValue("");
  });

  it("disables Add button when URL is empty", () => {
    render(<SmartLinkInput onAdd={() => {}} />);

    expect(screen.getByRole("button", { name: /add/i })).toBeDisabled();
  });
});
