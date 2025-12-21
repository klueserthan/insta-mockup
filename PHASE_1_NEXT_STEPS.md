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

### ✅ What Exists and Works
- Backend with FastAPI + SQLModel
- Researcher authentication (session-based)
- Projects, experiments, videos CRUD
- Basic feed delivery at `/api/feed/{public_url}`
- Social accounts (personas)
- Pre-seeded comments (with author info)
- Interaction and heartbeat logging
- Media upload and storage

### 📋 What's Designed But Not Yet Implemented
Per the design specs in `specs/001-instagram-mockup-feed/`:

**Experiment-level settings** (currently in Project):
- Kill switch (`isActive` field)
- Time limit per experiment
- End screen message per experiment
- Redirect URL per experiment

**Video/Media enhancements**:
- Position-based lock semantics (`lockedPosition`)
- Lock behavior in feed randomization

**Comment enhancements**:
- Pinned comments (exactly one per video)
- Link URLs in comments
- Link click tracking
- AI-generated comment suggestions

**Participant features**:
- Session resume using configurable `Project.queryKey`
- Kill switch enforcement (blocked feed access)
- Query parameter preservation on redirect

**Results & Analytics**:
- Results dashboard endpoint
- CSV export (aggregated)
- JSON export (detailed events)

## Recommended Path Forward

### ✅ RECOMMENDED: Option 3 - Hybrid Approach (Clear Status Documentation)

This option provides maximum clarity and enables parallel work while preserving the design vision.

#### Immediate Actions (Phase 1 Completion)

1. **Annotate spec documents with implementation status**
   
   Add a status legend at the top of each spec document:
   ```markdown
   ## Implementation Status
   - ✅ Implemented and working
   - ⚠️ Partially implemented or differs from spec
   - 📋 Designed but not yet implemented
   ```
   
   Then mark each section/feature accordingly.

2. **Create CURRENT_STATE.md**
   
   Document what actually exists in `specs/001-instagram-mockup-feed/CURRENT_STATE.md`:
   - Current data model (as-is from backend/models.py)
   - Current API routes (as-is from backend/routes/)
   - Current authentication flow
   - Differences from design specs
   
   This serves as a bridge between current reality and future vision.

3. **Update quickstart.md**
   
   Split into two sections:
   - **"What Works Now"**: Features that can be tested today
   - **"Planned Features"**: Features from tasks.md not yet implemented
   
   Keep the dev setup instructions (uv, ROCKET_API_KEY, npm) as-is.

4. **Add implementation roadmap**
   
   Create `specs/001-instagram-mockup-feed/ROADMAP.md`:
   - Link to tasks.md for detailed implementation plan
   - Show phase dependencies (Phase 2 → Phase 3 → etc.)
   - Indicate which user stories depend on which phases
   - Estimated complexity/effort per phase

#### Benefits of This Approach

✅ **Documentation is immediately accurate**
- New developers can see current vs. planned state
- No confusion about what works today

✅ **Design vision is preserved**
- spec.md, plan.md, data-model.md remain as design docs
- Can reference them during implementation

✅ **Enables parallel work**
- Frontend can proceed with existing backend
- Backend can implement new features incrementally
- Clear contracts (OpenAPI) guide API evolution

✅ **Follows constitution principles**
- TDD for backend changes (per tasks.md)
- Preserves existing frontend behavior
- Auth boundaries clearly documented

#### Phase 2 and Beyond

Once status documentation is complete, proceed with **Phase 2: Foundational tasks** from tasks.md:

Key Phase 2 deliverables (T004-T010):
- Confirm/implement `Project.queryKey` behavior
- Participant identity extraction logic
- Public vs researcher auth boundaries
- Kill switch (`Experiment.isActive`) enforcement
- Experiment settings at Experiment level (migrate from Project)
- Frontend API types alignment

**Checkpoint**: After Phase 2, user stories can be implemented independently.

