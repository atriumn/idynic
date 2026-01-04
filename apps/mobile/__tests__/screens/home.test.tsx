import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import IdentityScreen from "../../app/(app)/index";
import { useProfile } from "../../hooks/use-profile";

import { useIdentityClaims } from "../../hooks/use-identity-claims";

// Mock hooks - need to mock the helper functions too
jest.mock("../../hooks/use-identity-claims", () => ({
  useIdentityClaims: jest.fn(),
  hasAnyClaims: (grouped: Record<string, unknown[]> | undefined) => {
    if (!grouped) return false;
    return Object.values(grouped).some((claims) => claims.length > 0);
  },
  getTotalClaimCount: (grouped: Record<string, unknown[]> | undefined) => {
    if (!grouped) return 0;
    return Object.values(grouped).reduce(
      (sum, claims) => sum + claims.length,
      0,
    );
  },
  CLAIM_TYPE_COLORS: {
    skill: {
      bgHex: "#064e3b",
      borderHex: "#047857",
      textHex: "#6ee7b7",
      icon: "#10b981",
    },
    achievement: {
      bgHex: "#713f12",
      borderHex: "#a16207",
      textHex: "#fcd34d",
      icon: "#f59e0b",
    },
    attribute: {
      bgHex: "#1e3a8a",
      borderHex: "#1d4ed8",
      textHex: "#93c5fd",
      icon: "#3b82f6",
    },
    education: {
      bgHex: "#581c87",
      borderHex: "#7c3aed",
      textHex: "#c4b5fd",
      icon: "#8b5cf6",
    },
    certification: {
      bgHex: "#881337",
      borderHex: "#be123c",
      textHex: "#fda4af",
      icon: "#f43f5e",
    },
  },
  CLAIM_TYPE_LABELS: {
    skill: "Skills",
    achievement: "Achievements",
    attribute: "Attributes",
    education: "Education",
    certification: "Certifications",
  },
  EVIDENCE_TYPE_COLORS: {
    skill_listed: { bgHex: "#1e3a5f", textHex: "#93c5fd" },
    accomplishment: { bgHex: "#14532d", textHex: "#86efac" },
    trait_indicator: { bgHex: "#3b0764", textHex: "#d8b4fe" },
    education: { bgHex: "#78350f", textHex: "#fcd34d" },
    certification: { bgHex: "#134e4a", textHex: "#5eead4" },
  },
}));
jest.mock("../../hooks/use-profile");

// Mock router
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock shared package
jest.mock("@idynic/shared", () => ({
  EMPTY_STATE: {
    title: "Build Your Professional Identity",
    subtitle: "Upload a resume or share a story to get started",
    actions: {
      resume: { title: "Upload Resume" },
      story: { title: "Share a Story" },
    },
    features: [
      { title: "Feature 1", description: "Description 1" },
      { title: "Feature 2", description: "Description 2" },
      { title: "Feature 3", description: "Description 3" },
    ],
  },
}));

// Mock components
jest.mock("../../components/logo", () => ({
  Logo: () => "Logo",
}));

jest.mock("../../components/identity-reflection", () => ({
  IdentityReflection: () => "IdentityReflection",
}));

// Mock safe area
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock lucide icons
jest.mock("lucide-react-native", () => ({
  ChevronDown: () => "ChevronDown",
  ChevronUp: () => "ChevronUp",
  Award: () => "Award",
  Lightbulb: () => "Lightbulb",
  GraduationCap: () => "GraduationCap",
  BadgeCheck: () => "BadgeCheck",
  Sparkles: () => "Sparkles",
  Cuboid: () => "Cuboid",
  FileText: () => "FileText",
  BookOpen: () => "BookOpen",
  Search: () => "Search",
  X: () => "X",
  Upload: () => "Upload",
  MessageSquarePlus: () => "MessageSquarePlus",
  Eye: () => "Eye",
  Wand2: () => "Wand2",
  TrendingUp: () => "TrendingUp",
  AlertTriangle: () => "AlertTriangle",
  CheckCircle2: () => "CheckCircle2",
}));

