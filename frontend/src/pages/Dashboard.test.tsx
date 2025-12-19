import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import { renderWithProviders } from '../test/utils';
import * as useAuthModule from '@/hooks/use-auth';

// Mock useAuth
vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: any) => children,
}));

describe('Dashboard Account Creation', () => {
  beforeEach(() => {
    // Mock authenticated user
    (useAuthModule.useAuth as any).mockReturnValue({
      user: { id: 'test-user', email: 'test@research.edu', isAdmin: true },
      isLoading: false,
    });

    // Mock global fetch
    global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
      let urlStr: string;
      if (typeof url === 'string') {
        urlStr = url;
      } else if (url instanceof URL) {
        urlStr = url.toString();
      } else if (url instanceof Request) {
        urlStr = url.url;
      } else {
        urlStr = String(url);
      }
      
      // Mock GET accounts
      if (urlStr.includes('/api/accounts') && (!options || options.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);
      }
      
      // Mock POST accounts (Create)
      if (urlStr.includes('/api/accounts') && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        if (body.username === 'duplicate') {
           return Promise.resolve({
             ok: false,
             status: 409,
             json: () => Promise.resolve({ message: "Username already exists" }),
           } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ ...body, id: 'new-id' }),
        } as Response);
      }

      // Default mock for other requests
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);
    });
  });

  it.skip('should show error when creating account with duplicate username', async () => {
    // Mock successful project/experiment fetch
    (global.fetch as any).mockImplementation((url: string | URL | Request) => {
        const urlStr = url instanceof Request ? url.url : String(url);
        console.log("Mock Fetch Request:", urlStr);

        if (urlStr.includes('/api/experiments')) return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'e1', name: 'E1', projectId: 'p1', videos: [] }]) });
        if (urlStr.includes('/api/projects')) return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'p1', name: 'P1' }]) });
        if (urlStr.includes('/api/accounts')) {
             return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const { user } = renderWithProviders(<Dashboard />);
    
    // Click Project
    const p1Card = await screen.findByTestId('card-project-p1');
    await user.click(p1Card);

    // Click Feed
    const e1 = await screen.findByText('E1', {}, { timeout: 3000 });
    await user.click(e1);

    // Click Add Video
    const addBtn = await screen.findByTestId('button-add-video');
    await user.click(addBtn);

    // Open Account Select -> Create New
    const selectTrigger = await screen.findByTestId('select-account');
    await user.click(selectTrigger);
    
    // Radix UI portals can be tricky. Using text finding.
    const createOption = await screen.findByText('+ Create New Account');
    await user.click(createOption);

    // Fill form
    await user.type(screen.getByTestId('input-new-account-name'), 'Dup User');
    await user.type(screen.getByTestId('input-new-account-username'), 'duplicate');
    await user.type(screen.getByTestId('input-new-account-avatar'), 'http://foo.com');

    // Click Save - Need to update mock for this specific call to fail
    const originalFetch = global.fetch;
    global.fetch = vi.fn((url: string | URL | Request, options?: any) => {
        const urlStr = url instanceof Request ? url.url : String(url);
        if (urlStr.includes('/api/accounts') && options?.method === 'POST') {
             return Promise.resolve({
                 ok: false,
                 status: 409,
                 json: () => Promise.resolve({ message: "Username already exists" }),
             } as Response);
        }
        return (originalFetch as any)(url, options); 
    });

    await user.click(screen.getByTestId('button-create-account'));

    // Expect Error
    await screen.findByText('Username already exists. Please choose a unique username.');
  });
});
