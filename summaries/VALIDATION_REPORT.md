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

## T002: API Contract vs Implementation ✅ **SPECS UPDATED**

### Summary
The OpenAPI contract in `specs/001-instagram-mockup-feed/contracts/openapi.yaml` has been updated to match the current backend implementation architecture. Key corrections made:
- Settings (`timeLimitSeconds`, `redirectUrl`, `endScreenMessage`, `isActive`, `randomizationSeed`) moved to Project level
- Video lock changed from `lockedPosition: int` to `isLocked: boolean`
- PreseededComment now includes `socialPersonaId` foreign key

Remaining implementation gaps documented below.

### Detailed Mismatches

#### 1. Experiment Model Structure

**Updated OpenAPI Specification (after correction):**
```yaml
Experiment:
  id, projectId, name, publicUrlToken
  isActive: boolean          # Kill switch at experiment level
```

**Current Implementation (backend/models.py):**
```python
class Experiment(ExperimentBase, table=True):
    id, project_id, name
    public_url: str            # Not publicUrlToken
    persist_timer: bool        # Should be at project level
    show_unmute_prompt: bool   # Should be at project level
    # Missing: isActive
```

**Updated Project Model:**
```yaml
Project:
  id, name, queryKey
  timeLimitSeconds: int      # Settings at project level
  endScreenMessage: string
  redirectUrl: string
  randomizationSeed: int
  persistTimer: boolean      # Moved from Experiment
  showUnmutePrompt: boolean  # Moved from Experiment
```

**Finding**: Specs have been corrected. Kill switch (`isActive`) should be at Experiment level. Settings (`timeLimitSeconds`, `redirectUrl`, `endScreenMessage`, `randomizationSeed`) and UI preferences (`persistTimer`, `showUnmutePrompt`) should be at Project level.

#### 2. Video/Media Model Structure

**Updated OpenAPI Specification (after correction):**
```yaml
Video:
  isLocked: boolean          # Boolean lock semantic
  position: int
```

**Current Implementation:**
```python
class Video(VideoBase, table=True):
    position: int
    is_locked: bool              # ✓ Matches spec
```

**Finding**: Specs have been corrected. Lock semantics now use a boolean flag (`isLocked`) matching the current implementation.

#### 3. Comment Model Structure

**Updated OpenAPI Specification (after correction):**
```yaml
PreseededComment:
  id, videoId, socialPersonaId
  text: string
  isPinned: boolean
  linkUrl: string (nullable)
  position: int
```

**Current Implementation:**
```python
class PreseededComment(PreseededCommentBase, table=True):
    body: str                    # Called "body" not "text"
    author_name: str            # Extra field
    author_avatar: str          # Extra field  
    likes: int                  # Extra field
    source: str                 # Extra field
    position: int               # ✓ Matches
    # NO isPinned, NO linkUrl, NO socialPersonaId FK
```

**Finding**: Comment structure still differs but specs now correctly include `socialPersonaId` foreign key. Implementation needs to be updated to add `isPinned`, `linkUrl` fields and `socialPersonaId` FK, and consider renaming `body` to `text` or keeping both for compatibility.

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

## T003: Data Model Documentation ✅ **SPECS UPDATED**

### Summary
The `specs/001-instagram-mockup-feed/data-model.md` has been updated to reflect the correct architecture with settings at Project level and kill switch at Experiment level.

### Entity Comparison

#### Experiment Entity

**Updated data-model.md (after correction):**
```
Experiment:
  - isActive (kill switch per experiment)
```

**Current models.py has:**
```python
Experiment:
  - persist_timer  # Should be at project level
  - show_unmute_prompt  # Should be at project level
  # Missing: isActive
```

**Finding**: Implementation needs to be updated - move `persist_timer` and `show_unmute_prompt` to Project model, add `isActive` to Experiment model.

#### Project Entity

**Updated data-model.md (after correction):**
```
Project:
  - queryKey
  - timeLimitSeconds
  - endScreenMessage
  - redirectUrl
  - randomizationSeed
  - persistTimer (moved from Experiment)
  - showUnmutePrompt (moved from Experiment)
```

