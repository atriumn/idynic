import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VenturesSection } from "@/components/profile/ventures-section";

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

const mockVentures = [
  {
    id: "venture-1",
    company: "My Startup",
    title: "Founder",
    start_date: "Jan 2022",
    end_date: null,
    location: null,
    summary: "Building something awesome",
    company_domain: "mystartup.com",
    order_index: 0,
  },
  {
    id: "venture-2",
    company: "Side Project",
    title: "Creator",
    start_date: "Mar 2021",
    end_date: "Acquired",
    location: null,
    summary: null,
    company_domain: null,
    order_index: 1,
  },
];

describe("VenturesSection", () => {
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  it("renders section title with count", () => {
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("Ventures & Projects (2)")).toBeInTheDocument();
  });

  it("renders venture entries", () => {
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("My Startup")).toBeInTheDocument();
    expect(screen.getByText("Side Project")).toBeInTheDocument();
  });

  it("renders roles", () => {
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("Founder")).toBeInTheDocument();
    expect(screen.getByText("Creator")).toBeInTheDocument();
  });

  it("renders date ranges with Active for null end_date", () => {
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);
    expect(screen.getByText(/Jan 2022 - Active/)).toBeInTheDocument();
    expect(screen.getByText(/Mar 2021 - Acquired/)).toBeInTheDocument();
  });

  it("renders summary when present", () => {
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("Building something awesome")).toBeInTheDocument();
  });

  it("shows empty state when no ventures", () => {
    render(<VenturesSection items={[]} onUpdate={mockOnUpdate} />);
    expect(
      screen.getByText(/no ventures or side projects yet/i),
    ).toBeInTheDocument();
  });

  it("renders add button", () => {
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);
    expect(
      screen.getByRole("button", { name: /add venture/i }),
    ).toBeInTheDocument();
  });

  it("renders edit buttons for each entry", () => {
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);
    const editButtons = document.querySelectorAll(".lucide-pencil");
    expect(editButtons.length).toBe(2);
  });

  it("renders delete buttons for each entry", () => {
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);
    const deleteButtons = document.querySelectorAll(".lucide-trash-2");
    expect(deleteButtons.length).toBe(2);
  });

  it("shows add form when clicking add button", async () => {
    const user = userEvent.setup();
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /add venture/i }));

    expect(screen.getByText("Name *")).toBeInTheDocument();
    expect(screen.getByText("Role *")).toBeInTheDocument();
    expect(screen.getByText("Start Date *")).toBeInTheDocument();
    expect(screen.getByText("End Date / Status")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("shows save and cancel buttons in add form", async () => {
    const user = userEvent.setup();
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /add venture/i }));

    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("cancels add form", async () => {
    const user = userEvent.setup();
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /add venture/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(
      screen.getByRole("button", { name: /add venture/i }),
    ).toBeInTheDocument();
  });

  it("shows delete confirmation dialog", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);

    const deleteButtons = screen.getAllByRole("button");
    const deleteButton = deleteButtons.find((btn) =>
      btn.querySelector(".lucide-trash-2"),
    );
    if (deleteButton) {
      await user.click(deleteButton);
    }

    expect(screen.getByText("Delete venture?")).toBeInTheDocument();
  });

  it("collapses section", async () => {
    const user = userEvent.setup();
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);

    const trigger = screen
      .getByText("Ventures & Projects (2)")
      .closest("button");
    if (trigger) {
      await user.click(trigger);
    }

    expect(screen.queryByText("My Startup")).not.toBeInTheDocument();
  });

  it("shows venture logo when domain is provided", () => {
    render(<VenturesSection items={mockVentures} onUpdate={mockOnUpdate} />);
    const logo = document.querySelector('img[src*="mystartup.com"]');
    expect(logo).toBeInTheDocument();
  });
});
