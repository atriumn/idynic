// Import jest-native matchers (for react-native testing library)
require('@testing-library/react-native/pure');

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  const mockComponent = (name) =>
    function MockComponent(props) {
      return React.createElement(name, props);
    };

  return {
    __esModule: true,
    default: mockComponent('svg'),
    Svg: mockComponent('svg'),
    Defs: mockComponent('defs'),
    LinearGradient: mockComponent('linearGradient'),
    Stop: mockComponent('stop'),
    G: mockComponent('g'),
    Path: mockComponent('path'),
    Circle: mockComponent('circle'),
    Rect: mockComponent('rect'),
    Line: mockComponent('line'),
    Polygon: mockComponent('polygon'),
    Polyline: mockComponent('polyline'),
    Ellipse: mockComponent('ellipse'),
    Text: mockComponent('text'),
    TSpan: mockComponent('tspan'),
    TextPath: mockComponent('textPath'),
    Use: mockComponent('use'),
    Image: mockComponent('image'),
    Symbol: mockComponent('symbol'),
    ClipPath: mockComponent('clipPath'),
    RadialGradient: mockComponent('radialGradient'),
    Mask: mockComponent('mask'),
    Pattern: mockComponent('pattern'),
    Marker: mockComponent('marker'),
    ForeignObject: mockComponent('foreignObject'),
  };
});

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
  useSegments: () => [],
  Link: ({ children }) => children,
  Stack: {
    Screen: () => null,
  },
  Tabs: {
    Screen: () => null,
  },
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock @supabase/supabase-js
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  })),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));

// Silence console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
