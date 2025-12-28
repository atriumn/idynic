import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../app/(auth)/login';
import { supabase } from '../../lib/supabase';

// Mock supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signInWithOAuth: jest.fn(),
      setSession: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));

// Mock expo modules
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

// Mock Logo component
jest.mock('../../components/logo', () => ({
  Logo: () => 'Logo',
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Path: 'Path',
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders sign in mode by default', () => {
    render(<LoginScreen />);

    expect(screen.getByText('idynic')).toBeTruthy();
    expect(screen.getByText('Your smart career companion')).toBeTruthy();
    // There are two "Sign In" texts - one in tab and one in button
    expect(screen.getAllByText('Sign In').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sign Up').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
  });

  it('shows social login buttons in sign in mode', () => {
    render(<LoginScreen />);

    expect(screen.getByText('Sign in with Google')).toBeTruthy();
    expect(screen.getByText('Sign in with Apple')).toBeTruthy();
  });

  it('switches to sign up mode', () => {
    render(<LoginScreen />);

    // Find all "Sign Up" texts and press the tab one
    const signUpElements = screen.getAllByText('Sign Up');
    fireEvent.press(signUpElements[0]); // Press the tab

    expect(screen.getByText('Enter your invite code to get started')).toBeTruthy();
    expect(screen.getByPlaceholderText('Invite code')).toBeTruthy();
  });

  it('shows error when submitting empty form', async () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getAllByText('Sign In')[1]); // Submit button

    await waitFor(() => {
      expect(screen.getByText('Please enter email and password')).toBeTruthy();
    });
  });

  it('calls signInWithPassword on form submit', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      error: null,
      data: { user: { id: 'user-1' }, session: {} },
    });

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getAllByText('Sign In')[1]); // Submit button

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('shows error on sign in failure', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      error: { message: 'Invalid credentials' },
      data: null,
    });

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong');
    fireEvent.press(screen.getAllByText('Sign In')[1]);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeTruthy();
    });
  });

  it('validates invite code in sign up mode', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: true,
      error: null,
    });

    render(<LoginScreen />);

    // Switch to sign up mode
    fireEvent.press(screen.getAllByText('Sign Up')[0]);

    fireEvent.changeText(screen.getByPlaceholderText('Invite code'), 'VALIDCODE');
    fireEvent.press(screen.getByText('Validate Code'));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('check_beta_code', {
        input_code: 'VALIDCODE',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Code validated! Create your account below.')).toBeTruthy();
    });
  });

  it('shows error for invalid invite code', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: false,
      error: null,
    });

    render(<LoginScreen />);

    fireEvent.press(screen.getAllByText('Sign Up')[0]);

    fireEvent.changeText(screen.getByPlaceholderText('Invite code'), 'BADCODE');
    fireEvent.press(screen.getByText('Validate Code'));

    await waitFor(() => {
      expect(screen.getByText('Invalid or expired invite code')).toBeTruthy();
    });
  });

  it('shows error when invite code is empty', async () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getAllByText('Sign Up')[0]);
    fireEvent.press(screen.getByText('Validate Code'));

    await waitFor(() => {
      expect(screen.getByText('Please enter an invite code')).toBeTruthy();
    });
  });

  it('shows auth options after code validation', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: true,
      error: null,
    });

    render(<LoginScreen />);

    fireEvent.press(screen.getAllByText('Sign Up')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('Invite code'), 'VALIDCODE');
    fireEvent.press(screen.getByText('Validate Code'));

    await waitFor(() => {
      expect(screen.getByText('Sign up with Google')).toBeTruthy();
      expect(screen.getByText('Sign up with Apple')).toBeTruthy();
    });
  });

  it('calls signUp with email and password', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });
    (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    });

    render(<LoginScreen />);

    // Switch to signup and validate code
    fireEvent.press(screen.getAllByText('Sign Up')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('Invite code'), 'VALIDCODE');
    fireEvent.press(screen.getByText('Validate Code'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'new@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getAllByText('Sign Up')[1]); // Submit button

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
      });
    });
  });

  it('shows confirmation screen after signup', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });
    (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    });

    render(<LoginScreen />);

    fireEvent.press(screen.getAllByText('Sign Up')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('Invite code'), 'VALIDCODE');
    fireEvent.press(screen.getByText('Validate Code'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'new@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getAllByText('Sign Up')[1]);

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeTruthy();
      expect(screen.getByText('new@example.com')).toBeTruthy();
    });
  });

  it('allows using different invite code', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });

    render(<LoginScreen />);

    fireEvent.press(screen.getAllByText('Sign Up')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('Invite code'), 'VALIDCODE');
    fireEvent.press(screen.getByText('Validate Code'));

    await waitFor(() => {
      expect(screen.getByText('Use a different invite code')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Use a different invite code'));

    expect(screen.getByPlaceholderText('Invite code')).toBeTruthy();
  });

  it('shows terms and privacy links', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });

    render(<LoginScreen />);

    fireEvent.press(screen.getAllByText('Sign Up')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('Invite code'), 'CODE');
    fireEvent.press(screen.getByText('Validate Code'));

    await waitFor(() => {
      expect(screen.getByText('Terms of Service')).toBeTruthy();
      expect(screen.getByText('Privacy Policy')).toBeTruthy();
    });
  });

  it('navigates back to sign in from confirmation', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });
    (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    });

    render(<LoginScreen />);

    // Complete signup flow
    fireEvent.press(screen.getAllByText('Sign Up')[0]);
    fireEvent.changeText(screen.getByPlaceholderText('Invite code'), 'CODE');
    fireEvent.press(screen.getByText('Validate Code'));

    await waitFor(() => screen.getByPlaceholderText('Email'));

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'new@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getAllByText('Sign Up')[1]);

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Back to Sign In'));

    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByText('Sign in with Google')).toBeTruthy();
  });
});
