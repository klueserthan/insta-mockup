# US4 Implementation: Preserve Tracking Parameters on End-Screen Redirect

## Overview
This implementation ensures that all query parameters from the initial feed URL are preserved and forwarded to the redirect destination URL when a participant completes the experiment.

## Problem Solved
Previously, if the original feed URL had query parameters with the same names as internal system parameters (`message`, `redirect`, `queryKey`), those original values would be lost. The new implementation ensures ALL original parameters are preserved, even in edge cases.

## Technical Solution

### Architecture
The solution uses a separate encoding mechanism to preserve the original query string:

```
Initial Feed URL:
  /feed/abc123?participantId=P001&source=facebook&campaign=study2024

     ↓ (Timer expires)

End Screen URL:
  /end/abc123?message=Thank+you&redirect=https://survey.com&queryKey=participantId
             &_originalParams=participantId%3DP001%26source%3Dfacebook%26campaign%3Dstudy2024

     ↓ (User clicks continue)

Final Redirect:
  https://survey.com?participantId=P001&source=facebook&campaign=study2024
```

### Implementation Details

#### 1. ReelsFeed.tsx (T038)
**File**: `frontend/src/pages/ReelsFeed.tsx`

Changes to the `navigateToEndScreen` callback:
- Captures the original query string from `window.location.search`
- Creates a new URLSearchParams for end screen navigation (not reusing the original)
- Adds internal parameters: `message`, `redirect`, `queryKey`
- Encodes the original query string in `_originalParams` parameter
- This approach prevents any parameter collisions

```typescript
const navigateToEndScreen = useCallback(() => {
  // Preserve original query string for forwarding to redirect URL (US4)
  const originalQueryString = window.location.search;
  
  // Create end screen params with internal configuration
  const endScreenParams = new URLSearchParams();
  endScreenParams.set('message', endScreenMessage);
  endScreenParams.set('redirect', redirectUrl);
  endScreenParams.set('queryKey', queryKey);
  
  // Store original query string to forward to redirect URL
  if (originalQueryString) {
    endScreenParams.set('_originalParams', originalQueryString.substring(1)); // Remove leading '?'
  }
  
  setLocation(`/end/${publicUrl}?${endScreenParams.toString()}`);
}, [endScreenMessage, redirectUrl, queryKey, publicUrl, setLocation]);
```

#### 2. EndScreen.tsx (T037)
**File**: `frontend/src/pages/EndScreen.tsx`

Changes to the `finalRedirectUrl` computation:
- Extracts `_originalParams` from the end screen URL
- Decodes it to get the original query parameters
- Forwards only the original parameters to the redirect URL
- Internal parameters are never forwarded

```typescript
const originalParamsString = searchParams.get('_originalParams') || '';

const finalRedirectUrl = useMemo(() => {
  if (!redirectUrl) return '';
  
  // Start with the redirect base URL
  const redirectBase = new URL(redirectUrl);
  
  // Forward original parameters from the feed URL (US4: preserve all tracking params)
  if (originalParamsString) {
    const originalParams = new URLSearchParams(originalParamsString);
    originalParams.forEach((value, key) => {
      redirectBase.searchParams.set(key, value);
    });
  }
  
  return redirectBase.toString();
}, [redirectUrl, originalParamsString]);
```

## Test Coverage

### Unit Tests

#### EndScreen.test.tsx (7 tests)
1. ✅ Preserves all original query params in redirect URL
2. ✅ Handles redirect URL that already has query params
3. ✅ Handles multiple custom tracking params
4. ✅ Handles params with special characters
5. ✅ Displays end message from query params
6. ✅ Uses default message when no message param provided
7. ✅ Preserves original params even when they conflict with reserved names

#### ReelsFeed.test.tsx (3 tests)
1. ✅ Preserves original query params when navigating to end screen
2. ✅ Handles empty query string
3. ✅ Preserves params with special characters

#### US4-integration.test.ts (4 tests)
1. ✅ Preserves all tracking params through the complete flow
2. ✅ Handles redirect URL that already has query params
3. ✅ Handles edge case: tracking param with reserved name
4. ✅ Handles no redirect URL scenario

### Test Results
```
Test Files  6 passed | 1 failed (unrelated MediaManager tests)
Tests       26 passed | 4 failed (unrelated)
```

## User Acceptance Scenarios

### Scenario 1: Basic Tracking Parameters
**Given**: Researcher shares link `https://app.com/feed/abc123?participantId=P001&source=facebook`  
**When**: Participant completes the experiment and clicks continue  
**Then**: Redirect URL includes `?participantId=P001&source=facebook`

