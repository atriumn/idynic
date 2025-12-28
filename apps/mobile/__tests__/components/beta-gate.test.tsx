import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { BetaGate } from '../../components/beta-gate';
import { supabase } from '../../lib/supabase';

// Mock expo-linking
jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(() => Promise.resolve()),
    },
    rpc: jest.fn(),
    from: jest.fn(),
  },
  markSessionInvalid: jest.fn(),
}));

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
};

const mockSession = {
  access_token: 'test-token',
  user: mockUser,
};

// Mock useAuth
jest.mock('../../lib/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    session: mockSession,
    signOut: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('BetaGate', () => {
  const mockOnAccessGranted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('code entry view', () => {
    it('renders invite code input', () => {
      render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

      expect(screen.getByText('Almost there!')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter code')).toBeTruthy();
    });

    it('renders activate button', () => {
      render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

      expect(screen.getByText('Activate')).toBeTruthy();
    });

    it('shows waitlist option', () => {
      render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

      expect(screen.getByText("Don't have a code? Join the waitlist")).toBeTruthy();
    });

    it('shows sign out option', () => {
      render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

      expect(screen.getByText('Sign out')).toBeTruthy();
    });
  });

  describe('code validation', () => {
    it('shows error when code is empty', async () => {
      render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

      fireEvent.press(screen.getByText('Activate'));

      await waitFor(() => {
        expect(screen.getByText('Please enter an invite code')).toBeTruthy();
      });
    });

    it('validates code with supabase RPC', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: true,
        error: null,
      });
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: null,
      });

      render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

      fireEvent.changeText(screen.getByPlaceholderText('Enter code'), 'VALID123');
      fireEvent.press(screen.getByText('Activate'));

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('check_beta_code', {
          input_code: 'VALID123',
        });
      });
    });

    it('shows error for invalid code', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: false,
        error: null,
      });

      render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

      fireEvent.changeText(screen.getByPlaceholderText('Enter code'), 'INVALID');
      fireEvent.press(screen.getByText('Activate'));

      await waitFor(() => {
        expect(screen.getByText('Invalid or expired invite code')).toBeTruthy();
      });
    });

    it('calls onAccessGranted on successful validation', async () => {
      (supabase.rpc as jest.Mock)
        .mockResolvedValueOnce({ data: true, error: null }) // check_beta_code
        .mockResolvedValueOnce({ data: null, error: null }); // consume_beta_code

      render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

      fireEvent.changeText(screen.getByPlaceholderText('Enter code'), 'VALID123');
      fireEvent.press(screen.getByText('Activate'));

      await waitFor(() => {
        expect(mockOnAccessGranted).toHaveBeenCalled();
      });
    });
  });

  describe('waitlist view', () => {
    it('switches to waitlist view', () => {
      render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

      fireEvent.press(screen.getByText("Don't have a code? Join the waitlist"));

      expect(screen.getByText('Join the Waitlist')).toBeTruthy();
      expect(screen.getByPlaceholderText('Your email')).toBeTruthy();
    });

    it('can return to code entry', () => {
      render(<BetaGate onAccessGranted={mockOnAccessGranted} />);

      // Go to waitlist
      fireEvent.press(screen.getByText("Don't have a code? Join the waitlist"));
      expect(screen.getByText('Join the Waitlist')).toBeTruthy();

      // Go back
      fireEvent.press(screen.getByText('I have an invite code'));
      expect(screen.getByText('Almost there!')).toBeTruthy();
    });
  });
});
