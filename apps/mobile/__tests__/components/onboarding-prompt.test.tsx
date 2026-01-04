import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { OnboardingPrompt } from "../../components/onboarding-prompt";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";

// Mock lucide-react-native icons
jest.mock("lucide-react-native", () => ({
  X: () => "X",
  ArrowRight: () => "ArrowRight",
}));

// Mock the shared hook
jest.mock("@idynic/shared", () => ({
  useOnboardingProgress: jest.fn(),
  ONBOARDING_PROMPTS: {
    after_resume_upload: {
      title: "Resume processed!",
      message: "We found claims about your skills and experience.",
      primaryAction: {
        label: "Explore Claims",
        route: "/identity",
      },
      secondaryAction: {
        label: "Add Opportunity",
        route: "/add-opportunity",
      },
    },
    after_story_added: {
      title: "Story added!",
      message: "Your claims are getting stronger.",
      primaryAction: {
        label: "Add Another Story",
        route: "/add-story",
      },
    },
    after_opportunity_added: {
      title: "Opportunity tracked!",
      message: "Generate a tailored profile to see how your experience aligns.",
      primaryAction: {
        label: "Generate Profile",
        route: null,
        action: "generate_tailored_profile",
      },
    },
    after_profile_tailored: {
      title: "Profile ready!",
      message: "Share your tailored profile with a recruiter.",
      primaryAction: {
        label: "Share Profile",
        action: "share_profile",
      },
      secondaryAction: {
        label: "Download PDF",
        action: "download_pdf",
      },
    },
  },
}));

// Get the mocked hook
import { useOnboardingProgress } from "@idynic/shared";
const mockUseOnboardingProgress = useOnboardingProgress as jest.Mock;

