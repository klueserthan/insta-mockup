# Phase 1 Validation Report: Instagram MockUp Experimental Feed

**Date**: 2025-12-21  
**Purpose**: Validate that specs/001-instagram-mockup-feed documentation matches current implementation

## Executive Summary

**Status**: ⚠️ **SIGNIFICANT MISALIGNMENT DISCOVERED**

The documentation in `specs/001-instagram-mockup-feed/` describes a **planned feature design** that has NOT been implemented yet. The current backend implementation is an earlier/different version with substantially different data models and API surface.

## T001: Quickstart Validation ✅ (Partially Correct)

### What's Correct
- Backend uses `uv` for dependency management ✓
- `ROCKET_API_KEY` environment variable requirement ✓
- Dev user credentials: `test@research.edu` / `password123` ✓
- Basic project/experiment/media workflow structure exists ✓

### Issues Found
1. **Workflow descriptions don't match implementation**: The quickstart describes features (kill switch, query string key, pinned comments, results export) that aren't fully implemented in the current backend
2. **Test infrastructure issue**: Backend tests fail with Python 3.14 bcrypt compatibility issue (not related to feature validation)

### Recommendation
Update quickstart.md to clarify current implementation status vs. planned features.

---

## T002: API Contract vs Implementation ⚠️ **CRITICAL MISALIGNMENT**

### Summary
The OpenAPI contract in `specs/001-instagram-mockup-feed/contracts/openapi.yaml` describes an API that **does not match** the current backend implementation. This appears to be a **forward-looking specification** rather than documentation of existing behavior.

### Detailed Mismatches

#### 1. Experiment Model Structure

**OpenAPI Specification:**
```yaml
Experiment:
  id, projectId, name, publicUrlToken
  isActive: boolean          # Kill switch
  timeLimitSeconds: int
  endScreenMessage: string
  redirectUrl: string
```

**Current Implementation (backend/models.py):**
```python
class Experiment(ExperimentBase, table=True):
    id, project_id, name
    public_url: str            # Not publicUrlToken
    persist_timer: bool        # Different field
    show_unmute_prompt: bool   # Different field
    # NO isActive, timeLimitSeconds, endScreenMessage, redirectUrl
```

**Finding**: Settings like `timeLimitSeconds`, `redirectUrl`, `endScreenMessage` are currently in the **Project** model, not Experiment. The kill switch (`isActive`) doesn't exist anywhere.

#### 2. Video/Media Model Structure

**OpenAPI Specification:**
```yaml
Video:
  lockedPosition: int (nullable)  # Position lock semantic
  position: int
```

**Current Implementation:**
```python
class Video(VideoBase, table=True):
    position: int
    is_locked: bool              # Boolean lock, not position-based
```

**Finding**: Lock semantics are different. Spec wants position-based locking; implementation has simple boolean.

#### 3. Comment Model Structure

**OpenAPI Specification:**
```yaml
PreseededComment:
  text: string
  isPinned: boolean
  linkUrl: string (nullable)
  position: int
```

**Current Implementation:**
```python
class PreseededComment(PreseededCommentBase, table=True):
    body: str                    # Not "text"
    author_name: str            # Extra field
    author_avatar: str          # Extra field  
    likes: int                  # Extra field
    source: str                 # Extra field
    position: int               # ✓ Matches
    # NO isPinned, NO linkUrl
```

**Finding**: Comment structure is completely different. Spec envisions pinned comments with optional links; implementation has author info and likes.

#### 4. API Routes

**OpenAPI Routes:**
- `/feed/{publicUrlToken}` - Public feed delivery
- `/experiments/{experimentId}/results` - Results dashboard
- `/experiments/{experimentId}/results/export` - CSV/JSON export
- `/videos/{videoId}/pinned-comment` PUT - Set pinned comment
- `/comments/{commentId}/generate` POST - Generate suggestions

**Current Implementation:**
- ✅ `/api/feed/{public_url}` - Exists (different path param name)
- ❌ Results endpoints - NOT implemented
- ❌ Pinned comment endpoint - NOT implemented
- ❌ Comment generation endpoint - NOT implemented

#### 5. Request/Response Schemas

**OpenAPI expects camelCase:**
```json
{
  "projectId": 123,
  "experimentId": 456,
  "isActive": true
}
```

**Current Implementation:**
Uses `CamelModel` base class with `alias_generator=to_camel`, so **camelCase is supported** ✓

### Route-by-Route Comparison

| OpenAPI Route | Status | Implementation | Notes |
|--------------|--------|----------------|-------|
| POST /login | ✅ | /api/login | Matches |
| POST /logout | ✅ | /api/logout | Matches |
| GET /projects | ✅ | /api/projects | Matches |
| POST /projects | ✅ | /api/projects | Matches |
| GET /projects/{id}/experiments | ✅ | /api/projects/{id}/experiments | Matches |
| POST /projects/{id}/experiments | ✅ | /api/projects/{id}/experiments | Matches |
| PATCH /experiments/{id} | ⚠️ | /api/experiments/{id} | Route exists but schema differs |
| GET /experiments/{id}/videos | ✅ | /api/experiments/{id}/videos | Matches |
| POST /experiments/{id}/videos | ✅ | /api/experiments/{id}/videos | Matches |
| POST /videos/reorder | ⚠️ | /api/videos/reorder | Exists but different schema |
| GET /videos/{id}/comments | ✅ | /api/videos/{id}/comments | Matches |
| POST /videos/{id}/comments | ✅ | /api/videos/{id}/comments | Matches |
| PUT /videos/{id}/pinned-comment | ❌ | Not implemented | |
| POST /comments/{id}/generate | ❌ | Not implemented | |
| GET /feed/{publicUrlToken} | ⚠️ | /api/feed/{public_url} | Different param name |
| POST /interactions | ✅ | /api/interactions | Matches |
| POST /interactions/heartbeat | ✅ | /api/interactions/heartbeat | Matches |
| GET /experiments/{id}/results | ❌ | Not implemented | |
| POST /experiments/{id}/results/export | ❌ | Not implemented | |

