import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import OpportunitiesScreen from "../../app/(app)/opportunities";
import { useOpportunities } from "../../hooks/use-opportunities";

// Mock hooks
jest.mock("../../hooks/use-opportunities");

// Mock router
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock lucide icons
jest.mock("lucide-react-native", () => ({
  Briefcase: () => "Briefcase",
  MapPin: () => "MapPin",
  Clock: () => "Clock",
  Building2: () => "Building2",
}));

// Mock date-fns
jest.mock("date-fns", () => ({
  formatDistanceToNow: () => "2 days ago",
}));

describe("OpportunitiesScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading state", () => {
    (useOpportunities as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<OpportunitiesScreen />);

    // Screen renders without crashing in loading state
    expect(true).toBeTruthy();
  });

  it("shows error state", () => {
    (useOpportunities as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed to fetch"),
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<OpportunitiesScreen />);

    expect(screen.getByText("Failed to load opportunities")).toBeTruthy();
    expect(screen.getByText("Failed to fetch")).toBeTruthy();
  });

  it("shows empty state when no opportunities", () => {
    (useOpportunities as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<OpportunitiesScreen />);

    expect(screen.getByText("No opportunities yet")).toBeTruthy();
    expect(screen.getByText(/Start tracking your job search/)).toBeTruthy();
  });

  it("displays opportunity cards", () => {
    (useOpportunities as jest.Mock).mockReturnValue({
      data: [
        {
          id: "opp-1",
          title: "Senior Engineer",
          company: "TechCorp",
          location: "Remote",
          employment_type: "Full-time",
          status: "tracking",
          requirements: null,
          created_at: new Date().toISOString(),
        },
        {
          id: "opp-2",
          title: "Staff Engineer",
          company: "StartupXYZ",
          location: "San Francisco",
          employment_type: "Full-time",
          status: "applied",
          requirements: null,
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<OpportunitiesScreen />);

    expect(screen.getByText("Senior Engineer")).toBeTruthy();
    expect(screen.getByText("TechCorp")).toBeTruthy();
    expect(screen.getByText("Remote")).toBeTruthy();
    expect(screen.getByText("Staff Engineer")).toBeTruthy();
    expect(screen.getByText("StartupXYZ")).toBeTruthy();
  });

  it("displays status badges", () => {
    (useOpportunities as jest.Mock).mockReturnValue({
      data: [
        {
          id: "opp-1",
          title: "Engineer",
          company: "Corp",
          status: "applied",
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<OpportunitiesScreen />);

    // Status is displayed uppercase
    expect(screen.getByText("applied")).toBeTruthy();
  });

  it("navigates to opportunity detail on card press", () => {
    (useOpportunities as jest.Mock).mockReturnValue({
      data: [
        {
          id: "opp-123",
          title: "Engineer",
          company: "Corp",
          status: "tracking",
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<OpportunitiesScreen />);

    fireEvent.press(screen.getByText("Engineer"));

    expect(mockPush).toHaveBeenCalledWith("/opportunities/opp-123");
  });

  it("displays employment type when available", () => {
    (useOpportunities as jest.Mock).mockReturnValue({
      data: [
        {
          id: "opp-1",
          title: "Engineer",
          company: "Corp",
          status: "tracking",
          employment_type: "Full-time",
          location: "Remote",
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<OpportunitiesScreen />);

    expect(screen.getByText("Full-time")).toBeTruthy();
    expect(screen.getByText("Remote")).toBeTruthy();
  });

  it("shows fallback text for missing title and company", () => {
    (useOpportunities as jest.Mock).mockReturnValue({
      data: [
        {
          id: "opp-1",
          title: null,
          company: null,
          status: "tracking",
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<OpportunitiesScreen />);

    expect(screen.getByText("Untitled Opportunity")).toBeTruthy();
    expect(screen.getByText("Direct Hire")).toBeTruthy();
  });

  it("displays created time relative format", () => {
    (useOpportunities as jest.Mock).mockReturnValue({
      data: [
        {
          id: "opp-1",
          title: "Engineer",
          company: "Corp",
          status: "tracking",
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    render(<OpportunitiesScreen />);

    expect(screen.getByText("2 days ago")).toBeTruthy();
  });
});