describe("OnboardingPrompt", () => {
  const mockDismissPrompt = jest.fn();
  const mockGetPrompt = jest.fn();
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset router mock
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
    });

    // Default mock implementation
    mockUseOnboardingProgress.mockReturnValue({
      isLoading: false,
      getPrompt: mockGetPrompt,
      dismissPrompt: mockDismissPrompt,
      shouldShowPrompt: jest.fn(() => true),
    });
  });

  describe("loading state", () => {
    it("returns null when loading", () => {
      mockUseOnboardingProgress.mockReturnValue({
        isLoading: true,
        getPrompt: mockGetPrompt,
        dismissPrompt: mockDismissPrompt,
      });

      const { toJSON } = render(
        <OnboardingPrompt promptKey="after_resume_upload" />,
      );
      expect(toJSON()).toBeNull();
    });
  });

  describe("when prompt is not available", () => {
    it("returns null when getPrompt returns null", () => {
      mockGetPrompt.mockReturnValue(null);

      const { toJSON } = render(
        <OnboardingPrompt promptKey="after_resume_upload" />,
      );
      expect(toJSON()).toBeNull();
    });
  });

  describe("rendering prompts", () => {
    it("renders prompt with title and message", () => {
      mockGetPrompt.mockReturnValue({
        title: "Resume processed!",
        message: "We found claims about your skills and experience.",
        primaryAction: {
          label: "Explore Claims",
          route: "/identity",
        },
      });

      render(<OnboardingPrompt promptKey="after_resume_upload" />);

      expect(screen.getByText("Resume processed!")).toBeTruthy();
      expect(
        screen.getByText("We found claims about your skills and experience."),
      ).toBeTruthy();
    });

    it("renders primary action button", () => {
      mockGetPrompt.mockReturnValue({
        title: "Resume processed!",
        message: "We found claims about your skills and experience.",
        primaryAction: {
          label: "Explore Claims",
          route: "/identity",
        },
      });

      render(<OnboardingPrompt promptKey="after_resume_upload" />);

      expect(screen.getByText("Explore Claims")).toBeTruthy();
    });

    it("renders secondary action button when present", () => {
      mockGetPrompt.mockReturnValue({
        title: "Resume processed!",
        message: "We found claims about your skills and experience.",
        primaryAction: {
          label: "Explore Claims",
          route: "/identity",
        },
        secondaryAction: {
          label: "Add Opportunity",
          route: "/add-opportunity",
        },
      });

      render(<OnboardingPrompt promptKey="after_resume_upload" />);

      expect(screen.getByText("Add Opportunity")).toBeTruthy();
    });

    it("renders dismiss button", () => {
      mockGetPrompt.mockReturnValue({
        title: "Test prompt",
        message: "Test message",
        primaryAction: { label: "Action", route: "/test" },
      });

      render(<OnboardingPrompt promptKey="after_resume_upload" />);

      expect(screen.getByLabelText("Dismiss")).toBeTruthy();
    });
  });

  describe("interactions", () => {
    it("calls dismissPrompt when dismiss button is pressed", async () => {
      mockGetPrompt.mockReturnValue({
        title: "Test prompt",
        message: "Test message",
        primaryAction: { label: "Action", route: "/test" },
      });

      render(<OnboardingPrompt promptKey="after_resume_upload" />);

      fireEvent.press(screen.getByLabelText("Dismiss"));

      expect(mockDismissPrompt).toHaveBeenCalledWith("after_resume_upload");
    });

    it("calls onDismiss callback when dismiss button is pressed", async () => {
      const mockOnDismiss = jest.fn();
      mockGetPrompt.mockReturnValue({
        title: "Test prompt",
        message: "Test message",
        primaryAction: { label: "Action", route: "/test" },
      });

      render(
        <OnboardingPrompt
          promptKey="after_resume_upload"
          onDismiss={mockOnDismiss}
        />,
      );

      fireEvent.press(screen.getByLabelText("Dismiss"));

      expect(mockOnDismiss).toHaveBeenCalled();
    });

    it("navigates to route when primary action with route is pressed", async () => {
      mockGetPrompt.mockReturnValue({
        title: "Resume processed!",
        message: "We found claims about your skills and experience.",
        primaryAction: {
          label: "Explore Claims",
          route: "/identity",
        },
      });

      render(<OnboardingPrompt promptKey="after_resume_upload" />);

      fireEvent.press(screen.getByText("Explore Claims"));

      expect(mockPush).toHaveBeenCalledWith("/identity");
      expect(mockDismissPrompt).toHaveBeenCalledWith("after_resume_upload");
    });

    it("calls onAction when primary action with action is pressed", async () => {
      const mockOnAction = jest.fn();
      mockGetPrompt.mockReturnValue({
        title: "Opportunity tracked!",
        message: "Generate a tailored profile.",
        primaryAction: {
          label: "Generate Profile",
          route: null,
          action: "generate_tailored_profile",
        },
      });

      render(
        <OnboardingPrompt
          promptKey="after_opportunity_added"
          onAction={mockOnAction}
        />,
      );

      fireEvent.press(screen.getByText("Generate Profile"));

      expect(mockOnAction).toHaveBeenCalledWith("generate_tailored_profile");
      expect(mockDismissPrompt).toHaveBeenCalledWith("after_opportunity_added");
    });

    it("navigates to route when secondary action with route is pressed", async () => {
      mockGetPrompt.mockReturnValue({
        title: "Resume processed!",
        message: "We found claims.",
        primaryAction: { label: "Primary", route: "/primary" },
        secondaryAction: {
          label: "Add Opportunity",
          route: "/add-opportunity",
        },
      });

      render(<OnboardingPrompt promptKey="after_resume_upload" />);

      fireEvent.press(screen.getByText("Add Opportunity"));

      expect(mockPush).toHaveBeenCalledWith("/add-opportunity");
      expect(mockDismissPrompt).toHaveBeenCalledWith("after_resume_upload");
    });

    it("calls onAction when secondary action with action is pressed", async () => {
      const mockOnAction = jest.fn();
      mockGetPrompt.mockReturnValue({
        title: "Profile ready!",
        message: "Share your profile.",
        primaryAction: { label: "Share Profile", action: "share_profile" },
        secondaryAction: { label: "Download PDF", action: "download_pdf" },
      });

      render(
        <OnboardingPrompt
          promptKey="after_profile_tailored"
          onAction={mockOnAction}
        />,
      );

      fireEvent.press(screen.getByText("Download PDF"));

      expect(mockOnAction).toHaveBeenCalledWith("download_pdf");
      expect(mockDismissPrompt).toHaveBeenCalledWith("after_profile_tailored");
    });
  });
});
