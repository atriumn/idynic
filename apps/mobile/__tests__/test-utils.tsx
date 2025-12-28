import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, renderHook, RenderHookOptions } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth-context';

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  withAuth?: boolean;
}

interface CustomRenderHookOptions<TProps> extends Omit<RenderHookOptions<TProps>, 'wrapper'> {
  queryClient?: QueryClient;
  withAuth?: boolean;
}

// Create wrapper with all providers (internal version)
function createWrapperInternal(queryClient: QueryClient, withAuth: boolean) {
  return function Wrapper({ children }: WrapperProps) {
    const content = (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    if (withAuth) {
      return <AuthProvider>{content}</AuthProvider>;
    }

    return content;
  };
}

// Custom render that wraps component with providers
function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { queryClient = createTestQueryClient(), withAuth = true, ...renderOptions } = options;
  const Wrapper = createWrapperInternal(queryClient, withAuth);

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

// Custom renderHook that wraps with providers
function customRenderHook<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options: CustomRenderHookOptions<TProps> = {}
) {
  const { queryClient = createTestQueryClient(), withAuth = true, ...renderOptions } = options;
  const Wrapper = createWrapperInternal(queryClient, withAuth);

  return {
    ...renderHook(hook, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

// Simple wrapper factory for use with testing-library's renderHook
export function createWrapper(options: { queryClient?: QueryClient; withAuth?: boolean } = {}) {
  const { queryClient = createTestQueryClient(), withAuth = true } = options;
  return createWrapperInternal(queryClient, withAuth);
}

// Re-export everything from testing-library
export * from '@testing-library/react-native';

// Override render and renderHook with custom versions
export { customRender as render, customRenderHook as renderHook, createTestQueryClient };
