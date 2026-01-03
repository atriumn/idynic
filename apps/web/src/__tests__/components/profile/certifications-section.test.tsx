import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CertificationsSection } from "@/components/profile/certifications-section";

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

const mockCertifications = [
  {
    id: "cert-1",
    text: "AWS Solutions Architect",
    context: {
      issuer: "Amazon Web Services",
      date: "Jan 2023",
    },
  },
  {
    id: "cert-2",
    text: "Kubernetes Administrator",
    context: {
      issuer: "CNCF",
      date: "Mar 2022",
    },
  },
];

describe("CertificationsSection", () => {
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
      <CertificationsSection
        items={mockCertifications}
        onUpdate={mockOnUpdate}
      />,
    );
    expect(screen.getByText("Certifications (2)")).toBeInTheDocument();
  });

  it("renders certification names", () => {
    render(
      <CertificationsSection
        items={mockCertifications}
        onUpdate={mockOnUpdate}
      />,
    );
    expect(screen.getByText("AWS Solutions Architect")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes Administrator")).toBeInTheDocument();
  });

  it("renders issuer and date", () => {
    render(
      <CertificationsSection
        items={mockCertifications}
        onUpdate={mockOnUpdate}
      />,
    );
    expect(
      screen.getByText(/Amazon Web Services.*Jan 2023/),
    ).toBeInTheDocument();
  });

  it("shows empty state when no certifications", () => {
    render(<CertificationsSection items={[]} onUpdate={mockOnUpdate} />);
    expect(screen.getByText(/no certifications yet/i)).toBeInTheDocument();
  });

  it("renders add button", () => {
    render(
      <CertificationsSection
        items={mockCertifications}
        onUpdate={mockOnUpdate}
      />,
    );
    expect(
      screen.getByRole("button", { name: /add certification/i }),
    ).toBeInTheDocument();
  });

  it("renders edit buttons", () => {
    render(
      <CertificationsSection
        items={mockCertifications}
        onUpdate={mockOnUpdate}
      />,
    );
    const editButtons = document.querySelectorAll(".lucide-pencil");
    expect(editButtons.length).toBe(2);
  });

  it("renders delete buttons", () => {
    render(
      <CertificationsSection
        items={mockCertifications}
        onUpdate={mockOnUpdate}
      />,
    );
    const deleteButtons = document.querySelectorAll(".lucide-trash-2");
    expect(deleteButtons.length).toBe(2);
  });

  it("shows add form when clicking add button", async () => {
    const user = userEvent.setup();
    render(
      <CertificationsSection
        items={mockCertifications}
        onUpdate={mockOnUpdate}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /add certification/i }),
    );

    // Labels don't use htmlFor, check for text content instead
    expect(screen.getByText("Certification Name *")).toBeInTheDocument();
    expect(screen.getByText("Issuer")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
  });

  it("shows save and cancel buttons in add form", async () => {
    const user = userEvent.setup();
    render(
      <CertificationsSection
        items={mockCertifications}
        onUpdate={mockOnUpdate}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /add certification/i }),
    );

    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("cancels add form", async () => {
    const user = userEvent.setup();
    render(
      <CertificationsSection
        items={mockCertifications}
        onUpdate={mockOnUpdate}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /add certification/i }),
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(
      screen.getByRole("button", { name: /add certification/i }),
    ).toBeInTheDocument();
  });

  it("shows delete confirmation dialog", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <CertificationsSection
        items={mockCertifications}
        onUpdate={mockOnUpdate}
      />,
    );

    const deleteButtons = screen.getAllByRole("button");
    const deleteButton = deleteButtons.find((btn) =>
      btn.querySelector(".lucide-trash-2"),
    );
    if (deleteButton) {
      await user.click(deleteButton);
    }

    expect(screen.getByText("Delete certification?")).toBeInTheDocument();
  });

  it("collapses section", async () => {
    const user = userEvent.setup();
    render(
      <CertificationsSection
        items={mockCertifications}
        onUpdate={mockOnUpdate}
      />,
    );

    const trigger = screen.getByText("Certifications (2)").closest("button");
    if (trigger) {
      await user.click(trigger);
    }

    expect(
      screen.queryByText("AWS Solutions Architect"),
    ).not.toBeInTheDocument();
  });
});
