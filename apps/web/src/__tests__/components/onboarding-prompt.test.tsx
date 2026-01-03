import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingPrompt } from "@/components/onboarding-prompt";

// Mock the hooks and modules
const mockDismissPrompt = vi.fn();
const mockGetPrompt = vi.fn();
const mockPush = vi.fn();

vi.mock("@idynic/shared", () => ({
  useOnboardingProgress: () => ({
    getPrompt: mockGetPrompt,
    dismissPrompt: mockDismissPrompt,
    isLoading: false,
  }),
}));

vi.mock("@/lib/storage-adapter", () => ({
  webStorageAdapter: {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockPrompt = {
  title: "Great job!",
  message: "You uploaded your resume. Next, add an opportunity.",
  primaryAction: {
    label: "Add Opportunity",
    webRoute: "/opportunities/new",
  },
  secondaryAction: {
    label: "Skip for now",
    action: "skip",
  },
};

describe("OnboardingPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPrompt.mockReturnValue(mockPrompt);
  });

  it("renders prompt title and message", () => {
    render(<OnboardingPrompt promptKey="after_resume_upload" />);

    expect(screen.getByText("Great job!")).toBeInTheDocument();
    expect(screen.getByText(/you uploaded your resume/i)).toBeInTheDocument();
  });

  it("renders primary action button", () => {
    render(<OnboardingPrompt promptKey="after_resume_upload" />);

    expect(
      screen.getByRole("button", { name: /add opportunity/i }),
    ).toBeInTheDocument();
  });

  it("renders secondary action button when provided", () => {
    render(<OnboardingPrompt promptKey="after_resume_upload" />);

    expect(
      screen.getByRole("button", { name: /skip for now/i }),
    ).toBeInTheDocument();
  });

  it("renders dismiss button", () => {
    render(<OnboardingPrompt promptKey="after_resume_upload" />);

    expect(screen.getByLabelText("Dismiss")).toBeInTheDocument();
  });

  it("dismisses prompt when dismiss button clicked", async () => {
    const user = userEvent.setup();
    render(<OnboardingPrompt promptKey="after_resume_upload" />);

    await user.click(screen.getByLabelText("Dismiss"));

    expect(mockDismissPrompt).toHaveBeenCalledWith("after_resume_upload");
  });

  it("navigates and dismisses when primary action with route clicked", async () => {
    const user = userEvent.setup();
    render(<OnboardingPrompt promptKey="after_resume_upload" />);

    await user.click(screen.getByRole("button", { name: /add opportunity/i }));

    expect(mockPush).toHaveBeenCalledWith("/opportunities/new");
    expect(mockDismissPrompt).toHaveBeenCalledWith("after_resume_upload");
  });

  it("calls onAction when primary action has action instead of route", async () => {
    mockGetPrompt.mockReturnValue({
      ...mockPrompt,
      primaryAction: {
        label: "Generate Profile",
        action: "generate_tailored_profile",
      },
    });
    const onAction = vi.fn();
    const user = userEvent.setup();

    render(
      <OnboardingPrompt
        promptKey="after_opportunity_added"
        onAction={onAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: /generate profile/i }));

    expect(onAction).toHaveBeenCalledWith("generate_tailored_profile");
  });

  it("calls onAction when secondary action clicked", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();

    render(
      <OnboardingPrompt promptKey="after_resume_upload" onAction={onAction} />,
    );

    await user.click(screen.getByRole("button", { name: /skip for now/i }));

    expect(onAction).toHaveBeenCalledWith("skip");
  });

  it("calls onDismiss callback when dismissed", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();

    render(
      <OnboardingPrompt
        promptKey="after_resume_upload"
        onDismiss={onDismiss}
      />,
    );

    await user.click(screen.getByLabelText("Dismiss"));

    expect(onDismiss).toHaveBeenCalled();
  });

  it("returns null when no prompt found", () => {
    mockGetPrompt.mockReturnValue(null);

    const { container } = render(
      <OnboardingPrompt
        promptKey={"nonexistent_key" as "after_resume_upload"}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("does not render secondary button when not provided", () => {
    mockGetPrompt.mockReturnValue({
      ...mockPrompt,
      secondaryAction: undefined,
    });

    render(<OnboardingPrompt promptKey="after_resume_upload" />);

    expect(
      screen.queryByRole("button", { name: /skip for now/i }),
    ).not.toBeInTheDocument();
  });
});
