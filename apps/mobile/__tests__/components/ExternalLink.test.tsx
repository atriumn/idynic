import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { ExternalLink } from '../../components/ExternalLink';
import * as WebBrowser from 'expo-web-browser';

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

// Mock expo-router Link
jest.mock('expo-router', () => ({
  Link: ({ children, onPress, href, ...props }: { children: React.ReactNode; onPress?: (e: { preventDefault: () => void }) => void; href: string }) => {
    const { Text } = require('react-native');
    return (
      <Text
        {...props}
        testID="link"
        onPress={() => {
          const mockEvent = { preventDefault: jest.fn() };
          onPress?.(mockEvent);
        }}
      >
        {children}
      </Text>
    );
  },
}));

describe('ExternalLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children', () => {
    render(<ExternalLink href="https://example.com">Click me</ExternalLink>);

    expect(screen.getByText('Click me')).toBeTruthy();
  });

  it('renders link element', () => {
    render(<ExternalLink href="https://example.com">Link text</ExternalLink>);

    expect(screen.getByTestId('link')).toBeTruthy();
  });

  describe('on native platform', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('opens in-app browser on press', () => {
      render(<ExternalLink href="https://example.com">Open link</ExternalLink>);

      fireEvent.press(screen.getByTestId('link'));

      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('on web platform', () => {
    beforeEach(() => {
      Platform.OS = 'web';
    });

    afterEach(() => {
      Platform.OS = 'ios'; // Reset
    });

    it('does not call openBrowserAsync on web', () => {
      render(<ExternalLink href="https://example.com">Web link</ExternalLink>);

      fireEvent.press(screen.getByTestId('link'));

      expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    });
  });
});
