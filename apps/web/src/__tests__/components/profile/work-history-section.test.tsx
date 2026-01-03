import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkHistorySection } from "@/components/profile/work-history-section";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockWorkHistory = [
  {
    id: "work-1",
    company: "Acme Corp",
    title: "Senior Engineer",
    start_date: "Jan 2020",
    end_date: "Dec 2023",
    location: "San Francisco, CA",
    summary: null,
    company_domain: "acme.com",
    order_index: 0,
  },
  {
    id: "work-2",
    company: "StartupXYZ",
    title: "Tech Lead",
    start_date: "Jan 2024",
    end_date: null,
    location: "Remote",
    summary: null,
    company_domain: null,
    order_index: 1,
  },
];

describe("WorkHistorySection", () => {
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  it("renders section title with count", () => {
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );
    expect(screen.getByText("Work History (2)")).toBeInTheDocument();
  });

  it("renders work history entries", () => {
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("StartupXYZ")).toBeInTheDocument();
  });

  it("renders job titles", () => {
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
    expect(screen.getByText("Tech Lead")).toBeInTheDocument();
  });

  it("renders date ranges", () => {
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );
    expect(screen.getByText(/Jan 2020 - Dec 2023/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 2024 - Present/)).toBeInTheDocument();
  });

  it("renders location when present", () => {
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );
    expect(screen.getByText(/San Francisco, CA/)).toBeInTheDocument();
    expect(screen.getByText(/Remote/)).toBeInTheDocument();
  });

  it("shows empty state when no work history", () => {
    render(<WorkHistorySection items={[]} onUpdate={mockOnUpdate} />);
    expect(screen.getByText(/no work history yet/i)).toBeInTheDocument();
  });

  it("renders add button", () => {
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );
    expect(
      screen.getByRole("button", { name: /add work history/i }),
    ).toBeInTheDocument();
  });

  it("renders edit buttons for each entry", () => {
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );
    const editButtons = document.querySelectorAll(".lucide-pencil");
    expect(editButtons.length).toBe(2);
  });

  it("renders delete buttons for each entry", () => {
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );
    const deleteButtons = document.querySelectorAll(".lucide-trash-2");
    expect(deleteButtons.length).toBe(2);
  });

  it("shows add form when clicking add button", async () => {
    const user = userEvent.setup();
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );

    await user.click(screen.getByRole("button", { name: /add work history/i }));

    expect(screen.getByText("Company *")).toBeInTheDocument();
    expect(screen.getByText("Title *")).toBeInTheDocument();
    expect(screen.getByText("Start Date *")).toBeInTheDocument();
    expect(screen.getByText("End Date")).toBeInTheDocument();
  });

  it("shows save and cancel buttons in add form", async () => {
    const user = userEvent.setup();
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );

    await user.click(screen.getByRole("button", { name: /add work history/i }));

    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("cancels add form", async () => {
    const user = userEvent.setup();
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );

    await user.click(screen.getByRole("button", { name: /add work history/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(
      screen.getByRole("button", { name: /add work history/i }),
    ).toBeInTheDocument();
  });

  it("shows delete confirmation dialog", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );

    const deleteButtons = screen.getAllByRole("button");
    const deleteButton = deleteButtons.find((btn) =>
      btn.querySelector(".lucide-trash-2"),
    );
    if (deleteButton) {
      await user.click(deleteButton);
    }

    expect(screen.getByText("Delete work history?")).toBeInTheDocument();
  });

  it("collapses section", async () => {
    const user = userEvent.setup();
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );

    const trigger = screen.getByText("Work History (2)").closest("button");
    if (trigger) {
      await user.click(trigger);
    }

    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
  });

  it("shows company logo when domain is provided", () => {
    render(
      <WorkHistorySection items={mockWorkHistory} onUpdate={mockOnUpdate} />,
    );
    const logo = document.querySelector('img[src*="acme.com"]');
    expect(logo).toBeInTheDocument();
  });
});
