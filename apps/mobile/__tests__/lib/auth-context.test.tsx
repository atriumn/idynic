import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { useAuth, AuthProvider } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase";

// Mock expo-linking
jest.mock("expo-linking", () => ({
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock supabase
jest.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({
          data: { session: null },
          error: null,
        }),
      ),
      onAuthStateChange: jest.fn(() => ({
        data: {
          subscription: { unsubscribe: jest.fn() },
        },
      })),
      signOut: jest.fn(() => Promise.resolve()),
      setSession: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    },
  },
  markSessionInvalid: jest.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("useAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws when used outside AuthProvider", () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = jest.fn();

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within an AuthProvider");

    console.error = originalError;
  });

  it("provides initial state with no session", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it("provides signOut function", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(typeof result.current.signOut).toBe("function");
  });

  it("calls supabase.auth.signOut when signOut is called", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it("subscribes to auth state changes", async () => {
    renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
    });
  });

  describe("with active session", () => {
    beforeEach(() => {
      const mockSession = {
        access_token: "test-token",
        refresh_token: "test-refresh",
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
    });

    it("provides session and user when authenticated", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.session).toBeDefined();
      expect(result.current.user?.id).toBe("user-123");
    });
  });

  describe("error handling", () => {
    it("clears session on refresh token error", async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: {
          message: "Refresh Token is invalid",
          code: "refresh_token_not_found",
        },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.session).toBeNull();
    });
  });
});
