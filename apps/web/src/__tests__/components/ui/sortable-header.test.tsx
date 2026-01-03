import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortableHeader } from "@/components/ui/sortable-header";

describe("SortableHeader", () => {
  it("renders label", () => {
    render(
      <SortableHeader
        label="Confidence"
        field="confidence"
        currentField="confidence"
        direction="desc"
        onSort={vi.fn()}
      />,
    );
    expect(screen.getByText("Confidence")).toBeInTheDocument();
  });

  it("shows desc arrow when active and descending", () => {
    render(
      <SortableHeader
        label="Confidence"
        field="confidence"
        currentField="confidence"
        direction="desc"
        onSort={vi.fn()}
      />,
    );
    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("shows asc arrow when active and ascending", () => {
    render(
      <SortableHeader
        label="Confidence"
        field="confidence"
        currentField="confidence"
        direction="asc"
        onSort={vi.fn()}
      />,
    );
    expect(screen.getByText("▲")).toBeInTheDocument();
  });

  it("shows no arrow when not active", () => {
    render(
      <SortableHeader
        label="Label"
        field="label"
        currentField="confidence"
        direction="desc"
        onSort={vi.fn()}
      />,
    );
    expect(screen.queryByText("▼")).not.toBeInTheDocument();
    expect(screen.queryByText("▲")).not.toBeInTheDocument();
  });

  it("calls onSort with field when clicked", async () => {
    const onSort = vi.fn();
    const user = userEvent.setup();
    render(
      <SortableHeader
        label="Confidence"
        field="confidence"
        currentField="label"
        direction="asc"
        onSort={onSort}
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(onSort).toHaveBeenCalledWith("confidence");
  });
});
