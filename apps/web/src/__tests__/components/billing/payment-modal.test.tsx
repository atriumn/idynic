import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentModal } from "@/components/billing/payment-modal";

// Mock Stripe
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-elements">{children}</div>
  ),
  PaymentElement: () => (
    <div data-testid="payment-element">Payment Element</div>
  ),
  useStripe: () => null,
  useElements: () => null,
}));

describe("PaymentModal", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    clientSecret: "pi_test_secret",
    plan: "pro" as const,
    onSuccess: vi.fn(),
    onError: vi.fn(),
  };

  it("returns null when no client secret", () => {
    const { container } = render(
      <PaymentModal {...defaultProps} clientSecret={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog with pro plan details", () => {
    render(<PaymentModal {...defaultProps} />);
    expect(screen.getByText("Subscribe to Pro")).toBeInTheDocument();
    expect(screen.getByText(/\$100\/year/)).toBeInTheDocument();
  });

  it("renders dialog with job_search plan details", () => {
    render(<PaymentModal {...defaultProps} plan="job_search" />);
    expect(screen.getByText("Subscribe to Job Search")).toBeInTheDocument();
    expect(screen.getByText(/\$50 for 3 months/)).toBeInTheDocument();
  });

  it("renders Stripe Elements wrapper", () => {
    render(<PaymentModal {...defaultProps} />);
    expect(screen.getByTestId("stripe-elements")).toBeInTheDocument();
  });

  it("renders PaymentElement", () => {
    render(<PaymentModal {...defaultProps} />);
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
  });

  it("renders Subscribe button", () => {
    render(<PaymentModal {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Subscribe" }),
    ).toBeInTheDocument();
  });

  it("disables Subscribe button when stripe not loaded", () => {
    render(<PaymentModal {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Subscribe" })).toBeDisabled();
  });
});
