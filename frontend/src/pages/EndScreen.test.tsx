import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '../test/utils';
import { screen } from '@testing-library/react';
import EndScreen from './EndScreen';
import * as wouter from 'wouter';

// Mock wouter's useRoute
vi.mock('wouter', async () => {
  const actual = await vi.importActual<typeof wouter>('wouter');
  return {
    ...actual,
    useRoute: vi.fn(),
  };
});

describe('EndScreen - Query Parameter Preservation (US4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('T037: should preserve all original query params in redirect URL', () => {
    // Mock useRoute to return publicUrl
    vi.mocked(wouter.useRoute).mockReturnValue([true, { publicUrl: 'test-feed' }]);

    // Simulate arriving at end screen with tracking params encoded in _originalParams
    // This simulates what ReelsFeed.tsx does when navigating to the end screen
    delete (window as any).location;
    (window as any).location = new URL(
      'http://localhost:3000/end/test-feed?message=Thank%20you&redirect=https%3A%2F%2Fsurvey.example.com%2Fform&queryKey=participantId&_originalParams=participantId%3DP001%26source%3Dfacebook%26campaign%3Dstudy2024'
    );

    renderWithProviders(<EndScreen />);

    // Find the redirect link
    const redirectLink = screen.getByTestId('link-redirect') as HTMLAnchorElement;
    const finalUrl = new URL(redirectLink.href);

    // Verify original tracking params are preserved
    expect(finalUrl.searchParams.get('participantId')).toBe('P001');
    expect(finalUrl.searchParams.get('source')).toBe('facebook');
    expect(finalUrl.searchParams.get('campaign')).toBe('study2024');

    // Verify internal params are NOT forwarded
    expect(finalUrl.searchParams.has('message')).toBe(false);
    expect(finalUrl.searchParams.has('redirect')).toBe(false);
    expect(finalUrl.searchParams.has('queryKey')).toBe(false);
    expect(finalUrl.searchParams.has('_originalParams')).toBe(false);
  });

  it('T037: should handle redirect URL that already has query params', () => {
    vi.mocked(wouter.useRoute).mockReturnValue([true, { publicUrl: 'test-feed' }]);

    // Redirect URL already has a param, and we're adding tracking params
    delete (window as any).location;
    (window as any).location = new URL(
      'http://localhost:3000/end/test-feed?message=Thanks&redirect=https%3A%2F%2Fsurvey.example.com%2Fform%3Fsurvey%3D123&queryKey=participantId&_originalParams=participantId%3DP001'
    );

    renderWithProviders(<EndScreen />);

    const redirectLink = screen.getByTestId('link-redirect') as HTMLAnchorElement;
    const finalUrl = new URL(redirectLink.href);

    // Both the redirect URL's original param and the tracking param should be present
    expect(finalUrl.searchParams.get('survey')).toBe('123');
    expect(finalUrl.searchParams.get('participantId')).toBe('P001');
    expect(finalUrl.searchParams.has('message')).toBe(false);
  });

  it('T037: should handle multiple custom tracking params', () => {
    vi.mocked(wouter.useRoute).mockReturnValue([true, { publicUrl: 'test-feed' }]);

    // Multiple custom tracking parameters
    delete (window as any).location;
    (window as any).location = new URL(
      'http://localhost:3000/end/test-feed?message=Done&redirect=https%3A%2F%2Fsurvey.example.com&queryKey=userId&_originalParams=userId%3DU123%26sessionId%3DS456%26cohort%3DA%26arm%3Dcontrol%26site%3Dclinic1'
    );

    renderWithProviders(<EndScreen />);

    const redirectLink = screen.getByTestId('link-redirect') as HTMLAnchorElement;
    const finalUrl = new URL(redirectLink.href);

    // All custom params should be preserved
    expect(finalUrl.searchParams.get('userId')).toBe('U123');
    expect(finalUrl.searchParams.get('sessionId')).toBe('S456');
    expect(finalUrl.searchParams.get('cohort')).toBe('A');
    expect(finalUrl.searchParams.get('arm')).toBe('control');
    expect(finalUrl.searchParams.get('site')).toBe('clinic1');

    // Internal params should be excluded
    expect(finalUrl.searchParams.has('message')).toBe(false);
    expect(finalUrl.searchParams.has('redirect')).toBe(false);
    expect(finalUrl.searchParams.has('queryKey')).toBe(false);
  });

  it('T037: should handle params with special characters', () => {
    vi.mocked(wouter.useRoute).mockReturnValue([true, { publicUrl: 'test-feed' }]);

    delete (window as any).location;
    (window as any).location = new URL(
      'http://localhost:3000/end/test-feed?message=Thanks&redirect=https%3A%2F%2Fsurvey.example.com&queryKey=email&_originalParams=email%3Duser%2540example.com%26notes%3Dhello%2520world%2526more'
    );

    renderWithProviders(<EndScreen />);

    const redirectLink = screen.getByTestId('link-redirect') as HTMLAnchorElement;
    const finalUrl = new URL(redirectLink.href);

    expect(finalUrl.searchParams.get('email')).toBe('user@example.com');
    expect(finalUrl.searchParams.get('notes')).toBe('hello world&more');
  });

  it('should display end message from query params', () => {
    vi.mocked(wouter.useRoute).mockReturnValue([true, { publicUrl: 'test-feed' }]);

    delete (window as any).location;
    (window as any).location = new URL(
      'http://localhost:3000/end/test-feed?message=Custom%20thank%20you%20message&redirect=https%3A%2F%2Fsurvey.example.com'
    );

    renderWithProviders(<EndScreen />);

    expect(screen.getByTestId('text-end-message')).toHaveTextContent('Custom thank you message');
  });

  it('should use default message when no message param provided', () => {
    vi.mocked(wouter.useRoute).mockReturnValue([true, { publicUrl: 'test-feed' }]);

    delete (window as any).location;
    (window as any).location = new URL('http://localhost:3000/end/test-feed');

    renderWithProviders(<EndScreen />);

    expect(screen.getByTestId('text-end-message')).toHaveTextContent('Thank you for participating in this study.');
  });

  it('T037: should preserve original params even when they conflict with reserved names', () => {
    // Edge case: participant URL has a "message" param as a tracking parameter
    // The new implementation preserves this by encoding original params separately
    vi.mocked(wouter.useRoute).mockReturnValue([true, { publicUrl: 'test-feed' }]);

    delete (window as any).location;
    (window as any).location = new URL(
      'http://localhost:3000/end/test-feed?message=Experiment%20End&redirect=https%3A%2F%2Fsurvey.example.com&queryKey=participantId&_originalParams=participantId%3DP001%26message%3DOriginalTrackingValue'
    );

    renderWithProviders(<EndScreen />);

    const redirectLink = screen.getByTestId('link-redirect') as HTMLAnchorElement;
    const finalUrl = new URL(redirectLink.href);

    // The original "message" tracking param should be preserved in the redirect
    expect(finalUrl.searchParams.get('message')).toBe('OriginalTrackingValue');
    expect(finalUrl.searchParams.get('participantId')).toBe('P001');
  });
});