---

## T003: Data Model Documentation ⚠️ **MISALIGNED**

### Summary
The `specs/001-instagram-mockup-feed/data-model.md` describes the **target architecture** for the Instagram MockUp feature, not the current implementation.

### Entity Comparison

#### Experiment Entity

**data-model.md describes:**
```
Experiment:
  - isActive (kill switch)
  - timeLimitSeconds
  - endScreenMessage
  - redirectUrl
  - randomizationSeed
```

**Current models.py has:**
```python
Experiment:
  - persist_timer
  - show_unmute_prompt
# Settings are in Project, not Experiment
```

**Finding**: Architecture differs - settings location and fields don't match.

#### Media Item (Video) Entity

**data-model.md describes:**
```
Media Item:
  - lockedPosition (position-based lock)
  - socialPersonaId
```

**Current models.py has:**
```python
Video:
  - is_locked (boolean lock)
  - social_account_id
```

**Finding**: Lock semantics differ, naming differs.

#### Pre-seeded Comment Entity

**data-model.md describes:**
```
Pre-seeded Comment:
  - text
  - linkUrl (optional)
  - isPinned (boolean)
  - position
```

**Current models.py has:**
```python
PreseededComment:
  - body (not "text")
  - author_name
  - author_avatar
  - likes
  - source
  - position
  # NO isPinned, NO linkUrl
```

**Finding**: Complete structural mismatch.

#### Participant Session

**data-model.md describes:**
```
Participant Session:
  - participantKey (from Project.queryKey)
  - elapsedMs
```

**Current models.py has:**
```python
Participant:
  - participant_id
  # No explicit session duration tracking in Participant model

ViewSession:
  - session_id
  - participant_id  
  - duration_seconds
  # Separate model for view tracking
```

**Finding**: Session management architecture differs.

### Validation Rules

The data-model.md describes validation rules that **are not implemented**:

❌ **Kill switch enforcement**: `isActive=false` should block public feed - field doesn't exist  
❌ **Pinned comment uniqueness**: "At most one pinned per media item" - pinned comments not implemented  
❌ **Session resume logic**: Based on `participantKey` from Project's `queryKey` - partial implementation  

---

## Root Cause Analysis

The specs/001-instagram-mockup-feed directory contains **design documentation for a planned feature** that represents a significant evolution from the current implementation:

### Current Implementation
- Basic reel feed with projects, experiments, videos
- Settings at Project level
- Simple boolean locks on videos
- Basic comments with author info
- Participant tracking via ViewSession
- No kill switch, no results export, no pinned comments

### Planned Feature (in specs/)
- Separation of settings to Experiment level for multi-experiment projects
- Kill switch per experiment (`isActive`)
- Position-based video locking for sophisticated ordering
- Pinned comments with embedded links
- Link click tracking
- Results dashboard with CSV/JSON export
- Assistant-generated comment suggestions
- Query string key per project for flexible participant ID tracking

---

## Recommendations

### Option 1: Update Specs to Match Current Implementation (Quick Fix)
**Pros**: Documentation becomes accurate immediately  
**Cons**: Loses the design vision; may need to redesign later

1. Update `data-model.md` to reflect current models.py
2. Update `openapi.yaml` to match actual routes and schemas
3. Update `quickstart.md` to remove references to unimplemented features
4. Mark tasks.md phases as "Not Yet Implemented"

### Option 2: Implement Features to Match Specs (Proper Solution)
**Pros**: Delivers the planned feature; specs become accurate  
**Cons**: Significant development work (Phases 2-8 from tasks.md)

1. Keep specs as-is (they represent the target)
2. Follow tasks.md to implement missing features
3. Use TDD approach per constitution
4. Validate after each phase

### Option 3: Hybrid Approach (Recommended for Phase 1)
**Pros**: Clear status, enables parallel work  
**Cons**: Requires maintaining "current" vs "planned" distinction

1. **Add status indicators** to all spec docs:
   - Mark implemented sections with ✅
   - Mark planned sections with 📋
   - Mark partially implemented with ⚠️

2. **Create current-state docs**:
   - `specs/001-instagram-mockup-feed/CURRENT_STATE.md` documenting actual implementation
   - Keep design docs as-is for future implementation

3. **Update quickstart.md** to separate:
   - "What works now" (current features)
   - "Coming soon" (planned features from tasks.md)

---

## Phase 1 Task Completion Status

- ✅ **T001**: Quickstart reviewed - structure is correct, but describes unimplemented features
- ✅ **T002**: API contract reviewed - **significant misalignment identified**
- ✅ **T003**: Data model reviewed - **represents planned design, not current state**

## Next Steps

1. **Decision needed**: Which recommendation to pursue (Options 1, 2, or 3)
2. **If Option 2 (implement)**: Proceed with Phase 2 (Foundational tasks)
3. **If Option 3 (hybrid)**: Create current-state documentation and annotate specs
4. **Address test infrastructure**: Fix Python 3.14 bcrypt compatibility (separate issue)

---

## Appendix: Test Infrastructure Issue

**Issue**: Backend tests fail with Python 3.14 due to bcrypt compatibility
**Error**: `ValueError: password cannot be longer than 72 bytes`
**Cause**: passlib/bcrypt version incompatibility with Python 3.14
**Impact**: Cannot run pytest to validate implementation behavior
**Resolution**: Not in scope for Phase 1 validation; recommend separate issue
**Workaround**: Use Python 3.12 or update passlib/bcrypt dependencies
