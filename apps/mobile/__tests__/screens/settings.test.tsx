import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import SettingsScreen from '../../app/(app)/settings';
import { useAuth } from '../../lib/auth-context';
import { useSharedLinks } from '../../hooks/use-shared-links';
import * as WebBrowser from 'expo-web-browser';

// Mock hooks
jest.mock('../../lib/auth-context');
jest.mock('../../hooks/use-shared-links');

// Mock router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock lucide icons
jest.mock('lucide-react-native', () => ({
  Link: () => 'Link',
  ChevronRight: () => 'ChevronRight',
  LogOut: () => 'LogOut',
  FileText: () => 'FileText',
  Shield: () => 'Shield',
  Cookie: () => 'Cookie',
  HelpCircle: () => 'HelpCircle',
}));

describe('SettingsScreen', () => {
  const mockSignOut = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useAuth as jest.Mock).mockReturnValue({
      signOut: mockSignOut,
      user: { email: 'test@example.com' },
    });

    (useSharedLinks as jest.Mock).mockReturnValue({
      data: [],
    });
  });

  it('renders settings header with user email', () => {
    render(<SettingsScreen />);

    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('test@example.com')).toBeTruthy();
  });

  it('renders all menu sections', () => {
    render(<SettingsScreen />);

    expect(screen.getByText('Sharing')).toBeTruthy();
    expect(screen.getByText('Support')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Legal')).toBeTruthy();
  });

  it('renders menu items', () => {
    render(<SettingsScreen />);

    expect(screen.getByText('Shared Links')).toBeTruthy();
    expect(screen.getByText('Help Center')).toBeTruthy();
    expect(screen.getByText('Sign Out')).toBeTruthy();
    expect(screen.getByText('Terms of Service')).toBeTruthy();
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
    expect(screen.getByText('Cookie Policy')).toBeTruthy();
  });

  it('navigates to shared links', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Shared Links'));

    expect(mockPush).toHaveBeenCalledWith('/shared-links');
  });

  it('navigates to help center', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Help Center'));

    expect(mockPush).toHaveBeenCalledWith('/help');
  });

  it('calls signOut when pressed', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Sign Out'));

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('opens terms of service in browser', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Terms of Service'));

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      expect.stringContaining('/legal/terms')
    );
  });

  it('opens privacy policy in browser', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Privacy Policy'));

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      expect.stringContaining('/legal/privacy')
    );
  });

  it('opens cookie policy in browser', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Cookie Policy'));

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      expect.stringContaining('/legal/cookies')
    );
  });

  it('shows badge for active shared links', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    (useSharedLinks as jest.Mock).mockReturnValue({
      data: [
        { id: '1', revokedAt: null, expiresAt: futureDate.toISOString() },
        { id: '2', revokedAt: null, expiresAt: futureDate.toISOString() },
        { id: '3', revokedAt: new Date().toISOString(), expiresAt: futureDate.toISOString() }, // Revoked
      ],
    });

    render(<SettingsScreen />);

    // Badge should show 2 (not 3, since one is revoked)
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('does not show badge when no active links', () => {
    (useSharedLinks as jest.Mock).mockReturnValue({
      data: [],
    });

    render(<SettingsScreen />);

    // No badge element should be present
    expect(screen.queryByText('0')).toBeNull();
  });

  it('does not count expired links in badge', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    (useSharedLinks as jest.Mock).mockReturnValue({
      data: [
        { id: '1', revokedAt: null, expiresAt: pastDate.toISOString() }, // Expired
      ],
    });

    render(<SettingsScreen />);

    // No badge for expired links
    expect(screen.queryByText('1')).toBeNull();
  });
});
