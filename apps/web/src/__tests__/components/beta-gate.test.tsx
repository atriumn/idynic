import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BetaGate } from "@/components/beta-gate";

// Mock Supabase client
const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
    rpc: mockRpc,
  }),
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("BetaGate", () => {
  const mockOnAccessGranted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
  });

  it("renders invite code input", () => {
    render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

    expect(screen.getByPlaceholderText(/invite code/i)).toBeInTheDocument();
  });

  it("renders Activate button", () => {
    render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

    expect(
      screen.getByRole("button", { name: /activate/i }),
    ).toBeInTheDocument();
  });

  it("renders title and description", () => {
    render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

    expect(screen.getByText("Almost there!")).toBeInTheDocument();
    expect(screen.getByText(/enter your invite code/i)).toBeInTheDocument();
  });

  it("shows error when submitting empty code", async () => {
    const user = userEvent.setup();
    render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

    await user.click(screen.getByRole("button", { name: /activate/i }));

    expect(
      screen.getByText(/please enter an invite code/i),
    ).toBeInTheDocument();
  });

  it("converts input to uppercase", async () => {
    const user = userEvent.setup();
    render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

    const input = screen.getByPlaceholderText(/invite code/i);
    await user.type(input, "beta123");

    expect(input).toHaveValue("BETA123");
  });

  it("validates code and calls onAccessGranted on success", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null }) // check_beta_code
      .mockResolvedValueOnce({ error: null }); // consume_beta_code

    const user = userEvent.setup();
    render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

    await user.type(screen.getByPlaceholderText(/invite code/i), "VALID123");
    await user.click(screen.getByRole("button", { name: /activate/i }));

    await waitFor(() => {
      expect(mockOnAccessGranted).toHaveBeenCalled();
    });
  });

  it("shows error for invalid code", async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null }); // check_beta_code returns false

    const user = userEvent.setup();
    render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

    await user.type(screen.getByPlaceholderText(/invite code/i), "INVALID");
    await user.click(screen.getByRole("button", { name: /activate/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/invalid or expired invite code/i),
      ).toBeInTheDocument();
    });
  });

  it("shows loading state while validating", async () => {
    mockRpc.mockImplementation(() => new Promise(() => {})); // Never resolves

    const user = userEvent.setup();
    render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

    await user.type(screen.getByPlaceholderText(/invite code/i), "CODE");
    await user.click(screen.getByRole("button", { name: /activate/i }));

    expect(screen.getByText(/activating/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /activating/i })).toBeDisabled();
  });

  it("handles sign out", async () => {
    const user = userEvent.setup();
    render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

    await user.click(screen.getByText(/sign out/i));

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("shows error when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const user = userEvent.setup();
    render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

    await user.type(screen.getByPlaceholderText(/invite code/i), "CODE");
    await user.click(screen.getByRole("button", { name: /activate/i }));

    await waitFor(() => {
      expect(screen.getByText(/not authenticated/i)).toBeInTheDocument();
    });
  });

  it("shows error when code validation fails", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "Error" } });

    const user = userEvent.setup();
    render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

    await user.type(screen.getByPlaceholderText(/invite code/i), "CODE");
    await user.click(screen.getByRole("button", { name: /activate/i }));

    await waitFor(() => {
      expect(screen.getByText(/unable to validate code/i)).toBeInTheDocument();
    });
  });

  it("submits on Enter key", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ error: null });

    const user = userEvent.setup();
    render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

    const input = screen.getByPlaceholderText(/invite code/i);
    await user.type(input, "CODE{Enter}");

    await waitFor(() => {
      expect(mockOnAccessGranted).toHaveBeenCalled();
    });
  });

  it("renders waitlist info", () => {
    render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

    expect(screen.getByText(/don't have a code/i)).toBeInTheDocument();
  });
});
