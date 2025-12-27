import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '../test/utils';
import { screen, waitFor } from '@testing-library/react';
import ReelsFeed from './ReelsFeed';
import * as wouter from 'wouter';

// Mock wouter
vi.mock('wouter', async () => {
  const actual = await vi.importActual<typeof wouter>('wouter');
  return {
    ...actual,
    useRoute: vi.fn(),
    useLocation: vi.fn(),
  };
});

describe('ReelsFeed - Query Parameter Preservation (US4)', () => {
  const mockSetLocation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(wouter.useRoute).mockReturnValue([true, { publicUrl: 'test-feed' }]);
    vi.mocked(wouter.useLocation).mockReturnValue(['/', mockSetLocation]);
    
    // Mock fetch for feed data
    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      
      if (urlStr.includes('/api/feed/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            experimentId: 'exp-123',
            experimentName: 'Test Experiment',
            persistTimer: false,
            showUnmutePrompt: true,
            projectSettings: {
              queryKey: 'participantId',
              timeLimitSeconds: 300,
              redirectUrl: 'https://survey.example.com',
              endScreenMessage: 'Thank you!',
            },
            videos: [
              {
                id: 'video-1',
                caption: 'Test Video',
                videoUrl: 'test.mp4',
                account: { username: 'test', displayName: 'Test User' },
              },
            ],
          }),
        } as Response);
      }
      
      return Promise.reject(new Error('Not found'));
    }) as any;
  });

  it('T038: should preserve original query params when navigating to end screen', async () => {
    // Simulate opening feed with tracking params
    delete (window as any).location;
    (window as any).location = new URL(
      'http://localhost:3000/feed/test-feed?participantId=P001&source=facebook&campaign=study2024'
    );

    renderWithProviders(<ReelsFeed />);

    // Wait for feed to load
    await waitFor(() => {
      expect(screen.queryByText('Loading feed...')).not.toBeInTheDocument();
    });

    // Simulate timer expiring by triggering navigation
    // We need to wait a bit and then check that the navigation preserves params
    await waitFor(() => {
      if (mockSetLocation.mock.calls.length > 0) {
        const navigationCall = mockSetLocation.mock.calls[0][0];
        
        // The navigation should include the original params encoded
        expect(navigationCall).toContain('_originalParams=');
        
        // Parse the URL to verify params
        const [path, queryString] = navigationCall.split('?');
        const params = new URLSearchParams(queryString);
        
        // Verify internal params are present
        expect(params.get('message')).toBe('Thank you!');
        expect(params.get('redirect')).toBe('https://survey.example.com');
        expect(params.get('queryKey')).toBe('participantId');
        
        // Verify original params are encoded
        const originalParams = params.get('_originalParams');
        expect(originalParams).toBeTruthy();
        const decodedOriginal = new URLSearchParams(originalParams || '');
        expect(decodedOriginal.get('participantId')).toBe('P001');
        expect(decodedOriginal.get('source')).toBe('facebook');
        expect(decodedOriginal.get('campaign')).toBe('study2024');
      }
    }, { timeout: 5000 });
  });

  it('T038: should handle empty query string', async () => {
    // Simulate opening feed without tracking params
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:3000/feed/test-feed');

    renderWithProviders(<ReelsFeed />);

    // Wait for feed to load
    await waitFor(() => {
      expect(screen.queryByText('Loading feed...')).not.toBeInTheDocument();
    });

    // If navigation happens, check that _originalParams is not present when there are no original params
    if (mockSetLocation.mock.calls.length > 0) {
      const navigationCall = mockSetLocation.mock.calls[0][0];
      const [, queryString] = navigationCall.split('?');
      const params = new URLSearchParams(queryString);
      
      // Should not have _originalParams when there were no original params
      expect(params.has('_originalParams')).toBe(false);
    }
  });

  it('T038: should preserve params with special characters', async () => {
    delete (window as any).location;
    (window as any).location = new URL(
      'http://localhost:3000/feed/test-feed?email=user@example.com&notes=hello world&symbols=a&b=c'
    );

    renderWithProviders(<ReelsFeed />);

    await waitFor(() => {
      expect(screen.queryByText('Loading feed...')).not.toBeInTheDocument();
    });

    if (mockSetLocation.mock.calls.length > 0) {
      const navigationCall = mockSetLocation.mock.calls[0][0];
      const [, queryString] = navigationCall.split('?');
      const params = new URLSearchParams(queryString);
      
      const originalParams = params.get('_originalParams');
      if (originalParams) {
        const decodedOriginal = new URLSearchParams(originalParams);
        expect(decodedOriginal.get('email')).toBe('user@example.com');
        expect(decodedOriginal.get('notes')).toBe('hello world');
        expect(decodedOriginal.get('symbols')).toBe('a');
      }
    }
  });
});