### Scenario 2: Multiple Custom Parameters
**Given**: Link has `?userId=U123&sessionId=S456&cohort=A&arm=control&site=clinic1`  
**When**: Participant completes the experiment  
**Then**: All 5 parameters are forwarded unchanged

### Scenario 3: Parameters with Special Characters
**Given**: Link has `?email=user@example.com&notes=hello world&data=a&b=c`  
**When**: Participant completes the experiment  
**Then**: All parameters are properly URL-encoded and decoded

### Scenario 4: Redirect URL Already Has Parameters
**Given**: Redirect URL is `https://survey.com/form?survey_id=123`  
**And**: Feed link has `?participantId=P001`  
**When**: Participant completes the experiment  
**Then**: Final URL is `https://survey.com/form?survey_id=123&participantId=P001`

### Scenario 5: Edge Case - Reserved Parameter Names
**Given**: Feed link has `?participantId=P001&message=CustomValue`  
**When**: Participant completes the experiment  
**Then**: The original `message=CustomValue` is preserved in redirect (not replaced by experiment's end message)

## Acceptance Criteria

From `specs/001-instagram-mockup-feed/spec.md` User Story 4:

✅ **Criterion 1**: Given a public experiment link that includes arbitrary query parameters, when a participant opens the link and later follows the end-screen continue button, then the destination URL includes all original parameters unchanged.

✅ **Criterion 2**: Given a public experiment link with a mix of known and custom query parameters, when a participant completes the feed and is redirected, then the destination URL contains at least the same set of query parameters with the same key-value pairs, regardless of parameter order.

## Manual Testing Guide

To manually test this feature:

1. **Start the application** (see `specs/001-instagram-mockup-feed/quickstart.md`)
   ```bash
   # Terminal 1 - Backend
   cd backend
   ROCKET_API_KEY=dummy uv run uvicorn main:app --reload
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

2. **Create a test experiment**:
   - Sign in as `test@research.edu` / `password123`
   - Create a project
   - Create an experiment with a short time limit (e.g., 30 seconds)
   - Set a redirect URL (e.g., `https://httpbin.org/get`)
   - Upload at least one media item

3. **Test with tracking parameters**:
   - Get the public feed URL (e.g., `http://localhost:3000/feed/abc123`)
   - Add tracking parameters: `?participantId=TEST001&source=manual&campaign=validation&custom=data`
   - Open the full URL in an incognito window

4. **Complete the flow**:
   - Watch the feed until the timer expires
   - Observe the end screen appears
   - Click the "Continue to Survey" button
   - Verify the redirect URL in your browser contains all the tracking parameters

5. **Verify with httpbin.org**:
   If you used `https://httpbin.org/get` as the redirect URL, you'll see a JSON response showing all the query parameters that were received.

## Edge Cases Handled

1. **No tracking parameters**: Works correctly with just the feed URL
2. **Empty redirect URL**: End screen shows message but no redirect button
3. **Redirect URL with existing params**: Merges tracking params with existing params
4. **Reserved parameter names**: Original values are preserved (not overwritten)
5. **Special characters**: Properly encoded/decoded (spaces, `@`, `&`, etc.)
6. **URL encoding**: Handles double-encoded parameters correctly

## Breaking Changes

None. This is a backward-compatible enhancement:
- Existing experiments without tracking parameters continue to work
- The `_originalParams` parameter is internal and transparent to users
- No database schema changes required
- No API changes required

## Known Limitations

1. **URL Length**: Very long query strings (thousands of characters) may approach browser URL length limits. This is unlikely in practice.

2. **Parameter Precedence**: If the redirect URL already has a parameter with the same name as a tracking parameter, the tracking parameter value will override it. This is intentional and matches expected behavior.

## Files Changed

1. `frontend/src/pages/ReelsFeed.tsx` - Modified `navigateToEndScreen` callback
2. `frontend/src/pages/EndScreen.tsx` - Modified `finalRedirectUrl` computation
3. `frontend/src/pages/EndScreen.test.tsx` - Added 7 unit tests
4. `frontend/src/pages/ReelsFeed.test.tsx` - Added 3 unit tests
5. `frontend/src/test/US4-integration.test.ts` - Added 4 integration tests

## Related Documentation

- Specification: `specs/001-instagram-mockup-feed/spec.md` (User Story 4)
- Tasks: `specs/001-instagram-mockup-feed/tasks.md` (Phase 7)
- Quickstart: `specs/001-instagram-mockup-feed/quickstart.md` (Participant workflow)
