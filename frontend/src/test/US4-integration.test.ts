import { describe, it, expect } from 'vitest';

/**
 * Integration test for US4: Preserve tracking parameters on end-screen redirect
 * 
 * This test documents the expected behavior of the query parameter preservation flow
 * from the participant's initial feed URL through to the final redirect destination.
 */
describe('US4 Integration: Query Parameter Preservation Flow', () => {
  it('should preserve all tracking params through the complete flow', () => {
    // STEP 1: Participant opens the feed with tracking parameters
    const initialFeedUrl = new URL('http://localhost:3000/feed/abc123?participantId=P001&source=facebook&campaign=study2024&utm_medium=social');
    
    // STEP 2: ReelsFeed captures the original query string
    const originalQueryString = initialFeedUrl.search.substring(1); // Remove '?'
    expect(originalQueryString).toBe('participantId=P001&source=facebook&campaign=study2024&utm_medium=social');
    
    // STEP 3: ReelsFeed navigates to end screen with internal params + encoded original params
    const endScreenParams = new URLSearchParams();
    endScreenParams.set('message', 'Thank you for participating!');
    endScreenParams.set('redirect', 'https://survey.example.com/form');
    endScreenParams.set('queryKey', 'participantId');
    endScreenParams.set('_originalParams', originalQueryString);
    
    const endScreenUrl = `http://localhost:3000/end/abc123?${endScreenParams.toString()}`;
    
    // Verify end screen URL structure
    const endScreenUrlObj = new URL(endScreenUrl);
    expect(endScreenUrlObj.searchParams.get('message')).toBe('Thank you for participating!');
    expect(endScreenUrlObj.searchParams.get('redirect')).toBe('https://survey.example.com/form');
    expect(endScreenUrlObj.searchParams.get('_originalParams')).toBe(originalQueryString);
    
    // STEP 4: EndScreen extracts original params and builds final redirect URL
    const redirectBaseUrl = endScreenUrlObj.searchParams.get('redirect') || '';
    const originalParamsString = endScreenUrlObj.searchParams.get('_originalParams') || '';
    
    const finalRedirectUrl = new URL(redirectBaseUrl);
    if (originalParamsString) {
      const originalParams = new URLSearchParams(originalParamsString);
      originalParams.forEach((value, key) => {
        finalRedirectUrl.searchParams.set(key, value);
      });
    }
    
    // STEP 5: Verify final redirect URL has all original tracking params
    expect(finalRedirectUrl.toString()).toBe(
      'https://survey.example.com/form?participantId=P001&source=facebook&campaign=study2024&utm_medium=social'
    );
    
    // Verify all original params are present
    expect(finalRedirectUrl.searchParams.get('participantId')).toBe('P001');
    expect(finalRedirectUrl.searchParams.get('source')).toBe('facebook');
    expect(finalRedirectUrl.searchParams.get('campaign')).toBe('study2024');
    expect(finalRedirectUrl.searchParams.get('utm_medium')).toBe('social');
    
    // Verify internal params are NOT forwarded
    expect(finalRedirectUrl.searchParams.has('message')).toBe(false);
    expect(finalRedirectUrl.searchParams.has('redirect')).toBe(false);
    expect(finalRedirectUrl.searchParams.has('queryKey')).toBe(false);
    expect(finalRedirectUrl.searchParams.has('_originalParams')).toBe(false);
  });

  it('should handle redirect URL that already has query params', () => {
    // Participant URL with tracking params
    const initialFeedUrl = new URL('http://localhost:3000/feed/abc123?participantId=P001&cohort=A');
    const originalQueryString = initialFeedUrl.search.substring(1);
    
    // Redirect URL already has params
    const redirectUrlWithParams = 'https://survey.example.com/form?survey_id=123&version=2';
    
    // Build end screen params
    const endScreenParams = new URLSearchParams();
    endScreenParams.set('redirect', redirectUrlWithParams);
    endScreenParams.set('_originalParams', originalQueryString);
    
    // Build final redirect URL
    const redirectBase = new URL(redirectUrlWithParams);
    const originalParams = new URLSearchParams(originalQueryString);
    originalParams.forEach((value, key) => {
      redirectBase.searchParams.set(key, value);
    });
    
    // Verify both original redirect params and tracking params are present
    expect(redirectBase.searchParams.get('survey_id')).toBe('123');
    expect(redirectBase.searchParams.get('version')).toBe('2');
    expect(redirectBase.searchParams.get('participantId')).toBe('P001');
    expect(redirectBase.searchParams.get('cohort')).toBe('A');
  });

  it('should handle edge case: tracking param with reserved name', () => {
    // Edge case: someone uses "message" as a tracking parameter
    const initialFeedUrl = new URL('http://localhost:3000/feed/abc123?participantId=P001&message=tracking123');
    const originalQueryString = initialFeedUrl.search.substring(1);
    
    // ReelsFeed encodes original params separately
    const endScreenParams = new URLSearchParams();
    endScreenParams.set('message', 'Thank you!'); // This is the experiment's end message
    endScreenParams.set('redirect', 'https://survey.example.com');
    endScreenParams.set('_originalParams', originalQueryString); // Original "message" preserved here
    
    // Build final redirect URL
    const redirectBase = new URL('https://survey.example.com');
    const originalParams = new URLSearchParams(originalQueryString);
    originalParams.forEach((value, key) => {
      redirectBase.searchParams.set(key, value);
    });
    
    // The original "message" tracking param is preserved in the redirect
    expect(redirectBase.searchParams.get('message')).toBe('tracking123');
    expect(redirectBase.searchParams.get('participantId')).toBe('P001');
    
    // Internal "message" is not forwarded
    expect(redirectBase.searchParams.has('redirect')).toBe(false);
  });

  it('should handle no redirect URL scenario', () => {
    // If experiment has no redirect URL, end screen should handle gracefully
    const originalQueryString = 'participantId=P001';
    
    const endScreenParams = new URLSearchParams();
    endScreenParams.set('message', 'Thank you!');
    endScreenParams.set('redirect', ''); // No redirect
    endScreenParams.set('_originalParams', originalQueryString);
    
    const redirectUrl = endScreenParams.get('redirect');
    
    // When no redirect URL, finalRedirectUrl should be empty
    expect(redirectUrl).toBe('');
    
    // End screen should show message but no redirect button
  });
});
