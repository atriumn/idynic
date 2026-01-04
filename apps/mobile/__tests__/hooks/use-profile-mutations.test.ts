import { waitFor, act } from "@testing-library/react-native";
import { renderHook } from "../test-utils";
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
import { supabase } from "../../lib/supabase";
import { api } from "../../lib/api";
import { mockSession } from "../mocks/api-responses";

// Mock expo-linking
jest.mock("expo-linking", () => ({
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock supabase
jest.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(() => Promise.resolve()),
    },
    from: jest.fn(),
  },
  markSessionInvalid: jest.fn(),
}));

// Mock api
jest.mock("../../lib/api", () => ({
  api: {
    workHistory: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    education: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    skills: {
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockFrom = supabase.from as jest.Mock;
const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;

// Helper to set up authenticated state
function setupAuthenticatedSession() {
  mockGetSession.mockResolvedValue({
    data: { session: mockSession },
    error: null,
  });

  // Call auth state change callback synchronously so session is available immediately
  mockOnAuthStateChange.mockImplementation((callback) => {
    // Call immediately (not in setTimeout) so session is set before first render completes
    callback("SIGNED_IN", mockSession);
    return {
      data: {
        subscription: { unsubscribe: jest.fn() },
      },
    };
  });
}

// Helper to set up unauthenticated state
function setupUnauthenticatedSession() {
  mockGetSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  mockOnAuthStateChange.mockReturnValue({
    data: {
      subscription: { unsubscribe: jest.fn() },
    },
  });
}

describe("Profile Mutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useUpdateContact", () => {
    describe("when authenticated", () => {
      beforeEach(() => {
        setupAuthenticatedSession();
      });

      it("updates contact info successfully", async () => {
        const mockUpdate = jest.fn().mockReturnThis();
        const mockEq = jest.fn().mockResolvedValue({ error: null });

        mockFrom.mockReturnValue({
          update: mockUpdate,
          eq: mockEq,
        });
        mockUpdate.mockReturnValue({ eq: mockEq });

        const { result } = renderHook(() => useUpdateContact());

        // Wait for auth to settle
        await waitFor(() => {
          expect(result.current.isIdle).toBe(true);
        });

        await act(async () => {
          await result.current.mutateAsync({ name: "Updated Name" });
        });

        expect(mockFrom).toHaveBeenCalledWith("profiles");
        expect(mockUpdate).toHaveBeenCalledWith({ name: "Updated Name" });
      });

      it("handles database error", async () => {
        const mockUpdate = jest.fn().mockReturnThis();
        const mockEq = jest.fn().mockResolvedValue({
          error: { message: "Update failed", code: "PGRST116" },
        });

        mockFrom.mockReturnValue({
          update: mockUpdate,
          eq: mockEq,
        });
        mockUpdate.mockReturnValue({ eq: mockEq });

        const { result } = renderHook(() => useUpdateContact());

        await waitFor(() => {
          expect(result.current.isIdle).toBe(true);
        });

        await expect(
          result.current.mutateAsync({ name: "Test" }),
        ).rejects.toMatchObject({ message: "Update failed" });
      });

      it("invalidates profile query on success", async () => {
        const mockUpdate = jest.fn().mockReturnThis();
        const mockEq = jest.fn().mockResolvedValue({ error: null });

        mockFrom.mockReturnValue({
          update: mockUpdate,
          eq: mockEq,
        });
        mockUpdate.mockReturnValue({ eq: mockEq });

        const { result, queryClient } = renderHook(() => useUpdateContact());
        const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

        await waitFor(() => {
          expect(result.current.isIdle).toBe(true);
        });

        await act(async () => {
          await result.current.mutateAsync({ name: "Updated" });
        });

        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["profile"] });
      });
    });

    describe("when not authenticated", () => {
      beforeEach(() => {
        setupUnauthenticatedSession();
      });

      it("throws error when not authenticated", async () => {
        const { result } = renderHook(() => useUpdateContact());

        await waitFor(() => {
          expect(result.current.isIdle).toBe(true);
        });

        await expect(
          result.current.mutateAsync({ name: "Test" }),
        ).rejects.toThrow("Not authenticated");
      });
    });
  });

  describe("useAddWorkHistory", () => {
    beforeEach(() => {
      setupAuthenticatedSession();
    });

    it("creates work history entry successfully", async () => {
      const mockWorkHistoryData = {
        company: "New Company",
        title: "Software Engineer",
        start_date: "2024-01-01",
      };

      (api.workHistory.create as jest.Mock).mockResolvedValue({ id: "new-id" });

      const { result } = renderHook(() => useAddWorkHistory());

      await waitFor(() => {
        expect(result.current.isIdle).toBe(true);
      });

      await act(async () => {
        await result.current.mutateAsync(mockWorkHistoryData);
      });

      expect(api.workHistory.create).toHaveBeenCalledWith(mockWorkHistoryData);
    });

    it("handles API error", async () => {
      (api.workHistory.create as jest.Mock).mockRejectedValue(
        new Error("API error"),
      );

      const { result } = renderHook(() => useAddWorkHistory());

      await waitFor(() => {
        expect(result.current.isIdle).toBe(true);
      });

      await expect(
        result.current.mutateAsync({
          company: "Test",
          title: "Test",
          start_date: "2024-01-01",
        }),
      ).rejects.toThrow("API error");
    });
  });

  describe("useUpdateWorkHistory", () => {
    beforeEach(() => {
      setupAuthenticatedSession();
    });

    it("updates work history entry successfully", async () => {
      (api.workHistory.update as jest.Mock).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useUpdateWorkHistory());

      await waitFor(() => {
        expect(result.current.isIdle).toBe(true);
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: "wh-1",
          data: { title: "Updated Title" },
        });
      });

      expect(api.workHistory.update).toHaveBeenCalledWith("wh-1", {
        title: "Updated Title",
      });
    });
  });

  describe("useDeleteWorkHistory", () => {
    beforeEach(() => {
      setupAuthenticatedSession();
    });

    it("deletes work history entry successfully", async () => {
      (api.workHistory.delete as jest.Mock).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useDeleteWorkHistory());

      await waitFor(() => {
        expect(result.current.isIdle).toBe(true);
      });

      await act(async () => {
        await result.current.mutateAsync("wh-1");
      });

      expect(api.workHistory.delete).toHaveBeenCalledWith("wh-1");
    });
  });

  describe("useAddEducation", () => {
    beforeEach(() => {
      setupAuthenticatedSession();
    });

    it("creates education entry successfully", async () => {
      (api.education.create as jest.Mock).mockResolvedValue({ id: "edu-new" });

      const { result } = renderHook(() => useAddEducation());

      await waitFor(() => {
        expect(result.current.isIdle).toBe(true);
      });

      await act(async () => {
        await result.current.mutateAsync({ text: "BS Computer Science" });
      });

      expect(api.education.create).toHaveBeenCalledWith({
        text: "BS Computer Science",
      });
    });
  });

  describe("useUpdateEducation", () => {
    beforeEach(() => {
      setupAuthenticatedSession();
    });

    it("updates education entry successfully", async () => {
      (api.education.update as jest.Mock).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useUpdateEducation());

      await waitFor(() => {
        expect(result.current.isIdle).toBe(true);
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: "edu-1",
          data: { text: "Updated Education" },
        });
      });

      expect(api.education.update).toHaveBeenCalledWith("edu-1", {
        text: "Updated Education",
      });
    });
  });

  describe("useDeleteEducation", () => {
    beforeEach(() => {
      setupAuthenticatedSession();
    });

    it("deletes education entry successfully", async () => {
      (api.education.delete as jest.Mock).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useDeleteEducation());

      await waitFor(() => {
        expect(result.current.isIdle).toBe(true);
      });

      await act(async () => {
        await result.current.mutateAsync("edu-1");
      });

      expect(api.education.delete).toHaveBeenCalledWith("edu-1");
    });
  });

  describe("useAddSkill", () => {
    beforeEach(() => {
      setupAuthenticatedSession();
    });

    it("creates skill successfully", async () => {
      (api.skills.create as jest.Mock).mockResolvedValue({ id: "skill-new" });

      const { result } = renderHook(() => useAddSkill());

      await waitFor(() => {
        expect(result.current.isIdle).toBe(true);
      });

      await act(async () => {
        await result.current.mutateAsync("TypeScript");
      });

      expect(api.skills.create).toHaveBeenCalledWith("TypeScript");
    });

    it("invalidates both profile and identity-claims queries on success", async () => {
      (api.skills.create as jest.Mock).mockResolvedValue({ id: "skill-new" });

      const { result, queryClient } = renderHook(() => useAddSkill());
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      await waitFor(() => {
        expect(result.current.isIdle).toBe(true);
      });

      await act(async () => {
        await result.current.mutateAsync("React");
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["profile"] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["identity-claims"],
      });
    });
  });

  describe("useDeleteSkill", () => {
    beforeEach(() => {
      setupAuthenticatedSession();
    });

    it("deletes skill successfully", async () => {
      (api.skills.delete as jest.Mock).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useDeleteSkill());

      await waitFor(() => {
        expect(result.current.isIdle).toBe(true);
      });

      await act(async () => {
        await result.current.mutateAsync("skill-1");
      });

      expect(api.skills.delete).toHaveBeenCalledWith("skill-1");
    });
  });

  describe("useAddVenture", () => {
    beforeEach(() => {
      setupAuthenticatedSession();
    });

    it("creates venture with entry_type set to venture", async () => {
      (api.workHistory.create as jest.Mock).mockResolvedValue({ id: "v-new" });

      const { result } = renderHook(() => useAddVenture());

      await waitFor(() => {
        expect(result.current.isIdle).toBe(true);
      });

      await act(async () => {
        await result.current.mutateAsync({
          company: "My Startup",
          title: "Founder",
          start_date: "2023-01-01",
        });
      });

      expect(api.workHistory.create).toHaveBeenCalledWith({
        company: "My Startup",
        title: "Founder",
        start_date: "2023-01-01",
        entry_type: "venture",
      });
    });
  });
});
