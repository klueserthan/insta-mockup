import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getQueryFn } from '../lib/queryClient';
import { Route, Router } from 'wouter';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      queryFn: getQueryFn({ on401: "throw" }),
    },
  },
});

import userEvent from '@testing-library/user-event';

// ... other imports

export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    ...renderOptions
  }: RenderOptions & { route?: string } = {}
) {
  const queryClient = createTestQueryClient();
  
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router>
             {children}
        </Router> 
      </QueryClientProvider>
    );
  }

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}