Then deliver user stories in priority order:
1. **US1 (P1)** - Researcher create + preview ← MVP
2. **US2 (P1)** - Participant timed feed + end screen
3. **US3 (P2)** - Upload + ingest + lock semantics
4. **US5 (P2)** - Results dashboard + export
5. **US4 (P3)** - Redirect param pass-through
6. **US6 (P3)** - Comments pre-seeding + assistant

---

### Alternative: Option 2 - Implement Features (Full Implementation)

If immediate feature delivery is the priority:

**Pros**: 
- Specs become accurate once implementation completes
- Delivers planned functionality
- Follows design vision

**Cons**: 
- Substantial development effort (6+ phases from tasks.md)
- Backend tests currently broken (Python 3.14 bcrypt issue)
- No documentation of current state during implementation

**Process**:
1. Fix test infrastructure (bcrypt compatibility)
2. Follow tasks.md from Phase 2 onwards
3. Use TDD per constitution (tests → implementation → refactor)
4. Validate each phase before proceeding

**Estimated Scope**: 
- Phase 2 (Foundational): ~20-30 tasks
- Phases 3-8 (User Stories): ~40-50 tasks
- Total: ~60-80 tasks

---

### Not Recommended: Option 1 - Rewrite Specs to Match Current Code

**Why not recommended**:
- Loses the carefully designed architecture
- Would need to redesign later for missing features
- specs/001-instagram-mockup-feed represents significant design work
- plan.md explicitly says "Phase 0: Research (complete)" and "Phase 1: Design & Contracts (complete)"

If you chose this path anyway:
1. Archive current specs to `specs/001-instagram-mockup-feed/ORIGINAL_DESIGN/`
2. Rewrite data-model.md to match current models.py
3. Rewrite openapi.yaml to match current routes
4. Mark all Phase 2+ tasks as "Future Enhancement"

---

## Decision Point

**Question for project owner (@klueserthan)**:

Which path should we take?

- [ ] **Option 3 (Recommended)**: Annotate specs with status, create CURRENT_STATE.md, proceed to Phase 2 implementation when ready
- [ ] **Option 2**: Proceed directly to Phase 2 implementation (fix tests, then implement features)
- [ ] **Option 1**: Rewrite specs to match current code (not recommended)

Once you decide, I can proceed accordingly.

---

## Appendix: Test Infrastructure Issue

**Separate from Phase 1 validation**, but blocking Option 2:

**Issue**: Backend tests fail with Python 3.14 due to passlib/bcrypt compatibility  
**Error**: `ValueError: password cannot be longer than 72 bytes`  
**Root Cause**: passlib checks bcrypt version with test that exceeds 72-byte limit  

**Resolution Options**:
1. Pin Python to 3.12 or 3.13 (quick fix)
2. Update passlib/bcrypt dependencies (may need newer versions)
3. Switch to alternative password hashing (e.g., argon2)

**Recommendation**: Pin Python 3.13 in CI/docs since pyproject.toml already specifies `requires-python = ">=3.13"`

---

## Files Created by Phase 1

- [x] `VALIDATION_REPORT.md` - Detailed comparison of specs vs implementation
- [x] `PHASE_1_NEXT_STEPS.md` - This file (recommendations and decision tree)

## Files to Create (if Option 3 selected)

- [ ] `specs/001-instagram-mockup-feed/CURRENT_STATE.md` - As-is implementation documentation
- [ ] `specs/001-instagram-mockup-feed/ROADMAP.md` - Implementation roadmap and phase dependencies
- [ ] Update `specs/001-instagram-mockup-feed/quickstart.md` - Split current vs planned
- [ ] Update `specs/001-instagram-mockup-feed/spec.md` - Add status annotations
- [ ] Update `specs/001-instagram-mockup-feed/data-model.md` - Add status annotations
- [ ] Update `specs/001-instagram-mockup-feed/contracts/openapi.yaml` - Add status comments
