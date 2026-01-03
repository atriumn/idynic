import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkillsSection } from "@/components/profile/skills-section";

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

const mockSkills = [
  {
    id: "skill-1",
    label: "React",
    description: null,
    confidence: 0.9,
    source: "extracted",
  },
  {
    id: "skill-2",
    label: "TypeScript",
    description: null,
    confidence: 0.85,
    source: "extracted",
  },
  {
    id: "skill-3",
    label: "Python",
    description: null,
    confidence: 0.8,
    source: "manual",
  },
];

describe("SkillsSection", () => {
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  it("renders section title with count", () => {
    render(<SkillsSection items={mockSkills} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("Skills (3)")).toBeInTheDocument();
  });

  it("renders edit button", () => {
    render(<SkillsSection items={mockSkills} onUpdate={mockOnUpdate} />);
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("renders extracted skills", () => {
    render(<SkillsSection items={mockSkills} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("renders manual skills", () => {
    render(<SkillsSection items={mockSkills} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("Python")).toBeInTheDocument();
  });

  it("shows source labels", () => {
    render(<SkillsSection items={mockSkills} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("From your resume")).toBeInTheDocument();
    expect(screen.getByText("Manually added")).toBeInTheDocument();
  });

  it("shows empty state when no skills", () => {
    render(<SkillsSection items={[]} onUpdate={mockOnUpdate} />);
    expect(screen.getByText(/no skills yet/i)).toBeInTheDocument();
  });

  it("shows add input when editing", async () => {
    const user = userEvent.setup();
    render(<SkillsSection items={mockSkills} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.getByPlaceholderText(/add a skill/i)).toBeInTheDocument();
  });

  it("toggles edit mode", async () => {
    const user = userEvent.setup();
    render(<SkillsSection items={mockSkills} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByText("Done")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("adds new skill via API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ id: "skill-4", label: "Go", source: "manual" }),
    });

    const user = userEvent.setup();
    render(<SkillsSection items={mockSkills} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.type(screen.getByPlaceholderText(/add a skill/i), "Go");

    const addButtons = screen.getAllByRole("button");
    const addButton = addButtons.find((btn) =>
      btn.querySelector(".lucide-plus"),
    );
    if (addButton) {
      await user.click(addButton);
    }

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/profile/skills",
        expect.any(Object),
      );
    });
  });

  it("shows delete button when editing", async () => {
    const user = userEvent.setup();
    render(<SkillsSection items={mockSkills} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /edit/i }));

    // Should show X icons for deletion
    const deleteButtons = document.querySelectorAll(".lucide-x");
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it("collapses section", async () => {
    const user = userEvent.setup();
    render(<SkillsSection items={mockSkills} onUpdate={mockOnUpdate} />);

    // Click the collapse trigger (chevron)
    const trigger = screen.getByText("Skills (3)").closest("button");
    if (trigger) {
      await user.click(trigger);
    }

    // Content should be hidden
    expect(screen.queryByText("From your resume")).not.toBeInTheDocument();
  });
});
