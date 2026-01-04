import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import ProfileScreen from "../../app/(app)/profile";
import { useProfile } from "../../hooks/use-profile";
import {
  useUpdateContact,
  useAddWorkHistory,
  useUpdateWorkHistory,
  useDeleteWorkHistory,
  useAddEducation,
  useUpdateEducation,
  useDeleteEducation,
  useAddSkill,
  useDeleteSkill,
  useAddVenture,
} from "../../hooks/use-profile-mutations";

// Mock hooks
jest.mock("../../hooks/use-profile");
jest.mock("../../hooks/use-profile-mutations");

// Mock safe area
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock lucide icons
jest.mock("lucide-react-native", () => ({
  Plus: () => "Plus",
  Pencil: () => "Pencil",
  Trash2: () => "Trash2",
  X: () => "X",
  Check: () => "Check",
}));

const mockMutation = {
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
  isPending: false,
};

describe("ProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mutation mocks
    (useUpdateContact as jest.Mock).mockReturnValue(mockMutation);
    (useAddWorkHistory as jest.Mock).mockReturnValue(mockMutation);
    (useUpdateWorkHistory as jest.Mock).mockReturnValue(mockMutation);
    (useDeleteWorkHistory as jest.Mock).mockReturnValue(mockMutation);
    (useAddEducation as jest.Mock).mockReturnValue(mockMutation);
    (useUpdateEducation as jest.Mock).mockReturnValue(mockMutation);
    (useDeleteEducation as jest.Mock).mockReturnValue(mockMutation);
    (useAddSkill as jest.Mock).mockReturnValue(mockMutation);
    (useDeleteSkill as jest.Mock).mockReturnValue(mockMutation);
    (useAddVenture as jest.Mock).mockReturnValue(mockMutation);
  });

  it("shows loading state", () => {
    (useProfile as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    // Should render without crashing in loading state
    const { toJSON } = render(<ProfileScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it("shows error state", () => {
    (useProfile as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Network error"),
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<ProfileScreen />);

    expect(screen.getByText("Failed to load profile")).toBeTruthy();
    expect(screen.getByText("Network error")).toBeTruthy();
  });

  it("displays profile with contact info", () => {
    (useProfile as jest.Mock).mockReturnValue({
      data: {
        contact: {
          name: "Jane Doe",
          email: "jane@example.com",
          location: "San Francisco, CA",
        },
        workHistory: [],
        ventures: [],
        education: [],
        skills: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<ProfileScreen />);

    expect(screen.getByText("Jane Doe")).toBeTruthy();
    expect(screen.getByText("jane@example.com")).toBeTruthy();
    expect(screen.getByText("San Francisco, CA")).toBeTruthy();
  });

  it("shows empty states for work history and education", () => {
    (useProfile as jest.Mock).mockReturnValue({
      data: {
        contact: { name: "Jane Doe" },
        workHistory: [],
        ventures: [],
        education: [],
        skills: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<ProfileScreen />);

    expect(screen.getByText("No experience added yet")).toBeTruthy();
    expect(screen.getByText("No education added yet")).toBeTruthy();
  });

  it("displays work history entries", () => {
    (useProfile as jest.Mock).mockReturnValue({
      data: {
        contact: { name: "Jane Doe" },
        workHistory: [
          {
            id: "wh-1",
            title: "Senior Engineer",
            company: "TechCorp",
            location: "Remote",
            summary: "Built amazing things",
          },
        ],
        ventures: [],
        education: [],
        skills: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<ProfileScreen />);

    expect(screen.getByText("Senior Engineer")).toBeTruthy();
    expect(screen.getByText("TechCorp")).toBeTruthy();
    expect(screen.getByText("Remote")).toBeTruthy();
    expect(screen.getByText("Built amazing things")).toBeTruthy();
  });

  it("displays education entries", () => {
    (useProfile as jest.Mock).mockReturnValue({
      data: {
        contact: { name: "Jane Doe" },
        workHistory: [],
        ventures: [],
        education: [
          {
            id: "edu-1",
            text: "BS Computer Science, MIT",
            context: "Graduated 2015",
          },
        ],
        skills: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<ProfileScreen />);

    expect(screen.getByText("BS Computer Science, MIT")).toBeTruthy();
  });

  it("displays skills with count", () => {
    (useProfile as jest.Mock).mockReturnValue({
      data: {
        contact: { name: "Jane Doe" },
        workHistory: [],
        ventures: [],
        education: [],
        skills: [
          { id: "sk-1", label: "React" },
          { id: "sk-2", label: "TypeScript" },
          { id: "sk-3", label: "Node.js" },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<ProfileScreen />);

    expect(screen.getByText("Skills (3)")).toBeTruthy();
    expect(screen.getByText("React")).toBeTruthy();
    expect(screen.getByText("TypeScript")).toBeTruthy();
    expect(screen.getByText("Node.js")).toBeTruthy();
  });

  it('shows "Show more" for skills beyond initial count', () => {
    const manySkills = Array.from({ length: 15 }, (_, i) => ({
      id: `sk-${i}`,
      label: `Skill ${i + 1}`,
    }));

    (useProfile as jest.Mock).mockReturnValue({
      data: {
        contact: { name: "Jane Doe" },
        workHistory: [],
        ventures: [],
        education: [],
        skills: manySkills,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<ProfileScreen />);

    expect(screen.getByText("Skills (15)")).toBeTruthy();
    expect(screen.getByText("Show 5 more")).toBeTruthy();
  });

  it('toggles skill visibility when "Show more" pressed', () => {
    const manySkills = Array.from({ length: 15 }, (_, i) => ({
      id: `sk-${i}`,
      label: `Skill ${i + 1}`,
    }));

    (useProfile as jest.Mock).mockReturnValue({
      data: {
        contact: { name: "Jane Doe" },
        workHistory: [],
        ventures: [],
        education: [],
        skills: manySkills,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<ProfileScreen />);

    fireEvent.press(screen.getByText("Show 5 more"));

    expect(screen.getByText("Show less")).toBeTruthy();
    expect(screen.getByText("Skill 15")).toBeTruthy();
  });

  it("shows Add Skill input when pressed", () => {
    (useProfile as jest.Mock).mockReturnValue({
      data: {
        contact: { name: "Jane Doe" },
        workHistory: [],
        ventures: [],
        education: [],
        skills: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<ProfileScreen />);

    fireEvent.press(screen.getByText("Add Skill"));

    expect(screen.getByPlaceholderText("New skill")).toBeTruthy();
  });
});
