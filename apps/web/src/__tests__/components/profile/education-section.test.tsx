import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EducationSection } from "@/components/profile/education-section";

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

const mockEducation = [
  {
    id: "edu-1",
    text: "Stanford University",
    context: {
      school: "Stanford University",
      degree: "Bachelor of Science",
      field: "Computer Science",
      start_date: "2014",
      end_date: "2018",
    },
  },
  {
    id: "edu-2",
    text: "MIT",
    context: {
      school: "MIT",
      degree: "Master of Science",
      field: "AI",
      start_date: "2018",
      end_date: "2020",
    },
  },
];

describe("EducationSection", () => {
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  it("renders section title with count", () => {
    render(<EducationSection items={mockEducation} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("Education (2)")).toBeInTheDocument();
  });

  it("renders education entries", () => {
    render(<EducationSection items={mockEducation} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("Stanford University")).toBeInTheDocument();
    expect(screen.getByText("MIT")).toBeInTheDocument();
  });

  it("renders degree and field", () => {
    render(<EducationSection items={mockEducation} onUpdate={mockOnUpdate} />);
    expect(
      screen.getByText(/Bachelor of Science.*Computer Science/),
    ).toBeInTheDocument();
  });

  it("renders date range", () => {
    render(<EducationSection items={mockEducation} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("2014 - 2018")).toBeInTheDocument();
  });

  it("shows empty state when no education", () => {
    render(<EducationSection items={[]} onUpdate={mockOnUpdate} />);
    expect(screen.getByText(/no education history yet/i)).toBeInTheDocument();
  });

  it("renders add button", () => {
    render(<EducationSection items={mockEducation} onUpdate={mockOnUpdate} />);
    expect(
      screen.getByRole("button", { name: /add education/i }),
    ).toBeInTheDocument();
  });

  it("renders edit buttons for each entry", () => {
    render(<EducationSection items={mockEducation} onUpdate={mockOnUpdate} />);
    const editButtons = document.querySelectorAll(".lucide-pencil");
    expect(editButtons.length).toBe(2);
  });

  it("renders delete buttons for each entry", () => {
    render(<EducationSection items={mockEducation} onUpdate={mockOnUpdate} />);
    const deleteButtons = document.querySelectorAll(".lucide-trash-2");
    expect(deleteButtons.length).toBe(2);
  });

  it("shows add form when clicking add button", async () => {
    const user = userEvent.setup();
    render(<EducationSection items={mockEducation} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /add education/i }));

    // Labels don't use htmlFor, check for text content instead
    expect(screen.getByText("School *")).toBeInTheDocument();
    expect(screen.getByText("Degree")).toBeInTheDocument();
    expect(screen.getByText("Field of Study")).toBeInTheDocument();
  });

  it("shows cancel button in add form", async () => {
    const user = userEvent.setup();
    render(<EducationSection items={mockEducation} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /add education/i }));

    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("cancels add form", async () => {
    const user = userEvent.setup();
    render(<EducationSection items={mockEducation} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /add education/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(
      screen.getByRole("button", { name: /add education/i }),
    ).toBeInTheDocument();
  });

  it("shows delete confirmation dialog", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<EducationSection items={mockEducation} onUpdate={mockOnUpdate} />);

    const deleteButtons = screen.getAllByRole("button");
    const deleteButton = deleteButtons.find((btn) =>
      btn.querySelector(".lucide-trash-2"),
    );
    if (deleteButton) {
      await user.click(deleteButton);
    }

    expect(screen.getByText("Delete education entry?")).toBeInTheDocument();
  });

  it("collapses section", async () => {
    const user = userEvent.setup();
    render(<EducationSection items={mockEducation} onUpdate={mockOnUpdate} />);

    const trigger = screen.getByText("Education (2)").closest("button");
    if (trigger) {
      await user.click(trigger);
    }

    expect(screen.queryByText("Stanford University")).not.toBeInTheDocument();
  });
});