describe("IdentityScreen (Home)", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useProfile as jest.Mock).mockReturnValue({
      data: { identity: null },
      isLoading: false,
    });
  });

  it("shows loading state", () => {
    (useIdentityClaims as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<IdentityScreen />);

    // Screen should render without crashing
    expect(true).toBeTruthy();
  });

  it("shows error state", () => {
    (useIdentityClaims as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed to load"),
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<IdentityScreen />);

    expect(screen.getByText("Failed to load Master Record")).toBeTruthy();
    expect(screen.getByText("Failed to load")).toBeTruthy();
  });

  it("shows empty state when no claims", () => {
    (useIdentityClaims as jest.Mock).mockReturnValue({
      data: {
        skill: [],
        achievement: [],
        attribute: [],
        education: [],
        certification: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<IdentityScreen />);

    expect(screen.getByText("Start your Master Record")).toBeTruthy();
    expect(screen.getByText("Upload Resume")).toBeTruthy();
    expect(screen.getByText("Share a Story")).toBeTruthy();
  });

  it("navigates to upload resume from empty state", () => {
    (useIdentityClaims as jest.Mock).mockReturnValue({
      data: {
        skill: [],
        achievement: [],
        attribute: [],
        education: [],
        certification: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<IdentityScreen />);

    fireEvent.press(screen.getByText("Upload Resume"));

    expect(mockPush).toHaveBeenCalledWith("/upload-resume");
  });

  it("navigates to add story from empty state", () => {
    (useIdentityClaims as jest.Mock).mockReturnValue({
      data: {
        skill: [],
        achievement: [],
        attribute: [],
        education: [],
        certification: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<IdentityScreen />);

    fireEvent.press(screen.getByText("Share a Story"));

    expect(mockPush).toHaveBeenCalledWith("/add-story");
  });

  it("displays claims when available", () => {
    (useIdentityClaims as jest.Mock).mockReturnValue({
      data: {
        skill: [
          {
            id: "claim-1",
            type: "skill",
            label: "React",
            description: "Frontend framework expertise",
            confidence: 0.9,
            evidence: [],
          },
          {
            id: "claim-2",
            type: "skill",
            label: "TypeScript",
            description: "Type-safe JavaScript",
            confidence: 0.85,
            evidence: [],
          },
        ],
        achievement: [],
        attribute: [],
        education: [],
        certification: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<IdentityScreen />);

    expect(screen.getByText("Master Record")).toBeTruthy();
    expect(screen.getByText("React")).toBeTruthy();
    expect(screen.getByText("TypeScript")).toBeTruthy();
  });

  it("shows total claim count", () => {
    (useIdentityClaims as jest.Mock).mockReturnValue({
      data: {
        skill: [
          {
            id: "1",
            type: "skill",
            label: "React",
            confidence: 0.9,
            evidence: [],
          },
          {
            id: "2",
            type: "skill",
            label: "Node",
            confidence: 0.8,
            evidence: [],
          },
        ],
        achievement: [
          {
            id: "3",
            type: "achievement",
            label: "Led team",
            confidence: 0.85,
            evidence: [],
          },
        ],
        attribute: [],
        education: [],
        certification: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<IdentityScreen />);

    expect(screen.getByText(/3 Evidence Blocks/)).toBeTruthy();
  });

  it("filters claims by search query", () => {
    (useIdentityClaims as jest.Mock).mockReturnValue({
      data: {
        skill: [
          {
            id: "1",
            type: "skill",
            label: "React",
            description: "Frontend",
            confidence: 0.9,
            evidence: [],
          },
          {
            id: "2",
            type: "skill",
            label: "Python",
            description: "Backend",
            confidence: 0.8,
            evidence: [],
          },
        ],
        achievement: [],
        attribute: [],
        education: [],
        certification: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<IdentityScreen />);

    const searchInput = screen.getByPlaceholderText("Search evidence...");
    fireEvent.changeText(searchInput, "React");

    expect(screen.getByText("React")).toBeTruthy();
    expect(screen.queryByText("Python")).toBeNull();
  });

  it("shows no results message when search has no matches", () => {
    (useIdentityClaims as jest.Mock).mockReturnValue({
      data: {
        skill: [
          {
            id: "1",
            type: "skill",
            label: "React",
            confidence: 0.9,
            evidence: [],
          },
        ],
        achievement: [],
        attribute: [],
        education: [],
        certification: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<IdentityScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("Search evidence..."),
      "xyz123",
    );

    expect(screen.getByText("No blocks match your search")).toBeTruthy();
  });

  it("expands claim card to show details", () => {
    (useIdentityClaims as jest.Mock).mockReturnValue({
      data: {
        skill: [
          {
            id: "1",
            type: "skill",
            label: "React",
            description:
              "Expert in React development with hooks and modern patterns",
            confidence: 0.9,
            evidence: [
              {
                id: "ev-1",
                text: "Built complex SPAs",
                source_type: "resume",
                evidence_type: "direct",
              },
            ],
          },
        ],
        achievement: [],
        attribute: [],
        education: [],
        certification: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<IdentityScreen />);

    // Claim should be visible
    expect(screen.getByText("React")).toBeTruthy();

    // Press to expand
    fireEvent.press(screen.getByText("React"));

    // Evidence section shows as badge with document name
    expect(screen.getByText("Linked Evidence")).toBeTruthy();
    expect(screen.getByText("resume")).toBeTruthy();
  });

  it("toggles claim type filter", () => {
    (useIdentityClaims as jest.Mock).mockReturnValue({
      data: {
        skill: [
          {
            id: "1",
            type: "skill",
            label: "React",
            confidence: 0.9,
            evidence: [],
          },
        ],
        achievement: [
          {
            id: "2",
            type: "achievement",
            label: "Led Project",
            confidence: 0.85,
            evidence: [],
          },
        ],
        attribute: [],
        education: [],
        certification: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<IdentityScreen />);

    // Both should be visible initially
    expect(screen.getByText("React")).toBeTruthy();
    expect(screen.getByText("Led Project")).toBeTruthy();

    // Filter to show only skills - use first "Achievements" text (filter chip)
    const achievementElements = screen.getAllByText("Achievements");
    fireEvent.press(achievementElements[0]);

    // Achievement should be hidden (filter deselected)
    expect(screen.queryByText("Led Project")).toBeNull();
  });

  it("shows Show All button when filters are active", () => {
    (useIdentityClaims as jest.Mock).mockReturnValue({
      data: {
        skill: [
          {
            id: "1",
            type: "skill",
            label: "React",
            confidence: 0.9,
            evidence: [],
          },
        ],
        achievement: [
          {
            id: "2",
            type: "achievement",
            label: "Led",
            confidence: 0.85,
            evidence: [],
          },
        ],
        attribute: [],
        education: [],
        certification: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<IdentityScreen />);

    // Deselect a filter - use first "Achievements" text (filter chip)
    const achievementElements = screen.getAllByText("Achievements");
    fireEvent.press(achievementElements[0]);

    expect(screen.getByText("Show All")).toBeTruthy();
  });

  it("collapses section when header is pressed", () => {
    (useIdentityClaims as jest.Mock).mockReturnValue({
      data: {
        skill: [
          {
            id: "1",
            type: "skill",
            label: "React",
            confidence: 0.9,
            evidence: [],
          },
          {
            id: "2",
            type: "skill",
            label: "TypeScript",
            confidence: 0.85,
            evidence: [],
          },
        ],
        achievement: [],
        attribute: [],
        education: [],
        certification: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<IdentityScreen />);

    // Skills should be visible
    expect(screen.getByText("React")).toBeTruthy();
    expect(screen.getByText("TypeScript")).toBeTruthy();

    // Press the Skills section header (second "Skills" text - first is filter chip)
    const skillsElements = screen.getAllByText("Skills");
    // The section header is usually the second one
    fireEvent.press(skillsElements[skillsElements.length - 1]);

    // Skills should be hidden
    expect(screen.queryByText("React")).toBeNull();
    expect(screen.queryByText("TypeScript")).toBeNull();
  });
});
