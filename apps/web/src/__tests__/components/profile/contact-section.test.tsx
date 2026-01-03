import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactSection } from "@/components/profile/contact-section";

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

const mockContact = {
  name: "John Doe",
  email: "john@example.com",
  phone: "555-1234",
  location: "San Francisco, CA",
  linkedin: "johndoe",
  github: "johndoe",
  website: "https://johndoe.com",
};

describe("ContactSection", () => {
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockContact),
    });
  });

  it("renders section title", () => {
    render(<ContactSection contact={mockContact} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("Contact Info")).toBeInTheDocument();
  });

  it("renders edit button", () => {
    render(<ContactSection contact={mockContact} onUpdate={mockOnUpdate} />);
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("renders contact fields", () => {
    render(<ContactSection contact={mockContact} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("555-1234")).toBeInTheDocument();
    expect(screen.getByText("San Francisco, CA")).toBeInTheDocument();
  });

  it("renders field labels", () => {
    render(<ContactSection contact={mockContact} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
  });

  it("shows Not set for empty fields", () => {
    render(
      <ContactSection contact={{ name: "John" }} onUpdate={mockOnUpdate} />,
    );
    const notSetElements = screen.getAllByText("Not set");
    expect(notSetElements.length).toBeGreaterThan(0);
  });

  it("renders LinkedIn as link", () => {
    render(<ContactSection contact={mockContact} onUpdate={mockOnUpdate} />);
    const linkedinLink = screen.getByRole("link", { name: /linkedin.com/i });
    expect(linkedinLink).toHaveAttribute(
      "href",
      "https://linkedin.com/in/johndoe",
    );
  });

  it("renders GitHub as link", () => {
    render(<ContactSection contact={mockContact} onUpdate={mockOnUpdate} />);
    const githubLink = screen.getByRole("link", { name: /github.com/i });
    expect(githubLink).toHaveAttribute("href", "https://github.com/johndoe");
  });

  it("enters edit mode on button click", async () => {
    const user = userEvent.setup();
    render(<ContactSection contact={mockContact} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("shows save and cancel buttons in edit mode", async () => {
    const user = userEvent.setup();
    render(<ContactSection contact={mockContact} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("cancels edit mode", async () => {
    const user = userEvent.setup();
    render(<ContactSection contact={mockContact} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("saves contact via API", async () => {
    const user = userEvent.setup();
    render(<ContactSection contact={mockContact} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/profile/contact",
        expect.objectContaining({
          method: "PATCH",
        }),
      );
    });
  });

  it("collapses section", async () => {
    const user = userEvent.setup();
    render(<ContactSection contact={mockContact} onUpdate={mockOnUpdate} />);

    const trigger = screen.getByText("Contact Info").closest("button");
    if (trigger) {
      await user.click(trigger);
    }

    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });
});
