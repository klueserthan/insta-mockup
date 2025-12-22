# Phase 1 Validation Complete - Recommended Next Steps

**Date**: 2025-12-21  
**Context**: Phase 1 validation task completed. See [VALIDATION_REPORT.md](VALIDATION_REPORT.md) for detailed findings.

## Validation Summary

✅ **Phase 1 Tasks Completed**:
- T001: Quickstart validation - structure verified, clarifications needed
- T002: API contract review - comprehensive comparison completed
- T003: Data model review - alignment assessment completed

🎯 **Key Finding**: The `specs/001-instagram-mockup-feed/` directory contains **completed design artifacts** (spec.md, plan.md, data-model.md, contracts/openapi.yaml, tasks.md) that represent the target architecture for implementing a new Instagram MockUp feature. The current backend implementation is an earlier/different version that predates these design documents.

## Status Classification

### ✅ What Exists and Works (Aligned with Corrected Specs)
- Backend with FastAPI + SQLModel
- Researcher authentication (session-based)
- Projects with settings (queryKey, timeLimitSeconds, redirectUrl, endScreenMessage, randomizationSeed)
- Experiments with public URLs and UI preferences (persistTimer, showUnmutePrompt - currently in Experiment, should be in Project)
- Videos with boolean locks (isLocked)
- Basic feed delivery at `/api/feed/{public_url}`
- Social accounts (personas)
- Pre-seeded comments (with author info)
- Interaction and heartbeat logging
- Media upload and storage

### 📋 What Needs to Be Implemented (from Corrected Specs)
Per the updated design specs in `specs/001-instagram-mockup-feed/`:

**Experiment enhancements**:
- `isActive` field (kill switch at experiment level)

**Project enhancements**:
- `persistTimer` field (move from Experiment)
- `showUnmutePrompt` field (move from Experiment)

**Comment enhancements**:
- `socialPersonaId` foreign key
- `isPinned` field (exactly one per video)
- `linkUrl` field
- `text` field (or keep `body` for compatibility)
- Link click tracking
- AI-generated comment suggestions

**Participant features**:
- Kill switch enforcement (blocked feed access when experiment.isActive=false)
- Query parameter preservation on redirect

**Results & Analytics**:
- Results dashboard endpoint
- CSV export (aggregated)
- JSON export (detailed events)

## Recommended Path Forward ✅ **DECISION MADE: Option 2**

User has chosen **Option 2 - Implement Features** with corrected specs.

### ✅ Completed Actions (Phase 1)

1. **Specs corrected to match proper architecture** ✅
   - Settings (timeLimitSeconds, redirectUrl, endScreenMessage, randomizationSeed) at Project level
   - UI preferences (persistTimer, showUnmutePrompt) moved to Project level in specs
   - Kill switch (`isActive`) at Experiment level in specs
   - Lock semantics changed to boolean (`isLocked`) in data-model.md and openapi.yaml
   - `socialPersonaId` foreign key added to PreseededComment in data-model.md and openapi.yaml
   - Added `ProjectPatch` schema for updating project settings
   - Added `ExperimentPatch` schema for updating experiment (including isActive)

2. **Validation documentation updated** ✅
   - VALIDATION_REPORT.md reflects corrected specs
   - PHASE_1_NEXT_STEPS.md updated with implementation plan

3. **Python version clarified** ✅
   - Backend should use Python >= 3.13 (per pyproject.toml)
   - Will pin to 3.13 to avoid Python 3.14 bcrypt issues

3. **Python version clarified** ✅
   - Backend should use Python >= 3.13 (per pyproject.toml)
   - Will pin to 3.13 to avoid Python 3.14 bcrypt issues

### Next Steps: Phase 2 Implementation

Proceed with **Phase 2: Foundational tasks** from tasks.md:

Key Phase 2 deliverables (T004-T010):
- ✅ Confirm `Project.queryKey` behavior (already implemented)
- Implement participant identity extraction using Project.queryKey
- Ensure public vs researcher auth boundaries are correct
- Add `Project.isActive` field (kill switch)
- Implement kill switch enforcement in feed endpoint
- Ensure experiment settings align with current architecture
- Update frontend API types to match corrected schemas

**Implementation Approach**:
1. Follow TDD per constitution (tests → implementation → refactor)
2. Use `backend/tests/` with pytest
3. Run ruff format + pyright before completion
4. Address one task at a time, validate, commit

**Checkpoint**: After Phase 2, user stories can be implemented independently.

Then deliver user stories in priority order:
1. **US1 (P1)** - Researcher create + preview ← MVP
2. **US2 (P1)** - Participant timed feed + end screen
3. **US3 (P2)** - Upload + ingest + lock semantics
4. **US5 (P2)** - Results dashboard + export
5. **US4 (P3)** - Redirect param pass-through
6. **US6 (P3)** - Comments pre-seeding + assistant

---

### Implementation Details from Corrected Specs

#### Project Model Updates Needed:
```python
class Project:
    # ... existing fields (query_key, time_limit_seconds, etc.) ...
    persist_timer: bool = Field(default=False)  # NEW: Move from Experiment
    show_unmute_prompt: bool = Field(default=True)  # NEW: Move from Experiment
```

#### Experiment Model Updates Needed:
```python
class Experiment:
    # ... existing fields ...
    is_active: bool = Field(default=True)  # NEW: Kill switch per experiment
    # REMOVE: persist_timer (move to Project)
    # REMOVE: show_unmute_prompt (move to Project)
```

#### PreseededComment Model Updates Needed:
```python
class PreseededComment:
    # ... existing fields ...
    social_persona_id: UUID = Field(foreign_key="socialaccount.id")  # NEW: FK to persona
    is_pinned: bool = Field(default=False)  # NEW: Pinned flag
    link_url: Optional[str] = None  # NEW: Optional link
    text: str  # Consider renaming from 'body' or keeping both
```

#### New Endpoints Needed:
- `PATCH /api/projects/{projectId}` - Update project settings (persistTimer, showUnmutePrompt, etc.)
- `PATCH /api/experiments/{experimentId}` - Update experiment (isActive kill switch)
- `GET /api/experiments/{experimentId}/results` - Results dashboard
- `POST /api/experiments/{experimentId}/results/export` - CSV/JSON export
- `PUT /api/videos/{videoId}/pinned-comment` - Set/update pinned comment
- `POST /api/comments/{commentId}/generate` - Generate comment suggestions

---

## Decision Summary

**Decision**: Proceed with Option 2 (Implement features) with corrected specs ✅

**Status**: Phase 1 complete, specs corrected, ready for Phase 2 implementation

**Next Action**: Begin Phase 2 foundational tasks from tasks.md

---

## Appendix: Test Infrastructure Issue ✅ **RESOLUTION DECIDED**

**Issue**: Backend tests fail with Python 3.14 due to passlib/bcrypt compatibility  
**Error**: `ValueError: password cannot be longer than 72 bytes`  
**Root Cause**: passlib checks bcrypt version with test that exceeds 72-byte limit  

**Resolution**: Pin Python to 3.13 as specified in pyproject.toml (`requires-python = ">=3.13"`)

This will be addressed as part of Phase 2 implementation setup.

---

## Files Updated by Phase 1

- [x] `specs/001-instagram-mockup-feed/data-model.md` - Corrected to match implementation architecture
- [x] `specs/001-instagram-mockup-feed/contracts/openapi.yaml` - Corrected schemas and added ProjectPatch
- [x] `VALIDATION_REPORT.md` - Updated with corrected findings
- [x] `PHASE_1_NEXT_STEPS.md` - Updated with decision and implementation plan