**Current models.py has:**
```python
Project:
  - query_key  # ✓ Matches
  - time_limit_seconds  # ✓ Matches
  - redirect_url  # ✓ Matches
  - end_screen_message  # ✓ Matches
  - lock_all_positions  # Extra field
  - randomization_seed  # ✓ Matches
  # Missing: persistTimer, showUnmutePrompt (currently in Experiment)
```

**Finding**: Mostly aligned. Implementation needs to add `persistTimer` and `showUnmutePrompt` fields to Project model (move from Experiment).

#### Media Item (Video) Entity

**Updated data-model.md (after correction):**
```
Media Item:
  - isLocked (boolean lock)
  - socialPersonaId
```

**Current models.py has:**
```python
Video:
  - is_locked  # ✓ Matches
  - social_account_id  # Same as socialPersonaId
```

**Finding**: Now aligned - boolean lock semantic is correct.

#### Pre-seeded Comment Entity

**Updated data-model.md (after correction):**
```
Pre-seeded Comment:
  - text
  - linkUrl (optional)
  - isPinned (boolean)
  - socialPersonaId (FK to persona)
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
  - position  # ✓ Matches
  # Missing: isPinned, linkUrl, socialPersonaId FK
```

**Finding**: Implementation needs updates - add `isPinned`, `linkUrl`, `socialPersonaId` fields.

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

The data-model.md describes validation rules:

✅ **Upload safety**: 50MB max, file type allowlist - implemented  
⚠️ **Kill switch enforcement**: `isActive=false` should block public feed - field needs to be added to Experiment model  
📋 **Pinned comment uniqueness**: "At most one pinned per media item" - feature not yet implemented  
✅ **Session resume logic**: Based on `participantKey` from Project's `queryKey` - partially implemented (queryKey exists, resume logic exists)  
📋 **Lock behavior**: Boolean locks respected during randomization - needs verification  

---

## Root Cause Analysis and Resolution

**Initial Finding**: The specs/001-instagram-mockup-feed directory contained design documentation that didn't match the implementation.

**Resolution**: After reviewing user feedback, specs have been **corrected** to align with proper architecture:

### Corrections Made to Specs:
1. ✅ **Settings location**: `timeLimitSeconds`, `redirectUrl`, `endScreenMessage`, `randomizationSeed` at Project level (matching implementation)
2. ✅ **UI preferences location**: `persistTimer`, `showUnmutePrompt` moved to Project level (needs implementation update)
3. ✅ **Kill switch location**: `isActive` at Experiment level (needs implementation update)
4. ✅ **Lock semantics**: Changed from `lockedPosition: int` to `isLocked: boolean` (matching implementation)
5. ✅ **Comment model**: Added `socialPersonaId` foreign key requirement

### Current Status:

**Implementation mostly aligned with corrected specs**:
- Project structure with settings ✅
- Video/Media structure with boolean locks ✅
- Basic CRUD operations ✅
- Feed delivery ✅
- Interaction logging ✅

**Remaining gaps to implement**:
- Move `persistTimer`, `showUnmutePrompt` from Experiment to Project model
- Add `isActive` field to Experiment model (kill switch)
- Add PreseededComment `isPinned`, `linkUrl`, `socialPersonaId` fields
- Results export endpoints (CSV/JSON)
- Comment generation assistant endpoint
- Pinned comment management endpoint

---

## Recommendations ✅ **DECISION MADE**

**User has selected Option 2**: Implement features to match specs (with corrected specs).

### Next Steps:

1. **Specs are now corrected** ✅
   - Settings at Project level
   - Boolean lock semantics
   - Comment model includes socialPersonaId

2. **Proceed to Phase 2 implementation** (from tasks.md):
   - Add `isActive` field to Project model
   - Add pinned comment fields to PreseededComment model
   - Implement results export endpoints
   - Implement comment generation assistant
   - Follow TDD approach per constitution

3. **Address test infrastructure** (separate issue):
   - Pin Python to 3.13 as specified in pyproject.toml
   - Fix bcrypt compatibility issue

### Implementation Priority (from tasks.md):
- Phase 2: Foundational tasks (auth boundaries, kill switch, data model alignment)
- Phase 3: US1 - Researcher create + preview (MVP)
- Phase 4: US2 - Participant timed feed
- Phase 5: US3 - Upload + ingest + lock semantics
- Phase 6: US5 - Results export
- Phase 7: US4 - Redirect params
- Phase 8: US6 - Comments + assistant

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
